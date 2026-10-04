import { describe, it, expect } from 'vitest';
import { isMelody, melodyNotesForStep, normalizeMelody, MAX_MELODY_NOTES } from './melody';
import type { Melody } from './melody';

const melody = (notes: Melody['notes'], bars = 1, subdivision = 4): Melody => ({ bars, subdivision, notes });

describe('isMelody (persistence validation)', () => {
    it('accepts a well-formed melody', () => {
        expect(isMelody(melody([{ step: 0, midi: 60, velocity: 0.8, length: 1 }]))).toBe(true);
        expect(isMelody(melody([], 4, 16))).toBe(true);
    });

    it.each([
        ['not an object', 'x'],
        ['null', null],
        ['bad bar count', { bars: 5, subdivision: 4, notes: [] }],
        ['bad subdivision', { bars: 1, subdivision: 0, notes: [] }],
        ['huge subdivision', { bars: 1, subdivision: 96, notes: [] }],
        ['notes not an array', { bars: 1, subdivision: 4, notes: {} }],
        ['step outside the loop', melody([{ step: 4, midi: 60, velocity: 1, length: 1 }])],
        ['negative step', melody([{ step: -1, midi: 60, velocity: 1, length: 1 }])],
        ['fractional step', melody([{ step: 0.5, midi: 60, velocity: 1, length: 1 }])],
        ['note off the piano', melody([{ step: 0, midi: 12, velocity: 1, length: 1 }])],
        ['silent velocity', melody([{ step: 0, midi: 60, velocity: 0, length: 1 }])],
        ['too loud', melody([{ step: 0, midi: 60, velocity: 1.5, length: 1 }])],
        ['zero length', melody([{ step: 0, midi: 60, velocity: 1, length: 0 }])],
        ['longer than the loop', melody([{ step: 0, midi: 60, velocity: 1, length: 5 }])],
        ['note as string', melody(['C4' as never])],
    ])('rejects %s', (_, value) => {
        expect(isMelody(value)).toBe(false);
    });

    it('rejects absurdly long note lists', () => {
        const notes = Array.from({ length: MAX_MELODY_NOTES + 1 }, () => ({ step: 0, midi: 60, velocity: 1, length: 1 }));
        expect(isMelody(melody(notes))).toBe(false);
    });
});

describe('melodyNotesForStep', () => {
    const m = melody([
        { step: 0, midi: 60, velocity: 0.9, length: 2 },
        { step: 3, midi: 64, velocity: 0.5, length: 1 },
        { step: 5, midi: 67, velocity: 0.7, length: 1 }, // bar 2, step 1
    ], 2, 4);

    it('returns the notes of a step on the same grid, with offsets and durations', () => {
        expect(melodyNotesForStep(m, 0, 0, 4, 2)).toEqual([{ midi: 60, offset: 0, duration: 1, velocity: 0.9 }]);
        expect(melodyNotesForStep(m, 0, 3, 4, 2)).toEqual([{ midi: 64, offset: 0, duration: 0.5, velocity: 0.5 }]);
        expect(melodyNotesForStep(m, 0, 1, 4, 2)).toEqual([]);
        expect(melodyNotesForStep(m, 1, 1, 4, 2).map(n => n.midi)).toEqual([67]);
        expect(melodyNotesForStep(m, 1, 0, 4, 2)).toEqual([]);
    });

    it('lands on time when the pattern uses a finer grid than the recording', () => {
        // Recorded in quarters, played on a 16th grid: quarter 3 = 16th 12.
        const notes = melodyNotesForStep(m, 0, 12, 16, 2);
        expect(notes).toHaveLength(1);
        expect(notes[0].offset).toBeCloseTo(0, 9);
        expect(melodyNotesForStep(m, 0, 13, 16, 2)).toEqual([]);
    });

    it('places a note inside a coarser step with the right offset', () => {
        const fine = melody([{ step: 3, midi: 72, velocity: 1, length: 1 }], 1, 16); // 4th 16th
        const [n] = melodyNotesForStep(fine, 0, 0, 4, 2); // quarter step 0 covers 16ths 0-3
        expect(n.offset).toBeCloseTo(3 / 16 * 2, 9);
        expect(n.duration).toBeCloseTo(2 / 16, 9);
    });
});

describe('normalizeMelody', () => {
    it('sorts notes and keeps the louder duplicate', () => {
        const out = normalizeMelody(melody([
            { step: 2, midi: 62, velocity: 0.4, length: 1 },
            { step: 0, midi: 64, velocity: 0.4, length: 1 },
            { step: 0, midi: 60, velocity: 0.5, length: 1 },
            { step: 0, midi: 60, velocity: 0.9, length: 2 },
        ]));
        expect(out.notes).toEqual([
            { step: 0, midi: 60, velocity: 0.9, length: 2 },
            { step: 0, midi: 64, velocity: 0.4, length: 1 },
            { step: 2, midi: 62, velocity: 0.4, length: 1 },
        ]);
    });

    it('caps the number of notes', () => {
        const notes = Array.from({ length: MAX_MELODY_NOTES + 10 }, (_, i) => ({ step: i % 16, midi: 21 + (i % 80), velocity: 1, length: 1 }));
        expect(normalizeMelody(melody(notes, 4, 4)).notes.length).toBeLessThanOrEqual(MAX_MELODY_NOTES);
    });
});
