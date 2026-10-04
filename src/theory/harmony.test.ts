import { describe, expect, it } from 'vitest';
import { buildDiatonicChord, chordSymbol, isModeId, MODES, scaleChromas } from './harmony';

const byValue = (a: number, b: number) => a - b;

describe('buildDiatonicChord', () => {
    it('spells seventh chords of the major scale', () => {
        const chords = [0, 1, 2, 3, 4, 5, 6].map(i => buildDiatonicChord('C', 'major', i, 4, true));
        expect(chords.map(c => c.degree)).toEqual(['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']);
        expect(chords.map(c => c.symbol)).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5']);
        expect(chords[6].notes).toEqual(['B4', 'D5', 'F5', 'A5']);
    });

    it('uses proper spelling instead of sharps (Bb in F major, flats in Eb)', () => {
        expect(buildDiatonicChord('F', 'major', 3, 4).notes).toEqual(['Bb4', 'D5', 'F5']);
        expect(buildDiatonicChord('Eb', 'major', 4, 3).notes).toEqual(['Bb3', 'D4', 'F4']);
        expect(buildDiatonicChord('E', 'major', 5, 4).notes).toEqual(['C#5', 'E5', 'G#5']);
    });

    it('builds the extra modes with the right degrees', () => {
        const degrees = (mode: Parameters<typeof buildDiatonicChord>[1]) =>
            [0, 1, 2, 3, 4, 5, 6].map(i => buildDiatonicChord('C', mode, i, 4).degree);
        expect(degrees('phrygian')).toEqual(['i', 'II', 'III', 'iv', 'v°', 'VI', 'vii']);
        expect(degrees('lydian')).toEqual(['I', 'II', 'iii', 'iv°', 'V', 'vi', 'vii']);
        expect(degrees('locrian')).toEqual(['i°', 'II', 'iii', 'iv', 'V', 'VI', 'vii']);
        expect(degrees('harmonic_minor')).toEqual(['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°']);
        expect(degrees('melodic_minor')).toEqual(['i', 'ii', 'III+', 'IV', 'V', 'vi°', 'vii°']);
    });

    it('respells double accidentals without changing the sounding pitch', () => {
        const { notes } = buildDiatonicChord('C#', 'lydian', 3, 4); // F## A# C#
        expect(notes.every(n => /^[A-G][#b]?\d$/.test(n))).toBe(true);
        expect(notes[0]).toBe('G4');
    });
});

describe('chordSymbol', () => {
    it('names triads, sevenths and falls back to Tonal for other shapes', () => {
        expect(chordSymbol(['C4', 'E4', 'G4'])).toBe('C');
        expect(chordSymbol(['A4', 'C5', 'E5'])).toBe('Am');
        expect(chordSymbol(['B4', 'D5', 'F5'])).toBe('Bdim');
        expect(chordSymbol(['G4', 'B4', 'D5', 'F5'])).toBe('G7');
        expect(chordSymbol(['C4', 'D4', 'G4'])).toMatch(/^C/);
        expect(chordSymbol([])).toBe('');
    });
});

describe('modes and scales', () => {
    it('lists every mode once and validates ids', () => {
        expect(new Set(MODES.map(m => m.id)).size).toBe(MODES.length);
        expect(MODES.every(m => isModeId(m.id))).toBe(true);
        expect(isModeId('bebop')).toBe(false);
    });

    it('computes scale pitch classes for the new modes', () => {
        expect(scaleChromas(0, 'dorian').sort(byValue)).toEqual([0, 2, 3, 5, 7, 9, 10]);
        expect(scaleChromas(4, 'phrygian').sort(byValue)).toEqual([0, 2, 4, 5, 7, 9, 11]);
        expect(scaleChromas(9, 'harmonic_minor').sort(byValue)).toEqual([0, 2, 4, 5, 8, 9, 11]);
        expect(scaleChromas(9, 'melodic_minor').sort(byValue)).toEqual([0, 2, 4, 6, 8, 9, 11]);
    });
});
