import { afterEach, describe, expect, it } from 'vitest';
import DrumSynthesizer from './DrumSynthesizer';
import { frames, render, createOfflineContext, restoreAudioContext } from '../test/browser/audioHarness';

describe('DrumSynthesizer (real Web Audio, offline render)', () => {
    afterEach(restoreAudioContext);

    async function renderHits(hits: Array<[instrument: string, time: number, velocity: number]>, setup: (s: DrumSynthesizer) => void = () => {}) {
        const ctx = createOfflineContext(1.5);
        const synth = new DrumSynthesizer();
        await synth.loadPromise;
        setup(synth);
        hits.forEach(([instrument, time, velocity]) => synth.play(instrument, time, velocity));
        const audio = await render(ctx);
        synth.dispose();
        return audio;
    }

    it('starts the click exactly at the scheduled time', async () => {
        const audio = await renderHits([['click', 0.25, 1], ['click', 0.75, 1]]);
        const onsets = audio.onsets();

        expect(onsets).toHaveLength(2);
        expect(Math.abs(onsets[0].time - 0.25)).toBeLessThan(frames(8));
        expect(Math.abs(onsets[1].time - 0.75)).toBeLessThan(frames(8));
    });

    it('scales the level with the velocity', async () => {
        const audio = await renderHits([['click', 0.2, 1], ['click', 0.7, 0.5], ['click', 1.2, 0.25]]);
        const [loud, medium, soft] = audio.onsets().map(o => o.peak);

        expect(loud).toBeGreaterThan(medium);
        expect(medium).toBeGreaterThan(soft);
        expect(soft).toBeGreaterThan(0.01);
    });

    it('is silent before the first hit and after its decay', async () => {
        const audio = await renderHits([['click', 0.5, 1]]);

        expect(audio.peak(0, 0.49)).toBeLessThan(1e-4);
        expect(audio.peak(0.9, 1.5)).toBeLessThan(1e-4);
    });

    it('a muted channel produces no sound while the others keep playing', async () => {
        const audio = await renderHits(
            [['click', 0.2, 1], ['kick', 0.7, 1]],
            synth => synth.setChannelMute('click', true),
        );

        expect(audio.peak(0.1, 0.6)).toBeLessThan(1e-4); // click, muted
        expect(audio.peak(0.65, 1.2)).toBeGreaterThan(0.01); // kick, still audible
    });

    it('unmuting restores the channel', async () => {
        const audio = await renderHits([['click', 0.2, 1]], synth => {
            synth.setChannelMute('click', true);
            synth.setChannelMute('click', false);
        });

        expect(audio.onsets()).toHaveLength(1);
    });

    it('routes each instrument through its own channel volume', async () => {
        const full = await renderHits([['click', 0.2, 1]]);
        const half = await renderHits([['click', 0.2, 1]], synth => synth.setChannelVolume('click', 0.5));

        expect(half.maxPeak).toBeCloseTo(full.maxPeak * 0.5, 1);
    });
});
