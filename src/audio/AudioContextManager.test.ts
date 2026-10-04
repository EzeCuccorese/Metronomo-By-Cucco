import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type State = AudioContextState | 'interrupted';

class MockContext extends EventTarget {
    state: State = 'suspended';
    currentTime = 0;
    outputLatency: number | undefined = 0.01;
    resume = vi.fn(async () => { this.state = 'running'; });
    close = vi.fn(async () => { this.state = 'closed'; });

    setState(state: State) {
        this.state = state;
        this.dispatchEvent(new Event('statechange'));
    }
}

let contexts: MockContext[];
let visibility: DocumentVisibilityState;
/** Document listeners added by the manager instances of each test (removed afterwards, so tests stay isolated). */
let added: Array<[string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]>;
const realAdd = document.addEventListener.bind(document);

const setVisibility = (value: DocumentVisibilityState) => {
    visibility = value;
    document.dispatchEvent(new Event('visibilitychange'));
};

const load = async () => (await import('./AudioContextManager')).default.getInstance();

/** Lets pending promise callbacks run without advancing fake time. */
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

describe('AudioContextManager', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        contexts = [];
        added = [];
        vi.spyOn(document, 'addEventListener').mockImplementation((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
            added.push([type, listener, options]);
            realAdd(type, listener, options);
        });
        visibility = 'visible';
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
        vi.stubGlobal('AudioContext', vi.fn(function () {
            const ctx = new MockContext();
            contexts.push(ctx);
            return ctx;
        }));
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        added.forEach(([type, listener, options]) => document.removeEventListener(type, listener, options));
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        Reflect.deleteProperty(navigator, 'audioSession');
    });

    it('is a singleton with one interactive context', async () => {
        const a = await load();
        const b = await load();
        expect(a).toBe(b);
        expect(a.getContext()).toBe(contexts[0]);
        expect(contexts).toHaveLength(1);
        expect(AudioContext).toHaveBeenCalledWith({ latencyHint: 'interactive' });
    });

    describe('audio session', () => {
        it("sets the 'playback' category before the context exists, so the silent switch does not mute it", async () => {
            const session = { type: 'auto' };
            let typeWhenContextCreated = '';
            Object.defineProperty(navigator, 'audioSession', { configurable: true, value: session });
            vi.stubGlobal('AudioContext', vi.fn(function () {
                typeWhenContextCreated = session.type;
                const ctx = new MockContext();
                contexts.push(ctx);
                return ctx;
            }));
            await load();
            expect(session.type).toBe('playback');
            expect(typeWhenContextCreated).toBe('playback');
        });

        it('works without the API (Chrome) and survives a throwing setter', async () => {
            await expect(load()).resolves.toBeDefined(); // no navigator.audioSession

            vi.resetModules();
            Object.defineProperty(navigator, 'audioSession', {
                configurable: true,
                value: { set type(_: string) { throw new Error('not allowed'); } },
            });
            await expect(load()).resolves.toBeDefined();
            expect(console.warn).toHaveBeenCalled();
        });
    });

    describe('resume', () => {
        it('resumes a suspended or interrupted context and skips a running one', async () => {
            const manager = await load();
            await manager.resume();
            expect(contexts[0].resume).toHaveBeenCalledTimes(1);

            await manager.resume(); // running
            expect(contexts[0].resume).toHaveBeenCalledTimes(1);

            contexts[0].state = 'interrupted';
            await manager.resume();
            expect(contexts[0].resume).toHaveBeenCalledTimes(2);
            expect(manager.pendingResume).toBe(false);
        });

        it('shares one attempt between concurrent callers', async () => {
            const manager = await load();
            let finish!: () => void;
            contexts[0].resume.mockReturnValueOnce(new Promise<void>(r => { finish = r; }));
            const a = manager.resume();
            const b = manager.resume();
            finish();
            expect(a).toBe(b);
            await a;
            expect(contexts[0].resume).toHaveBeenCalledTimes(1);
        });

        it('a rejected resume rejects, then retries on the next pointerdown or keydown (once)', async () => {
            const manager = await load();
            contexts[0].resume.mockRejectedValueOnce(new DOMException('no gesture', 'NotAllowedError'));
            await expect(manager.resume()).rejects.toThrow('no gesture');
            expect(manager.pendingResume).toBe(true);

            document.dispatchEvent(new Event('pointerdown'));
            await flush();
            expect(contexts[0].resume).toHaveBeenCalledTimes(2);
            expect(manager.pendingResume).toBe(false);

            // Both listeners were removed after the first gesture.
            contexts[0].state = 'suspended';
            document.dispatchEvent(new Event('keydown'));
            document.dispatchEvent(new Event('pointerdown'));
            await flush();
            expect(contexts[0].resume).toHaveBeenCalledTimes(2);
        });

        it('a keydown also retries, and repeated failures arm a single retry', async () => {
            const manager = await load();
            contexts[0].resume.mockRejectedValue(new Error('refused'));
            await expect(manager.resume()).rejects.toThrow();
            await expect(manager.resume()).rejects.toThrow();

            contexts[0].resume.mockImplementation(async () => { contexts[0].state = 'running'; });
            document.dispatchEvent(new Event('keydown'));
            await flush();
            expect(contexts[0].resume).toHaveBeenCalledTimes(3);
            expect(contexts[0].state).toBe('running');
        });

        it('a resume that resolves but leaves the context suspended waits for a gesture', async () => {
            const manager = await load();
            contexts[0].resume.mockResolvedValueOnce(undefined); // state stays 'suspended'
            await manager.resume();
            expect(manager.pendingResume).toBe(true);
        });
    });

    describe('automatic resume', () => {
        it('does nothing until the app asked for audio', async () => {
            await load();
            setVisibility('hidden');
            setVisibility('visible');
            contexts[0].setState('suspended');
            expect(contexts[0].resume).not.toHaveBeenCalled();
        });

        it('resumes when the page becomes visible again', async () => {
            const manager = await load();
            await manager.resume();
            contexts[0].state = 'interrupted'; // lock screen
            setVisibility('hidden');
            expect(contexts[0].resume).toHaveBeenCalledTimes(1);

            setVisibility('visible');
            await flush();
            expect(contexts[0].resume).toHaveBeenCalledTimes(2);
            expect(contexts[0].state).toBe('running');
        });

        it('resumes on statechange (end of a call) only while visible', async () => {
            const manager = await load();
            await manager.resume();

            visibility = 'hidden';
            contexts[0].setState('interrupted');
            expect(contexts[0].resume).toHaveBeenCalledTimes(1);

            visibility = 'visible';
            contexts[0].setState('suspended');
            await flush();
            expect(contexts[0].resume).toHaveBeenCalledTimes(2);

            contexts[0].setState('running'); // no resume needed
            expect(contexts[0].resume).toHaveBeenCalledTimes(2);
        });

        it('an automatic resume refused by WebKit never surfaces as an unhandled rejection', async () => {
            const manager = await load();
            await manager.resume();
            contexts[0].resume.mockRejectedValueOnce(new Error('no gesture'));
            contexts[0].setState('interrupted');
            await flush();
            expect(manager.pendingResume).toBe(true);
        });
    });

    describe('context recreation (WebKit bug 291892)', () => {
        it('recreates the context when resume() hangs for 1 s and notifies consumers', async () => {
            const manager = await load();
            const old = contexts[0];
            old.resume.mockReturnValueOnce(new Promise(() => {})); // never settles
            const listener = vi.fn();
            manager.onContextReplaced(listener);

            const resuming = manager.resume();
            await vi.advanceTimersByTimeAsync(999);
            expect(contexts).toHaveLength(1);
            await vi.advanceTimersByTimeAsync(1);
            await resuming;

            expect(contexts).toHaveLength(2);
            expect(old.close).toHaveBeenCalled();
            expect(manager.getContext()).toBe(contexts[1]);
            expect(listener).toHaveBeenCalledWith(contexts[1]);
            expect(contexts[1].resume).toHaveBeenCalled(); // the new context is started right away
            expect(contexts[1].state).toBe('running');

            // The old context no longer drives anything.
            old.setState('suspended');
            expect(old.resume).toHaveBeenCalledTimes(1);
        });

        it('recreates a context that reports running but whose clock is frozen', async () => {
            const manager = await load();
            const listener = vi.fn();
            manager.onContextReplaced(listener);
            await manager.resume();
            await vi.advanceTimersByTimeAsync(500); // currentTime never moved
            expect(listener).toHaveBeenCalledTimes(1);
            expect(contexts).toHaveLength(2);
        });

        it('keeps a healthy context whose clock advances', async () => {
            const manager = await load();
            const listener = vi.fn();
            manager.onContextReplaced(listener);
            await manager.resume();
            contexts[0].currentTime = 0.5;
            await vi.advanceTimersByTimeAsync(500);
            expect(listener).not.toHaveBeenCalled();
        });

        it('skips the mute check when the page went hidden or the context stopped', async () => {
            const manager = await load();
            const listener = vi.fn();
            manager.onContextReplaced(listener);
            await manager.resume();
            visibility = 'hidden';
            await vi.advanceTimersByTimeAsync(500);
            expect(listener).not.toHaveBeenCalled();

            visibility = 'visible';
            contexts[0].state = 'suspended';
            await manager.resume();
            contexts[0].state = 'suspended';
            await vi.advanceTimersByTimeAsync(500);
            expect(listener).not.toHaveBeenCalled();
        });

        it('a hidden page waits for a gesture instead of recreating', async () => {
            const manager = await load();
            visibility = 'hidden';
            contexts[0].resume.mockReturnValueOnce(new Promise(() => {}));
            const resuming = manager.resume();
            await vi.advanceTimersByTimeAsync(1000);
            await resuming;
            expect(contexts).toHaveLength(1);
            expect(manager.pendingResume).toBe(true);
        });

        it('stops recreating after two failed contexts, until the next gesture', async () => {
            const hang = () => new Promise<void>(() => {});
            vi.stubGlobal('AudioContext', vi.fn(function () {
                const ctx = new MockContext();
                ctx.resume.mockImplementation(hang);
                contexts.push(ctx);
                return ctx;
            }));
            const manager = await load();
            const resuming = manager.resume();
            await vi.advanceTimersByTimeAsync(3000);
            await resuming;
            expect(contexts).toHaveLength(3); // original + 2 recreations
            expect(manager.pendingResume).toBe(true);

            document.dispatchEvent(new Event('pointerdown'));
            await vi.advanceTimersByTimeAsync(1000);
            expect(contexts).toHaveLength(4);
        });

        it('a context still muted after the last recreation waits for a gesture', async () => {
            const manager = await load();
            const listener = vi.fn();
            manager.onContextReplaced(listener);
            await manager.resume();
            await vi.advanceTimersByTimeAsync(500); // frozen -> recreation 1
            await vi.advanceTimersByTimeAsync(500); // frozen -> recreation 2
            expect(contexts).toHaveLength(3);
            await vi.advanceTimersByTimeAsync(500); // frozen again: out of attempts
            expect(contexts).toHaveLength(3);
            expect(manager.pendingResume).toBe(true);

            document.dispatchEvent(new Event('pointerdown'));
            await vi.advanceTimersByTimeAsync(0);
            expect(contexts).toHaveLength(4); // the gesture recreates the muted context
            expect(listener).toHaveBeenCalledTimes(3);
        });

        it('ignores a late result from a replaced context, and isolates failing listeners', async () => {
            const manager = await load();
            const error = vi.spyOn(console, 'error').mockImplementation(() => {});
            let rejectOld!: (e: Error) => void;
            contexts[0].resume.mockReturnValueOnce(new Promise((_, reject) => { rejectOld = reject; }));
            contexts[0].close.mockImplementationOnce(() => { throw new Error('already closed'); });
            const good = vi.fn();
            manager.onContextReplaced(() => { throw new Error('broken consumer'); });
            manager.onContextReplaced(good);

            const resuming = manager.resume();
            await vi.advanceTimersByTimeAsync(1000);
            await resuming;
            expect(good).toHaveBeenCalledWith(contexts[1]);
            expect(error).toHaveBeenCalled();

            rejectOld(new Error('late'));
            await flush();
            expect(manager.pendingResume).toBe(false);
        });

        it('unsubscribes listeners', async () => {
            const manager = await load();
            const listener = vi.fn();
            const unsubscribe = manager.onContextReplaced(listener);
            unsubscribe();
            contexts[0].resume.mockReturnValueOnce(new Promise(() => {}));
            const resuming = manager.resume();
            await vi.advanceTimersByTimeAsync(1000);
            await resuming;
            expect(listener).not.toHaveBeenCalled();
        });
    });

    it('reports the output latency, 0 when the browser does not', async () => {
        const manager = await load();
        expect(manager.getOutputLatency()).toBe(0.01);
        contexts[0].outputLatency = undefined;
        expect(manager.getOutputLatency()).toBe(0);
    });
});
