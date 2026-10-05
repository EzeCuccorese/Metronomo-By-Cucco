import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    loadPianoNote, loadPianoSamples, MAX_VOICES, PIANO_SAMPLE_FILES, PianoSampler, pickSample,
    velocityToCutoff, velocityToGain,
} from './PianoSampler';
import type { PianoFallback } from './PianoSampler';

// --- Minimal Web Audio double ---
const param = (value = 1) => ({
    value,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
});

type FakeSource = ReturnType<typeof makeSource>;
const makeSource = () => {
    const listeners: (() => void)[] = [];
    return {
        buffer: null as unknown,
        playbackRate: param(1),
        connect: vi.fn(),
        start: vi.fn(),
        disconnect: vi.fn(),
        stop: vi.fn(),
        addEventListener: vi.fn((_: string, cb: () => void) => listeners.push(cb)),
        end: () => listeners.forEach(l => l()),
    };
};

type FakeGain = { gain: ReturnType<typeof param>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };

class FakeContext {
    currentTime = 0;
    destination = {};
    sources: FakeSource[] = [];
    gains: FakeGain[] = [];
    filters: { frequency: { value: number } }[] = [];
    decodeAudioData = vi.fn(async (data: ArrayBuffer) => ({ id: (data as unknown as { url: string }).url }) as unknown as AudioBuffer);
    createGain(): FakeGain {
        const g: FakeGain = { gain: param(1), connect: vi.fn(), disconnect: vi.fn() };
        this.gains.push(g);
        return g;
    }
    createBiquadFilter() {
        const f = { type: '', frequency: param(0), Q: param(0), connect: vi.fn(), disconnect: vi.fn() };
        this.filters.push(f);
        return f;
    }
    createBufferSource() {
        const s = makeSource();
        this.sources.push(s);
        return s;
    }
}

const okFetch = (failing: (url: string) => boolean = () => false) => vi.fn(async (url: string) => {
    if (failing(url)) return { ok: false, status: 404 } as Response;
    return { ok: true, arrayBuffer: async () => ({ url }) } as unknown as Response;
});

describe('sample selection', () => {
    const available = [36, 39, 42, 45, 48, 60, 72, 84];

    it('plays sampled notes untransposed', () => {
        expect(pickSample(60, available)).toEqual({ sample: 60, rate: 1 });
    });

    it('transposes from the nearest sample with playbackRate', () => {
        const up = pickSample(37, available)!;
        expect(up.sample).toBe(36);
        expect(up.rate).toBeCloseTo(Math.pow(2, 1 / 12), 9);
        const down = pickSample(38, available)!;
        expect(down.sample).toBe(39);
        expect(down.rate).toBeCloseTo(Math.pow(2, -1 / 12), 9);
    });

    it('prefers the sample above on ties, and clamps outside the range', () => {
        expect(pickSample(54, available)!.sample).toBe(60); // 48 and 60 are both 6 away
        expect(pickSample(96, available)).toEqual({ sample: 84, rate: 2 });
        expect(pickSample(60, [])).toBeNull();
    });

    it('covers C2..C6 every minor third (17 files)', () => {
        expect(PIANO_SAMPLE_FILES).toHaveLength(17);
        expect(PIANO_SAMPLE_FILES).toContain('Ds3');
        expect(PIANO_SAMPLE_FILES).toContain('C6');
    });
});

describe('velocity', () => {
    it('maps velocity to a curved gain and a darker tone when soft', () => {
        expect(velocityToGain(1)).toBeCloseTo(1, 9);
        expect(velocityToGain(0)).toBeCloseTo(0.08, 9);
        expect(velocityToGain(0.5)).toBeLessThan(0.5);
        expect(velocityToGain(2)).toBeCloseTo(1, 9);
        expect(velocityToCutoff(0.3)).toBeLessThan(velocityToCutoff(1));
        expect(velocityToCutoff(1)).toBeGreaterThan(15000);
        expect(velocityToCutoff(-1)).toBe(1400);
    });
});

