import { afterEach, describe, expect, it, vi } from 'vitest';
import { PianoSampler } from './PianoSampler';
import { frames, render, createOfflineContext } from '../../test/browser/audioHarness';

describe('PianoSampler (real Web Audio, offline render)', () => {
    afterEach(() => vi.unstubAllGlobals());

    async function renderNotes(notes: Array<{ midi: number; time: number; velocity: number; duration: number }>) {
        const ctx = createOfflineContext(3);
        const piano = new PianoSampler(ctx);
        expect(await piano.load()).toBe(true); // real Ogg Opus samples decode in Chromium
        notes.forEach(n => piano.play(n.midi, n.time, n.velocity, n.duration, 'harmony'));
        const audio = await render(ctx);
        piano.dispose();
        return audio;
    }

    it('starts a note at its scheduled time and stays silent before it', async () => {
        const audio = await renderNotes([{ midi: 60, time: 0.5, velocity: 0.8, duration: 1 }]);
        const [onset] = audio.onsets();

        expect(audio.peak(0, 0.49)).toBeLessThan(1e-4);
        expect(onset.time).toBeGreaterThanOrEqual(0.5);
        expect(onset.time).toBeLessThan(0.5 + frames(2400));
        expect(onset.peak).toBeGreaterThan(0.01);
    });

    it('plays harder notes louder', async () => {
        const audio = await renderNotes([
            { midi: 60, time: 0.3, velocity: 0.9, duration: 0.5 },
            { midi: 60, time: 1.5, velocity: 0.3, duration: 0.5 },
        ]);
        const [hard, soft] = audio.onsets({ quietSeconds: 0.2 });

        expect(hard.peak).toBeGreaterThan(soft.peak * 1.5);
    });

    it('releases a note after its duration', async () => {
        const audio = await renderNotes([{ midi: 64, time: 0.2, velocity: 0.8, duration: 0.5 }]);

        expect(audio.peak(0.3, 0.6)).toBeGreaterThan(0.01);
        expect(audio.peak(1.5, 3)).toBeLessThan(1e-3);
    });
});
