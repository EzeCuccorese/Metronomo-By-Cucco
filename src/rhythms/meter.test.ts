import { describe, it, expect } from 'vitest';
import { clampBpm, getBarDurationSeconds, getClickVelocity, getGroupCount, isCompoundMeter, isGroupStart, isPulseStart, MAX_BPM, MIN_BPM } from './meter';

describe('meter', () => {
    it('clamps and rounds BPM, falling back to 120 for garbage', () => {
        expect(clampBpm(10)).toBe(MIN_BPM);
        expect(clampBpm(999)).toBe(MAX_BPM);
        expect(clampBpm(120.6)).toBe(121);
        expect(clampBpm(NaN)).toBe(120);
        expect(clampBpm(Infinity)).toBe(120);
    });

    it('detects compound meters', () => {
        expect(isCompoundMeter([6, 8])).toBe(true);
        expect(isCompoundMeter([12, 8])).toBe(true);
        expect(isCompoundMeter([9, 8])).toBe(true);
        expect(isCompoundMeter([3, 8])).toBe(false);
        expect(isCompoundMeter([3, 4])).toBe(false);
        expect(getGroupCount([6, 8])).toBe(2);
        expect(getGroupCount([3, 4])).toBe(3);
    });

    it('computes bar length with BPM referring to the quarter note', () => {
        expect(getBarDurationSeconds(120, [4, 4])).toBeCloseTo(2);
        expect(getBarDurationSeconds(120, [6, 8])).toBeCloseTo(1.5);
        expect(getBarDurationSeconds(120, [3, 4])).toBeCloseTo(getBarDurationSeconds(120, [6, 8]));
    });

    it('finds pulses and beat groups even when steps per pulse is not an integer', () => {
        expect([0, 4, 8, 12].every(i => isPulseStart(i, 16, [4, 4]))).toBe(true);
        expect(isPulseStart(2, 16, [4, 4])).toBe(false);
        // 5 steps across a 4/4 bar never align except the downbeat
        expect([1, 2, 3, 4].some(i => isPulseStart(i, 5, [4, 4]))).toBe(false);
        expect(isGroupStart(6, 12, [6, 8])).toBe(true);
        expect(isGroupStart(2, 12, [6, 8])).toBe(false);
    });

    it('returns click accents: downbeat, beat, pulse', () => {
        expect(getClickVelocity(0, 12, [6, 8])).toBe(1);
        expect(getClickVelocity(6, 12, [6, 8])).toBe(0.7);
        expect(getClickVelocity(2, 12, [6, 8])).toBe(0.45);
        expect(getClickVelocity(1, 12, [6, 8])).toBeNull();
    });
});