describe('loading', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('returns null when the note cannot be fetched', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
        const ctx = new FakeContext();
        expect(await loadPianoNote(ctx as unknown as BaseAudioContext, 'C4')).toBeNull();
    });

    it('does not cache a failed load, so a later call retries', async () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', okFetch(() => true));
        const ctx = new FakeContext() as unknown as BaseAudioContext;
        expect((await loadPianoSamples(ctx)).size).toBe(0);
        vi.stubGlobal('fetch', okFetch());
        expect((await loadPianoSamples(ctx)).size).toBe(17);
        errors.mockRestore();
    });

    it('loads the Opus sample with a plain fetch of the absolute path', async () => {
        vi.stubGlobal('fetch', okFetch());
        const ctx = new FakeContext();
        const buffer = await loadPianoNote(ctx as unknown as BaseAudioContext, 'C4');
        expect(buffer).toEqual({ id: '/audio/piano/C4.ogg' });
    });

    it('decodes every note once per context and keys them by MIDI number', async () => {
        const fetchMock = okFetch(url => url.includes('/A5.'));
        vi.stubGlobal('fetch', fetchMock);
        const ctx = new FakeContext() as unknown as BaseAudioContext;
        const [a, b] = await Promise.all([loadPianoSamples(ctx), loadPianoSamples(ctx)]);
        expect(a).toBe(b);
        expect(a.size).toBe(16); // A5 is missing in both formats
        expect(a.has(60)).toBe(true);
        expect(a.has(51)).toBe(true); // Ds3
        expect(a.has(81)).toBe(false);
    });
});

