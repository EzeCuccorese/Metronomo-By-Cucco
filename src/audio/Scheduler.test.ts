import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

// --- Test doubles: the Scheduler is tested in isolation from the synthesis code. ---
const ctx = { currentTime: 0 };

vi.mock('./AudioContextManager', () => ({
    default: { getInstance: () => ({ getContext: () => ctx, resume: vi.fn() }) }
}));

const drum = {
    play: vi.fn(),
    silence: vi.fn(),
    dispose: vi.fn(),
    getChannelNode: vi.fn(() => ({})),
    setChannelVolume: vi.fn(),
    setChannelPan: vi.fn(),
    setChannelMute: vi.fn(),
};
vi.mock('./DrumSynthesizer', () => ({
    default: class { constructor() { return drum; } }
}));

const poly = {
    playChord: vi.fn(),
    silence: vi.fn(),
    dispose: vi.fn(),
    connect: vi.fn(),
    setVolume: vi.fn(),
};
vi.mock('./PolyphonicSynth', () => ({
    PolyphonicSynth: class { constructor() { return poly; } }
}));

const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null as unknown };
vi.mock('./clock.worker?worker', () => ({
    default: class { constructor() { return worker; } }
}));

// jsdom has no Worker: the Scheduler only creates its clock when the API exists.
globalThis.Worker = class {} as unknown as typeof Worker;

let rafCallbacks: FrameRequestCallback[] = [];
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
}) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = vi.fn();

import Scheduler, { buildFormSections } from './Scheduler';
import type { PlaybackEvent } from './Scheduler';

const makePattern = (overrides: Partial<RhythmPattern> = {}): RhythmPattern => ({
    id: 'test',
    name: 'Test',
    description: '',
    timeSignature: [4, 4],
    subdivision: 4,
    instruments: ['kick'],
    countingMode: 'numbers',
    steps: [{ step: 1, instrument: 'kick', velocity: 1 }],
    ...overrides,
});

/** Advances the audio clock in worker-sized ticks, running scheduler and visual loop like the browser would. */
function run(scheduler: Scheduler, seconds: number, tick = 0.025) {
    const end = ctx.currentTime + seconds;
    while (ctx.currentTime < end - 1e-9) {
        ctx.currentTime = Math.round((ctx.currentTime + tick) * 1e6) / 1e6;
        (scheduler as unknown as { scheduler: () => void }).scheduler();
        const callbacks = rafCallbacks;
        rafCallbacks = [];
        callbacks.forEach(cb => cb(0));
    }
}

const playsOf = (instrument: string) =>
    drum.play.mock.calls.filter(c => c[0] === instrument).map(c => ({ time: c[1] as number, velocity: c[2] as number }));

