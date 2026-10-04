import { afterEach, describe, expect, it, vi } from 'vitest';
import Scheduler from './Scheduler';
import { PRESET_PATTERNS } from '../rhythms/RhythmPatterns';
import { frames, render, createOfflineContext } from '../test/browser/audioHarness';

// The Worker clock is replaced by the harness: it ticks the scheduler at audio-time intervals
// while the OfflineAudioContext renders, which is what the real clock does in wall-clock time.
vi.mock('./clock.worker?worker', () => ({
    default: class {
        onmessage: ((e: MessageEvent) => void) | null = null;
        postMessage() {}
        terminate() {}
    },
}));

const metronome = PRESET_PATTERNS.find(p => p.id === 'metronome_4_4')!;

/** Renders `seconds` of a running Scheduler. */
async function renderScheduler(seconds: number, setup: (scheduler: Scheduler) => void = () => {}) {
    const ctx = createOfflineContext(seconds);
    const scheduler = new Scheduler();
    await scheduler.whenReady();
    setup(scheduler);
    scheduler.setPattern(metronome);
    scheduler.setTempo(120);
    scheduler.start();
    const tick = () => (scheduler as unknown as { scheduler(): void }).scheduler();
    const audio = await render(ctx, tick);
    scheduler.dispose();
    return audio;
}

describe('Scheduler (real Web Audio, offline render)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('places the metronome click on every beat of a 4/4 bar at 120 BPM', async () => {
        const audio = await renderScheduler(2.3);
        const onsets = audio.onsets();

        // First click 50 ms after start(), then one every 0.5 s.
        expect(onsets).toHaveLength(5);
        onsets.forEach((onset, i) => {
            expect(Math.abs(onset.time - (0.05 + i * 0.5))).toBeLessThan(frames(8));
        });
    });

    it('accents the downbeat: it is louder than the other beats', async () => {
        const audio = await renderScheduler(2.3);
        const [downbeat, ...others] = audio.onsets();

        expect(downbeat.peak).toBeGreaterThan(0.01);
        others.slice(0, 3).forEach(o => expect(downbeat.peak).toBeGreaterThan(o.peak * 1.3));
        // The next bar's downbeat is accented again.
        expect(audio.onsets()[4].peak).toBeGreaterThan(others[0].peak * 1.3);
    });

    it('follows the tempo: 60 BPM doubles the distance between clicks', async () => {
        const ctx = createOfflineContext(2.3);
        const scheduler = new Scheduler();
        await scheduler.whenReady();
        scheduler.setPattern(metronome);
        scheduler.setTempo(60);
        scheduler.start();
        const audio = await render(ctx, () => (scheduler as unknown as { scheduler(): void }).scheduler());
        scheduler.dispose();

        const times = audio.onsets().map(o => o.time);
        expect(times).toHaveLength(3);
        expect(times[1] - times[0]).toBeCloseTo(1, 2);
        expect(times[2] - times[1]).toBeCloseTo(1, 2);
    });

    it('a muted channel is silent', async () => {
        const audio = await renderScheduler(1.2, scheduler => scheduler.setChannelMute('click', true));
        expect(audio.maxPeak).toBeLessThan(1e-4);
    });

    it('stops sounding after stop()', async () => {
        const ctx = createOfflineContext(2);
        const scheduler = new Scheduler();
        await scheduler.whenReady();
        scheduler.setPattern(metronome);
        scheduler.setTempo(120);
        scheduler.start();
        const audio = await render(ctx, time => {
            if (time >= 0.7 && scheduler.getIsPlaying()) scheduler.stop();
            (scheduler as unknown as { scheduler(): void }).scheduler();
        });
        scheduler.dispose();

        // Clicks at 0.05, 0.55 (and the 1.05 one was already queued only if scheduled before 0.7: it was not).
        expect(audio.onsets().length).toBeLessThanOrEqual(3);
        expect(audio.peak(1.3, 2)).toBeLessThan(1e-4);
    });
});
