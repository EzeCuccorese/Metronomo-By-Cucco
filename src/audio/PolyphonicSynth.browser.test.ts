import { afterEach, describe, expect, it } from 'vitest';
import { PolyphonicSynth } from './PolyphonicSynth';
import { frames, render, createOfflineContext, restoreAudioContext } from '../test/browser/audioHarness';

const C_MAJOR = ['C4', 'E4', 'G4'];

describe('PolyphonicSynth (real Web Audio, offline render)', () => {
    afterEach(restoreAudioContext);

    async function renderChord(style: Parameters<PolyphonicSynth['playChord']>[3], duration: number, beats = 2) {
        const ctx = createOfflineContext(3);
        const synth = new PolyphonicSynth();
        synth.playChord(C_MAJOR, duration, 0.5, style, [], beats);
        const audio = await render(ctx);
        synth.dispose();
        return audio;
    }

    it('keeps a pad silent until its start and sounding through the segment', async () => {
        const audio = await renderChord('pad', 1);

        expect(audio.peak(0, 0.49)).toBeLessThan(1e-4);
        expect(audio.onsets()[0].time).toBeGreaterThanOrEqual(0.5);
        expect(audio.onsets()[0].time).toBeLessThan(0.5 + frames(2400)); // within 50 ms of the start
        expect(audio.peak(0.8, 1.2)).toBeGreaterThan(0.01);
    });

    it('releases the pad after the segment', async () => {
        const audio = await renderChord('pad', 1);

        expect(audio.peak(2.6, 3)).toBeLessThan(1e-3);
    });

    it('plays "quarters" on every beat of the segment', async () => {
        // 4 beats in a 2 s segment starting at 0.5 s -> a chord every 0.5 s.
        const audio = await renderChord('quarters', 2, 4);
        const onsets = audio.onsets({ quietSeconds: 0.04 });

        expect(onsets).toHaveLength(4);
        onsets.forEach((onset, i) => {
            expect(Math.abs(onset.time - (0.5 + i * 0.5))).toBeLessThan(0.02);
        });
    });

    it('plays "offbeats" half a beat after each beat', async () => {
        const audio = await renderChord('offbeats', 2, 4);
        const onsets = audio.onsets({ quietSeconds: 0.04 });

        expect(onsets.length).toBeGreaterThanOrEqual(4);
        onsets.slice(0, 4).forEach((onset, i) => {
            expect(Math.abs(onset.time - (0.5 + i * 0.5 + 0.25))).toBeLessThan(0.02);
        });
    });

    it('silence() fades the harmony out', async () => {
        const ctx = createOfflineContext(2);
        const synth = new PolyphonicSynth();
        synth.playChord(C_MAJOR, 1.5, 0.1, 'pad');
        const audio = await render(ctx, time => {
            if (Math.abs(time - 0.5) < 0.01) synth.silence(0.02);
        });

        expect(audio.peak(0.3, 0.45)).toBeGreaterThan(0.01);
        expect(audio.peak(0.6, 1.6)).toBeLessThan(1e-3);
    });

    it('a louder volume setting raises the level', async () => {
        const render1 = async (volume: number) => {
            const ctx = createOfflineContext(1.5);
            const synth = new PolyphonicSynth();
            synth.setVolume(volume);
            synth.playChord(C_MAJOR, 1, 0.1, 'pad');
            return render(ctx);
        };
        const quiet = await render1(0.1);
        const loud = await render1(0.4);

        expect(loud.maxPeak).toBeGreaterThan(quiet.maxPeak * 2);
    });
});