describe('Scheduler', () => {
    let scheduler: Scheduler;

    beforeEach(() => {
        vi.clearAllMocks();
        ctx.currentTime = 0;
        rafCallbacks = [];
        scheduler = new Scheduler();
    });

    describe('guide click', () => {
        it('clicks every quarter note exactly on the grid (no humanize jitter)', () => {
            scheduler.setPattern(makePattern({ subdivision: 16, steps: [] }));
            scheduler.setTempo(120);
            scheduler.start();
            run(scheduler, 2.1);

            const clicks = playsOf('click');
            expect(clicks.length).toBeGreaterThanOrEqual(4);
            for (let i = 1; i < clicks.length; i++) {
                expect(clicks[i].time - clicks[i - 1].time).toBeCloseTo(0.5, 9);
            }
            expect(clicks[0].velocity).toBe(1);
            expect(clicks[1].velocity).toBe(0.7);
        });

        it('accents compound meters by dotted-quarter groups (6/8)', () => {
            scheduler.setPattern(makePattern({ timeSignature: [6, 8], subdivision: 12, steps: [] }));
            scheduler.setTempo(120);
            scheduler.start();
            run(scheduler, 1.45); // one 6/8 bar at ♩=120 lasts 1.5 s

            const velocities = playsOf('click').slice(0, 6).map(c => c.velocity);
            expect(velocities).toEqual([1, 0.45, 0.45, 0.7, 0.45, 0.45]);
        });

        it('keeps the click on time even when humanize moves the instruments', () => {
            vi.spyOn(Math, 'random').mockReturnValue(1);
            scheduler.setHumanize(10);
            scheduler.setPattern(makePattern({ subdivision: 4 }));
            scheduler.start();
            run(scheduler, 0.6);

            const kick = playsOf('kick')[0];
            const click = playsOf('click')[0];
            expect(kick.time - click.time).toBeCloseTo(0.005, 6);
            vi.restoreAllMocks();
        });
    });

    describe('main-thread stalls', () => {
        /** Freezes the scheduler for `seconds` while the audio clock keeps running. */
        const stall = (seconds: number) => {
            ctx.currentTime = Math.round((ctx.currentTime + seconds) * 1e6) / 1e6;
        };

        it('skips the steps missed during a short stall and stays on the original grid', () => {
            scheduler.setPattern(makePattern({ subdivision: 4, steps: [] }));
            scheduler.setTempo(120);
            scheduler.start();
            run(scheduler, 0.5);
            const before = playsOf('click');
            const gridStart = before[0].time;

            // Longer than the lookahead window: the beat at 1.05 s is missed.
            stall(0.9);
            const resumedAt = ctx.currentTime;
            run(scheduler, 1.5);

            const clicks = playsOf('click');
            const after = clicks.slice(before.length);
            // No burst: the missed beat is dropped, not played late.
            expect(after[0].time).toBeGreaterThan(resumedAt);
            // Phase is kept: every click lies on the grid that started before the stall.
            clicks.forEach(c => {
                const beats = (c.time - gridStart) / 0.5;
                expect(beats).toBeCloseTo(Math.round(beats), 9);
            });
        });

        it('still plays a note that is only slightly late', () => {
            scheduler.setPattern(makePattern({ subdivision: 4, steps: [] }));
            scheduler.setTempo(120);
            scheduler.start();
            run(scheduler, 0.5);
            const count = playsOf('click').length;

            // Beats at 0.05 and 0.55 s are already queued; the next one (1.05 s) is
            // reached by a scheduler that wakes up 10 ms after it.
            stall(1.05 + 0.01 - ctx.currentTime);
            (scheduler as unknown as { scheduler: () => void }).scheduler();
            const late = playsOf('click')[count];
            expect(late.time).toBeCloseTo(ctx.currentTime, 9);
        });

        it('restarts the grid from now after a long stall instead of fast-forwarding', () => {
            const events: PlaybackEvent[] = [];
            scheduler.setOnPlaybackUpdate(e => events.push(e));
            scheduler.setPattern(makePattern({ subdivision: 4, steps: [] }));
            scheduler.setTempo(120);
            scheduler.start();
            run(scheduler, 0.5);
            const count = playsOf('click').length;

            stall(5);
            run(scheduler, 0.025);
            const resumeAt = ctx.currentTime;
            run(scheduler, 0.1);

            const next = playsOf('click')[count];
            expect(next.time).toBeCloseTo(resumeAt, 9);
            // ~10 bars of silence did not count as practised bars.
            expect(Math.max(...events.map(e => e.totalBars))).toBeLessThanOrEqual(1);
        });
    });

    describe('pattern changes', () => {
        it('hot-swaps edits of the playing pattern on the next step (C2/C3 regression)', () => {
            const original = makePattern({ subdivision: 4 });
            scheduler.setPattern(original);
            scheduler.start();
            run(scheduler, 0.3);
            expect(playsOf('snare')).toHaveLength(0);

            scheduler.setPattern({ ...original, steps: [...original.steps, { step: 3, instrument: 'snare', velocity: 1 }] });
            expect(scheduler.getQueuedPatternId()).toBeNull();
            run(scheduler, 2);
            expect(playsOf('snare').length).toBeGreaterThan(0);
        });

        it('applies edits immediately while stopped', () => {
            const original = makePattern();
            scheduler.setPattern(original);
            scheduler.setPattern({ ...original, steps: [{ step: 2, instrument: 'snare', velocity: 1 }] });
            scheduler.start();
            run(scheduler, 1);
            expect(playsOf('snare').length).toBeGreaterThan(0);
            expect(playsOf('kick')).toHaveLength(0);
        });

        it('queues a different pattern until the bar line and adopts its recommended tempo', () => {
            const events: PlaybackEvent[] = [];
            scheduler.setOnPlaybackUpdate(e => events.push(e));
            scheduler.setPattern(makePattern());
            scheduler.setTempo(120);
            scheduler.start();
            run(scheduler, 0.6);

            scheduler.setPattern(makePattern({ id: 'b', recommendedTempo: 90, steps: [{ step: 1, instrument: 'snare', velocity: 1 }] }));
            expect(scheduler.getQueuedPatternId()).toBe('b');
            expect(events.at(-1)?.pattern.id).toBe('test');

            run(scheduler, 2);
            expect(scheduler.getQueuedPatternId()).toBeNull();
            expect(scheduler.getTempo()).toBe(90);
            const firstSnare = playsOf('snare')[0].time;
            expect(firstSnare).toBeCloseTo(2.05, 6); // exactly one 4/4 bar (2 s) after the 50 ms start offset
            expect(events.at(-1)?.pattern.id).toBe('b');
        });

        it('keeps a queued switch when the playing pattern is edited meanwhile', () => {
            const original = makePattern();
            scheduler.setPattern(original);
            scheduler.start();
            run(scheduler, 0.2);
            scheduler.setPattern(makePattern({ id: 'b' }));
            scheduler.setPattern({ ...original, steps: [] });
            expect(scheduler.getQueuedPatternId()).toBe('b');
        });

        it('re-selecting the active pattern cancels a pending switch', () => {
            const original = makePattern();
            scheduler.setPattern(original);
            scheduler.start();
            scheduler.setPattern(makePattern({ id: 'b' }));
            scheduler.setPattern(original);
            expect(scheduler.getQueuedPatternId()).toBeNull();
        });

        it('requeues a meter change of the same pattern for the bar line', () => {
            const original = makePattern();
            scheduler.setPattern(original);
            scheduler.start();
            scheduler.setPattern({ ...original, subdivision: 8 });
            expect(scheduler.getQueuedPatternId()).toBe('test');
        });
    });

    describe('timing safety', () => {
        it('never schedules notes in the past, even with anticipating grooves', () => {
            const pattern = makePattern({
                timeSignature: [6, 8], subdivision: 12, grooveType: 'chamame_saltadito',
                steps: Array.from({ length: 12 }, (_, i) => ({ step: i + 1, instrument: 'cajon' as const, velocity: 1 }))
            });
            scheduler.setPattern(pattern);
            scheduler.start();
            const times: { scheduledAt: number; time: number }[] = [];
            drum.play.mockImplementation((_i: string, time: number) => times.push({ scheduledAt: ctx.currentTime, time }));
            run(scheduler, 3);
            expect(times.length).toBeGreaterThan(20);
            times.forEach(t => expect(t.time).toBeGreaterThanOrEqual(t.scheduledAt));
        });

        it('rescales the wait for the next step when the tempo changes', () => {
            scheduler.setPattern(makePattern());
            scheduler.setTempo(60);
            scheduler.start();
            run(scheduler, 0.1);
            scheduler.setTempo(120);
            expect(scheduler.getTempo()).toBe(120);
        });

        it('ignores invalid tempos', () => {
            scheduler.setTempo(0);
            scheduler.setTempo(NaN);
            expect(scheduler.getTempo()).toBe(120);
        });
    });

    describe('transport', () => {
        it('stop() silences scheduled voices and harmony immediately', () => {
            scheduler.setPattern(makePattern());
            scheduler.start();
            run(scheduler, 0.5);
            scheduler.stop();
            expect(drum.silence).toHaveBeenCalledTimes(1);
            expect(poly.silence).toHaveBeenCalledTimes(1);
            expect(worker.postMessage).toHaveBeenLastCalledWith({ action: 'stop' });

            const calls = drum.play.mock.calls.length;
            run(scheduler, 1);
            expect(drum.play.mock.calls.length).toBe(calls);
        });

        it('dispose() releases the worker, the synths and further callbacks', () => {
            const listener = vi.fn();
            scheduler.setOnPlaybackUpdate(listener);
            scheduler.setPattern(makePattern());
            scheduler.start();
            scheduler.dispose();
            scheduler.dispose(); // idempotent

            expect(worker.terminate).toHaveBeenCalledTimes(1);
            expect(drum.dispose).toHaveBeenCalledTimes(1);
            expect(poly.dispose).toHaveBeenCalledTimes(1);
            scheduler.start();
            expect(scheduler.getIsPlaying()).toBe(false);
        });

        it('only runs the animation loop while playing', () => {
            scheduler.setPattern(makePattern());
            expect(rafCallbacks).toHaveLength(0);
            scheduler.start();
            expect(rafCallbacks).toHaveLength(1);
            scheduler.stop();
            expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
        });

        it('delivers visual events only once their audio time is reached', () => {
            const listener = vi.fn();
            scheduler.setOnPlaybackUpdate(listener);
            scheduler.setPattern(makePattern());
            scheduler.start();
            (scheduler as unknown as { scheduler: () => void }).scheduler();
            rafCallbacks.splice(0).forEach(cb => cb(0));
            expect(listener).not.toHaveBeenCalled(); // first step sounds at t = 0.05
            run(scheduler, 0.1);
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({ step: 0 }));
        });

        it('previews a single instrument at full velocity', () => {
            scheduler.playOneShot('bombo_leguero', 'aro');
            expect(drum.play).toHaveBeenCalledWith('bombo_leguero', 0, 1, 'aro');
        });

        it('forwards mixer settings to the synthesizer', () => {
            scheduler.setChannelVolume('kick', 0.5);
            scheduler.setChannelPan('kick', -1);
            scheduler.setChannelMute('kick', true);
            expect(drum.setChannelVolume).toHaveBeenCalledWith('kick', 0.5);
            expect(drum.setChannelPan).toHaveBeenCalledWith('kick', -1);
            expect(drum.setChannelMute).toHaveBeenCalledWith('kick', true);
        });
    });

    describe('practice features', () => {
        it('counts practiced bars without any harmony loaded (C6 regression)', () => {
            const events: PlaybackEvent[] = [];
            scheduler.setOnPlaybackUpdate(e => events.push(e));
            scheduler.setPattern(makePattern());
            scheduler.setTempo(240); // 1 s per bar
            scheduler.start();
            run(scheduler, 3.2);
            expect(scheduler.getPracticeStats().totalBars).toBe(3);
            expect(events.at(-1)?.totalBars).toBe(3);
            scheduler.resetPracticeStats();
            expect(scheduler.getPracticeStats().totalBars).toBe(0);
        });

        it('speed trainer raises the tempo every N bars up to the target', () => {
            scheduler.configureTrainer({ active: true, startBpm: 200, targetBpm: 210, barsPerStep: 1, bpmIncrement: 5, mode: 'linear' });
            scheduler.setPattern(makePattern());
            scheduler.start();
            expect(scheduler.getTempo()).toBe(200);
            run(scheduler, 6);
            expect(scheduler.getTempo()).toBe(210);
        });

        it('speed trainer can also slow down', () => {
            scheduler.configureTrainer({ active: true, startBpm: 220, targetBpm: 210, barsPerStep: 1, bpmIncrement: 5, mode: 'linear' });
            scheduler.setPattern(makePattern());
            scheduler.start();
            run(scheduler, 6);
            expect(scheduler.getTempo()).toBe(210);
        });

        it('resistance loop cools down after holding the target', () => {
            scheduler.configureTrainer({ active: true, startBpm: 235, targetBpm: 240, barsPerStep: 1, bpmIncrement: 5, mode: 'resistance_loop' });
            scheduler.setPattern(makePattern());
            scheduler.start();
            const seen = new Set<number>();
            for (let i = 0; i < 12; i++) {
                run(scheduler, 1);
                seen.add(scheduler.getTempo());
            }
            expect(seen.has(240)).toBe(true);
            expect(seen.has(Math.round(240 * 0.95))).toBe(true);
        });

        it('a trainer keeps its tempo when a queued preset arrives', () => {
            scheduler.configureTrainer({ active: true, startBpm: 100, targetBpm: 100, barsPerStep: 4, bpmIncrement: 5, mode: 'linear' });
            scheduler.setPattern(makePattern());
            scheduler.start();
            scheduler.setPattern(makePattern({ id: 'b', recommendedTempo: 60 }));
            run(scheduler, 3);
            expect(scheduler.getTempo()).toBe(100);
        });

        it('silence mode mutes whole bars (instruments, click and harmony)', () => {
            scheduler.setHarmonyProgression([['C4', 'E4', 'G4']]);
            scheduler.setSilenceMode(true, 1);
            scheduler.setPattern(makePattern());
            scheduler.setTempo(240);
            scheduler.start();
            run(scheduler, 1.02); // first bar plays normally
            const afterFirstBar = drum.play.mock.calls.length;
            const chordsAfterFirstBar = poly.playChord.mock.calls.length;
            run(scheduler, 2);
            expect(afterFirstBar).toBeGreaterThan(0);
            expect(drum.play.mock.calls.length).toBe(afterFirstBar);
            expect(poly.playChord.mock.calls.length).toBe(chordsAfterFirstBar);

            scheduler.setSilenceMode(false);
            run(scheduler, 1.2);
            expect(drum.play.mock.calls.length).toBeGreaterThan(afterFirstBar);
        });

        it('plays the harmony twice per bar with half-bar durations', () => {
            scheduler.setHarmonyProgression([['C4', 'E4', 'G4'], ['F4', 'A4', 'C5']]);
            scheduler.setAccompanimentStyle('quarters');
            scheduler.setHarmonyVolume(0.5);
            scheduler.setPattern(makePattern());
            scheduler.setTempo(120);
            scheduler.start();
            run(scheduler, 2);

            expect(poly.setVolume).toHaveBeenCalledWith(0.5);
            const calls = poly.playChord.mock.calls;
            expect(calls.length).toBeGreaterThanOrEqual(2);
            expect(calls[0][0]).toEqual(['C4', 'E4', 'G4']);
            expect(calls[0][1]).toBeCloseTo(1, 9);
            expect(calls[0][3]).toBe('quarters');
            expect(calls[1][0]).toEqual(['F4', 'A4', 'C5']);
            expect(calls[1][4]).toEqual(['C4', 'E4', 'G4']);
            expect(calls[0][5]).toBe(2); // two quarter-note beats per half bar of 4/4
        });

        it('in 3/4 changes chord once per bar, on the downbeat, with a 3-beat grid (zamba)', () => {
            scheduler.setHarmonyProgression([['C4'], ['C4'], ['G3'], ['G3']]); // two 1-bar chords
            scheduler.setAccompanimentStyle('zamba_base');
            scheduler.setPattern(makePattern({ timeSignature: [3, 4], subdivision: 12 }));
            scheduler.setTempo(120); // 1.5 s per bar
            scheduler.start();
            run(scheduler, 2.9);

            const calls = poly.playChord.mock.calls;
            expect(calls).toHaveLength(2);
            expect(calls[0][0]).toEqual(['C4']);
            expect(calls[1][0]).toEqual(['G3']);
            expect(calls[1][2] - calls[0][2]).toBeCloseTo(1.5, 6); // one bar apart: never on the "and" of 2
            expect(calls[0][1]).toBeCloseTo(1.5, 6);
            expect(calls[0][5]).toBe(3);
        });

        it('splits 6/8 into its two dotted-quarter halves', () => {
            scheduler.setHarmonyProgression([['C4'], ['F4']]);
            scheduler.setPattern(makePattern({ timeSignature: [6, 8], subdivision: 12 }));
            scheduler.setTempo(120);
            scheduler.start();
            run(scheduler, 1.4);
            const calls = poly.playChord.mock.calls;
            expect(calls).toHaveLength(2);
            expect(calls[1][2] - calls[0][2]).toBeCloseTo(0.75, 6);
            expect(calls[0][5]).toBe(1);
        });

        it('restarts the progression when it changes', () => {
            scheduler.setHarmonyProgression([['C4']]);
            scheduler.setHarmonyProgression([['C4']]);
            scheduler.setHarmonyProgression([['D4']]);
            scheduler.setPattern(makePattern());
            scheduler.start();
            run(scheduler, 0.2);
            expect(poly.playChord.mock.calls[0][0]).toEqual(['D4']);
        });
    });

    describe('folk forms', () => {
        it('builds two parts separated by a silent bar', () => {
            const sections = buildFormSections('Zamba', 4);
            expect(sections[0]).toMatchObject({ audioId: 'Precuenta', bars: 2, part: 1 });
            expect(sections.find(s => s.audioId === 'Silencio')).toBeDefined();
            expect(sections.at(-1)).toMatchObject({ isFinal: true, part: 2 });
            expect(sections.filter(s => s.isFinal)).toHaveLength(2);
            expect(buildFormSections('Gato Norteño', 8).some(s => s.audioId === 'Zapateo')).toBe(true);
            expect(buildFormSections('Chacarera Doble', 8).filter(s => s.audioId === 'Estrofa')[0].bars).toBe(12);
        });

        it('only plays the click during the count-in and silences the bombo skin in the intro', () => {
            scheduler.configureFormas(true, 'Chacarera Simple', 1);
            scheduler.setPattern(makePattern({
                instruments: ['bombo_leguero', 'click'],
                steps: [
                    { step: 1, instrument: 'bombo_leguero', velocity: 1, modifier: 'parche' },
                    { step: 2, instrument: 'bombo_leguero', velocity: 1, modifier: 'aro' },
                ]
            }));
            scheduler.setTempo(240);
            scheduler.start();
            run(scheduler, 1.95); // 2 bars of count-in
            expect(playsOf('bombo_leguero')).toHaveLength(0);
            expect(playsOf('click').length).toBeGreaterThan(0);

            run(scheduler, 0.85); // intro bar: only the rim
            const bombo = drum.play.mock.calls.filter(c => c[0] === 'bombo_leguero');
            expect(bombo.length).toBeGreaterThan(0);
            bombo.forEach(c => expect(c[3]).toBe('aro'));
        });

        it('stops by itself when the last bar has been heard and reports it once', () => {
            const onStopped = vi.fn();
            const events: PlaybackEvent[] = [];
            scheduler.setOnStopped(onStopped);
            scheduler.setOnPlaybackUpdate(e => events.push(e));
            scheduler.configureFormas(true, 'Zamba', 1);
            scheduler.setPattern(makePattern());
            scheduler.setTempo(300); // 0.8 s per bar
            scheduler.start();

            const totalBars = buildFormSections('Zamba', 1).reduce((a, s) => a + s.bars, 0);
            const lengthSeconds = totalBars * 0.8 + 0.05;
            run(scheduler, lengthSeconds - 0.2);
            expect(onStopped).not.toHaveBeenCalled();
            const lastNote = Math.max(...drum.play.mock.calls.map(c => c[1] as number));
            expect(lastNote).toBeLessThan(lengthSeconds);

            run(scheduler, 0.5);
            expect(onStopped).toHaveBeenCalledTimes(1);
            expect(onStopped).toHaveBeenCalledWith('form_finished');
            expect(scheduler.getIsPlaying()).toBe(false);
            expect(events.at(-1)?.formState).toMatchObject({ finished: true, totalFormBars: totalBars });
            expect(events.some(e => e.formState?.part === 2)).toBe(true);
        });
    });
});