describe('PianoSampler', () => {
    let ctx: FakeContext;
    let fallback: ReturnType<typeof vi.fn<PianoFallback>>;
    let sampler: PianoSampler;

    beforeEach(() => {
        vi.stubGlobal('fetch', okFetch());
        ctx = new FakeContext();
        fallback = vi.fn<PianoFallback>();
        sampler = new PianoSampler(ctx as unknown as BaseAudioContext, fallback);
    });
    afterEach(() => vi.unstubAllGlobals());

    const ready = async () => {
        const statuses: string[] = [];
        sampler.onStatusChange(s => statuses.push(s));
        expect(await sampler.load()).toBe(true);
        expect(sampler.isReady).toBe(true);
        return statuses;
    };

    it('uses the fallback voice (and starts loading) until the samples are ready', async () => {
        expect(sampler.status).toBe('idle');
        expect(sampler.noteOn(60, 1, 0.8)).toBeNull();
        expect(fallback).toHaveBeenCalledWith(60, 1, 0.8, 1.2);
        expect(sampler.status).toBe('loading');
        await sampler.load();
        expect(sampler.status).toBe('ready');
    });

    it('reports loading -> ready and only loads once', async () => {
        const statuses = await ready();
        expect(statuses).toEqual(['loading', 'ready']);
        await sampler.load();
        expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(17);
    });

    it('reports failure when nothing could be decoded', async () => {
        vi.stubGlobal('fetch', okFetch(() => true));
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        const other = new PianoSampler(new FakeContext() as unknown as BaseAudioContext, fallback);
        expect(await other.load()).toBe(false);
        expect(other.status).toBe('failed');
        expect(errors).toHaveBeenCalled();
        other.noteOn(60, 0, 1);
        expect(fallback).toHaveBeenCalled();
        // The failed attempt is not remembered: a later load() retries.
        vi.stubGlobal('fetch', okFetch());
        expect(await other.load()).toBe(true);
        expect(other.status).toBe('ready');
        errors.mockRestore();
    });

    it('plays a sample transposed, velocity-shaped, on the requested bus', async () => {
        await ready();
        const id = sampler.noteOn(61, 2, 0.5, 'melody');
        expect(id).not.toBeNull();
        const src = ctx.sources.at(-1)!;
        expect(src.start).toHaveBeenCalledWith(2);
        expect(src.playbackRate.value).toBeCloseTo(Math.pow(2, 1 / 12), 9);
        expect(ctx.filters.at(-1)!.frequency.value).toBeCloseTo(velocityToCutoff(0.5), 6);
        const env = ctx.gains.at(-1)!;
        expect(env.gain.linearRampToValueAtTime).toHaveBeenCalledWith(velocityToGain(0.5), expect.any(Number));
        expect(sampler.activeVoiceCount).toBe(1);
        src.end();
        expect(sampler.activeVoiceCount).toBe(0);
        expect(ctx.filters.at(-1)).toMatchObject({ disconnect: expect.any(Function) });
        expect((ctx.filters.at(-1) as unknown as { disconnect: ReturnType<typeof vi.fn> }).disconnect).toHaveBeenCalled();
        expect(env.disconnect).toHaveBeenCalled();
        expect(src.disconnect).toHaveBeenCalled();
    });

    it('never schedules the attack in the past', async () => {
        await ready();
        ctx.currentTime = 5;
        sampler.noteOn(60, 4.99, 1);
        const env = ctx.gains.at(-1)!;
        expect(env.gain.setValueAtTime).toHaveBeenCalledWith(0, 5);
        expect(ctx.sources.at(-1)!.start).toHaveBeenCalledWith(5);
    });

    it('releases a note with a damper fade and stops the source afterwards', async () => {
        await ready();
        const id = sampler.noteOn(60, 0, 1);
        const env = ctx.gains.at(-1)!;
        sampler.noteOff(id, 1);
        expect(env.gain.cancelAndHoldAtTime).toHaveBeenCalledWith(1);
        expect(env.gain.setTargetAtTime).toHaveBeenCalledWith(0, 1, expect.any(Number));
        expect(ctx.sources.at(-1)!.stop).toHaveBeenCalled();
        // Releasing twice (or an unknown id) is harmless.
        sampler.noteOff(id, 2);
        sampler.noteOff(null, 2);
        sampler.noteOff(999, 2);
        expect(env.gain.setTargetAtTime).toHaveBeenCalledTimes(1);
    });

    it('sustain pedal: keys lifted while it is down keep ringing until it comes up', async () => {
        await ready();
        const held = sampler.noteOn(60, 0, 1);
        const lifted = sampler.noteOn(64, 0, 1);
        const [heldEnv, liftedEnv] = ctx.gains.slice(-2);
        sampler.setSustain(true);
        expect(sampler.sustaining).toBe(true);
        sampler.noteOff(lifted, 1);
        expect(liftedEnv.gain.setTargetAtTime).not.toHaveBeenCalled();
        sampler.setSustain(false, 2);
        expect(liftedEnv.gain.setTargetAtTime).toHaveBeenCalledWith(0, 2, expect.any(Number));
        // A key still held is untouched by the pedal coming up; its own release works as usual.
        expect(heldEnv.gain.setTargetAtTime).not.toHaveBeenCalled();
        sampler.noteOff(held, 3);
        expect(heldEnv.gain.setTargetAtTime).toHaveBeenCalledWith(0, 3, expect.any(Number));
    });

    it('sustain pedal only affects the live keyboard and silence() still cuts everything', async () => {
        await ready();
        sampler.setSustain(true);
        sampler.play(64, 0, 0.7, 0.5, 'melody');
        expect(ctx.gains.at(-1)!.gain.setTargetAtTime).toHaveBeenCalled(); // melody ignores the pedal
        sampler.noteOff(sampler.noteOn(60, 0, 1), 1);
        const env = ctx.gains.at(-1)!;
        sampler.silence(['live']);
        expect(env.gain.setTargetAtTime).toHaveBeenCalled();
        expect(sampler.activeVoiceCount).toBe(1);
    });

    it('tolerates a source that already stopped', async () => {
        await ready();
        const id = sampler.noteOn(60, 0, 1);
        const env = ctx.gains.at(-1)!;
        ctx.sources.at(-1)!.stop.mockImplementation(() => { throw new Error('already stopped'); });
        expect(() => sampler.noteOff(id, 0.5)).not.toThrow();
        expect(env.gain.cancelAndHoldAtTime).toHaveBeenCalledWith(0.5);
    });

    it('schedules whole notes with play()', async () => {
        await ready();
        sampler.play(64, 3, 0.7, 0.5, 'harmony');
        const env = ctx.gains.at(-1)!;
        expect(env.gain.setTargetAtTime).toHaveBeenCalledWith(0, 3.5, expect.any(Number));
        // Fallback durations follow the note length.
        const cold = new PianoSampler(new FakeContext() as unknown as BaseAudioContext, fallback);
        cold.play(64, 3, 0.7, 0.5, 'harmony');
        expect(fallback).toHaveBeenLastCalledWith(64, 3, 0.7, 0.5);
    });

    it('steals the oldest voice beyond the voice limit', async () => {
        await ready();
        for (let i = 0; i < MAX_VOICES; i++) sampler.noteOn(48 + (i % 24), 0, 0.8);
        expect(sampler.activeVoiceCount).toBe(MAX_VOICES);
        const oldestEnv = ctx.gains[ctx.gains.length - MAX_VOICES];
        sampler.noteOn(72, 0, 0.8);
        expect(sampler.activeVoiceCount).toBe(MAX_VOICES);
        expect(oldestEnv.gain.setTargetAtTime).toHaveBeenCalled();
    });

    it('steals an already released voice when every voice is releasing', async () => {
        await ready();
        const ids = Array.from({ length: MAX_VOICES }, () => sampler.noteOn(60, 0, 0.8));
        ids.forEach(id => sampler.noteOff(id, 0));
        const oldestEnv = ctx.gains[ctx.gains.length - MAX_VOICES];
        const before = oldestEnv.gain.setTargetAtTime.mock.calls.length;
        sampler.noteOn(62, 0, 0.8);
        expect(sampler.activeVoiceCount).toBe(MAX_VOICES);
        // The forced fast fade is applied even though a release was already scheduled.
        expect(oldestEnv.gain.setTargetAtTime.mock.calls.length).toBe(before + 1);
    });

    it('silence() cuts only the requested buses', async () => {
        await ready();
        sampler.noteOn(60, 0, 1, 'live');
        sampler.play(64, 5, 1, 1, 'harmony'); // scheduled in the future
        sampler.play(67, 5, 1, 1, 'melody');
        expect(sampler.activeVoiceCount).toBe(3);
        sampler.silence(['harmony', 'melody']);
        expect(sampler.activeVoiceCount).toBe(1);
        sampler.silence();
        expect(sampler.activeVoiceCount).toBe(0);
    });

    it('routes to a mixer node and scales the harmony bus with the harmony volume', () => {
        const output = ctx.gains[0];
        const harmonyBus = ctx.gains[1];
        const node = {} as AudioNode;
        sampler.connect(node);
        expect(output.disconnect).toHaveBeenCalled();
        expect(output.connect).toHaveBeenLastCalledWith(node);
        sampler.setHarmonyVolume(0.3);
        expect(harmonyBus.gain.value).toBeCloseTo(0.6, 9);
        sampler.setHarmonyVolume(5);
        expect(harmonyBus.gain.value).toBe(1.5);
    });

    it('dispose() silences, disconnects and ignores a late load', async () => {
        const pending = sampler.load();
        sampler.dispose();
        expect(await pending).toBe(false);
        expect(ctx.gains[0].disconnect).toHaveBeenCalled();
    });

    it('reports a failed load when the loader rejects', async () => {
        const context = new FakeContext();
        // Defensive path: the loader itself rejecting (it normally resolves with what it got).
        const broken = new PianoSampler(context as unknown as BaseAudioContext, null);
        const spy = vi.spyOn(Promise, 'all').mockReturnValueOnce(Promise.reject(new Error('boom')));
        expect(await broken.load()).toBe(false);
        expect(broken.status).toBe('failed');
        spy.mockRestore();
        broken.noteOn(60, 0, 1); // no fallback configured: silently nothing
    });
});
