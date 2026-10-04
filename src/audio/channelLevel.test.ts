import { describe, it, expect } from 'vitest';
import { ANALYSED_CHANNELS, meterFromPeak, peakLevel } from './channelLevel';
import { CHANNEL_IDS } from './instrumentChannels';

describe('channelLevel', () => {
    it('peakLevel returns the largest absolute sample', () => {
        expect(peakLevel(new Float32Array([0, -0.5, 0.25]))).toBe(0.5);
        expect(peakLevel([])).toBe(0);
    });

    it('meterFromPeak boosts and clamps to 1', () => {
        expect(meterFromPeak(0)).toBe(0);
        expect(meterFromPeak(0.1)).toBeCloseTo(0.3);
        expect(meterFromPeak(2)).toBe(1);
    });

    it('analyses the synth and piano strips, which are not pattern steps', () => {
        expect(ANALYSED_CHANNELS).toEqual(['synth', 'piano']);
        ANALYSED_CHANNELS.forEach(c => expect(CHANNEL_IDS).toContain(c));
    });
});
