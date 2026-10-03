import { describe, it, expect } from 'vitest';
import { TIME_SIGNATURES, changeTimeSignature, remapSteps, sameSignature } from './patternEditing';

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

    describe('changeTimeSignature', () => {
        const kick = (step: number) => ({ step, instrument: 'kick' as const, velocity: 1 });

        it('keeps sixteenths as sixteenths when going from 4/4 to 6/8', () => {
            const result = changeTimeSignature({ timeSignature: [4, 4], subdivision: 16, steps: [kick(1), kick(5), kick(13)] }, [6, 8]);
            expect(result.subdivision).toBe(12); // 2 sixteenths per eighth
            // Beat 2 of 4/4 (step 5) is still one quarter after the downbeat: step 5 of the 6/8 grid.
            // Beat 4 (step 13) falls beyond the shorter 6/8 bar and is dropped.
            expect(result.steps.map(s => s.step)).toEqual([1, 5]);
        });

        it('keeps 3/4 <-> 6/8 grids identical (same bar length, hemiola)', () => {
            const steps = [kick(1), kick(5), kick(9)];
            const to68 = changeTimeSignature({ timeSignature: [3, 4], subdivision: 12, steps }, [6, 8]);
            expect(to68.subdivision).toBe(12);
            expect(to68.steps.map(s => s.step)).toEqual([1, 5, 9]);
            const back = changeTimeSignature(to68, [3, 4]);
            expect(back.subdivision).toBe(12);
            expect(back.steps.map(s => s.step)).toEqual([1, 5, 9]);
        });

        it('falls back to the closest offered grid and remaps by time', () => {
            // 4/4 in sextuplets has no exact 6/8 equivalent (would be 3 per eighth = offered) -> exact here
            const sext = changeTimeSignature({ timeSignature: [4, 4], subdivision: 24, steps: [kick(1), kick(7)] }, [6, 8]);
            expect(sext.subdivision).toBe(18);
            expect(sext.steps.map(s => s.step)).toEqual([1, 7]);
            // 6/8 in thirty-seconds (4 per eighth) -> 4/4 would need 8 per quarter: closest offered is 6
            const fine = changeTimeSignature({ timeSignature: [6, 8], subdivision: 24, steps: [kick(1), kick(9)] }, [4, 4]);
            expect(fine.subdivision).toBe(24);
            expect(fine.steps.map(s => s.step)).toEqual([1, 7]); // a quarter after the downbeat
        });
    });
});
