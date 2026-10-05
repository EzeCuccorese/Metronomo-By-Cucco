/**
 * Frozen copy of the hand-rolled theory code that Tonal.js replaced. The new Tonal-backed
 * implementation must produce the same sounding pitches, degree labels, Spanish names and
 * scale sets for every key, mode, degree and octave the old UI could produce.
 */
import { describe, expect, it } from 'vitest';
import {
    chordPitchClasses, isBlackKey, midiToNoteName, noteToMidi, scalePitchClasses,
    spanishNoteLabel, spanishNoteName,
} from '../audio/piano/notes';
import { buildDiatonicChord, KEYS } from './harmony';
import type { ModeId } from './harmony';

// --- legacy (verbatim logic) ---
const PITCH_CLASS: Record<string, number> = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6,
    G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11, 'B#': 0,
};
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SPANISH_NAMES = ['Do', 'Do', 'Re', 'Re', 'Mi', 'Fa', 'Fa', 'Sol', 'Sol', 'La', 'La', 'Si'];
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const oldPc = (m: number) => ((m % 12) + 12) % 12;

function oldNoteToMidi(note: string): number | null {
    const match = /^([A-G])([#b]?)(-?\d)$/.exec(note.trim());
    if (!match) return null;
    const pc = PITCH_CLASS[match[1] + match[2]];
    const octave = Number(match[3]);
    const octaveFix = match[1] + match[2] === 'B#' ? 1 : match[1] + match[2] === 'Cb' ? -1 : 0;
    return (octave + 1 + octaveFix) * 12 + pc;
}

const OLD_MODES = ['major', 'minor', 'dorian', 'mixolydian'] as const;
const OLD_INTERVALS: Record<string, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
};
const OLD_LABELS: Record<string, string[]> = {
    major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
    minor: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
    dorian: ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII'],
    mixolydian: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'VII'],
};
const NOTE_ORDER = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function oldChordNotes(rootKey: string, mode: string, degreeIndex: number, octave: number): string[] {
    const rootIdx = NOTE_ORDER.indexOf(rootKey);
    const iv = OLD_INTERVALS[mode];
    const i1 = iv[degreeIndex];
    const i2 = iv[(degreeIndex + 2) % 7] + (degreeIndex + 2 >= 7 ? 12 : 0);
    const i3 = iv[(degreeIndex + 4) % 7] + (degreeIndex + 4 >= 7 ? 12 : 0);
    const name = (off: number) => `${NOTE_ORDER[(rootIdx + off) % 12]}${octave + Math.floor((rootIdx + off) / 12)}`;
    return [name(i1), name(i2), name(i3)];
}

describe('Tonal vs legacy note helpers', () => {
    it('noteToMidi agrees on every spelling the app has ever produced', () => {
        const names = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'Fb', 'E#', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb', 'B#'];
        for (const n of names) {
            for (let o = 0; o <= 8; o++) expect(noteToMidi(`${n}${o}`), `${n}${o}`).toBe(oldNoteToMidi(`${n}${o}`));
        }
        for (const bad of ['H4', 'C', '', 'c4', '4', 'C#', 'C##4x']) expect(noteToMidi(bad), bad).toBe(oldNoteToMidi(bad));
    });

    it('midiToNoteName, black keys and Spanish names agree for every MIDI number', () => {
        for (let midi = 0; midi <= 127; midi++) {
            const pc = oldPc(midi);
            const oct = Math.floor(midi / 12) - 1;
            expect(midiToNoteName(midi)).toBe(`${SHARP_NAMES[pc]}${oct}`);
            expect(isBlackKey(midi)).toBe(BLACK_PCS.has(pc));
            expect(spanishNoteName(midi)).toBe(BLACK_PCS.has(pc) ? `${SPANISH_NAMES[pc]}♯` : SPANISH_NAMES[pc]);
            expect(spanishNoteLabel(midi)).toBe(`${SPANISH_NAMES[pc]}${BLACK_PCS.has(pc) ? ' sostenido' : ''} ${oct}`);
        }
    });

    it('major and minor scale pitch classes agree for all 12 tonics', () => {
        const steps = { major: OLD_INTERVALS.major, minor: OLD_INTERVALS.minor };
        for (let root = 0; root < 12; root++) {
            for (const mode of ['major', 'minor'] as const) {
                const expected = new Set(steps[mode].map(s => oldPc(root + s)));
                const byValue = (a: number, b: number) => a - b;
                expect([...scalePitchClasses(root, mode)].sort(byValue)).toEqual([...expected].sort(byValue));
            }
        }
    });
});

describe('Tonal vs legacy harmony builder', () => {
    it('every key x old mode x octave x degree sounds the same notes and keeps the same label', () => {
        let compared = 0;
        for (const key of KEYS) {
            for (const mode of OLD_MODES) {
                for (const octave of [3, 4, 5]) {
                    for (let degree = 0; degree < 7; degree++) {
                        const old = oldChordNotes(key, mode, degree, octave);
                        const built = buildDiatonicChord(key, mode, degree, octave);
                        const where = `${key} ${mode} oct${octave} deg${degree}`;
                        expect(built.notes.map(noteToMidi), where).toEqual(old.map(oldNoteToMidi));
                        expect(built.degree, where).toBe(OLD_LABELS[mode][degree]);
                        compared++;
                    }
                }
            }
        }
        expect(compared).toBe(12 * 4 * 3 * 7);
    });

    it('stored note names stay parseable by the persistence validator and the synth', () => {
        const modes: ModeId[] = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian', 'harmonic_minor', 'melodic_minor'];
        for (const key of KEYS) {
            for (const mode of modes) {
                for (let degree = 0; degree < 7; degree++) {
                    for (const sevenths of [false, true]) {
                        const { notes } = buildDiatonicChord(key, mode, degree, 4, sevenths);
                        expect(notes).toHaveLength(sevenths ? 4 : 3);
                        notes.forEach(n => expect(n).toMatch(/^[A-G][#b]?[0-8]$/));
                        const midis = notes.map(n => noteToMidi(n) ?? -1);
                        expect([...midis].sort((a, b) => a - b)).toEqual(midis); // ascending, root first
                        expect(chordPitchClasses(notes).size).toBe(notes.length);
                    }
                }
            }
        }
    });
});
