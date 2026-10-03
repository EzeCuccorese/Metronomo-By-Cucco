import { describe, it, expect } from 'vitest';
import { TIME_SIGNATURES, remapSteps, sameSignature } from './patternEditing';

describe('patternEditing', () => {
    it('uses real time signatures (6/8 is [6, 8], not [2, 8])', () => {
        expect(TIME_SIGNATURES.find(t => t.label === '6/8')?.value).toEqual([6, 8]);
        expect(TIME_SIGNATURES.find(t => t.label === '12/8')?.value).toEqual([12, 8]);
        expect(sameSignature([6, 8], [6, 8])).toBe(true);
        expect(sameSignature([6, 8], [3, 4])).toBe(false);
    });

    it('remaps steps to the closest position of the new grid', () => {
        const steps = [
            { step: 1, instrument: 'kick' as const, velocity: 1 },
            { step: 3, instrument: 'snare' as const, velocity: 1 },
        ];
        expect(remapSteps(steps, 4, 8).map(s => s.step)).toEqual([1, 5]);
        expect(remapSteps(steps, 4, 2).map(s => s.step)).toEqual([1, 2]);
    });

    it('drops collisions and steps that fall outside the grid', () => {
        const steps = [
            { step: 1, instrument: 'kick' as const, velocity: 1 },
            { step: 2, instrument: 'kick' as const, velocity: 0.5 },
            { step: 16, instrument: 'hihat' as const, velocity: 1 },
        ];
        const result = remapSteps(steps, 16, 4);
        expect(result.filter(s => s.instrument === 'kick')).toHaveLength(1);
        expect(result.every(s => s.step <= 4)).toBe(true);
    });
});
