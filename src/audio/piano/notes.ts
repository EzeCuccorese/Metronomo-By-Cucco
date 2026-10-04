/**
 * Note helpers for the piano: MIDI numbers, frequencies, Spanish note names,
 * scales and the computer-keyboard layout.
 *
 * (ES) Utilidades de notas para el piano: MIDI, frecuencias, nombres en español,
 * escalas y el mapeo del teclado de la computadora.
 */
import * as Note from '@tonaljs/note';
import { scaleChromas } from '../../theory/harmony';
import type { ModeId } from '../../theory/harmony';


const SPANISH_LETTERS: Record<string, string> = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

export const MIDI_A4 = 69;

/** "C#4" / "Eb3" -> MIDI number (C4 = 60), or null when the name is not a note. */
export function noteToMidi(note: string): number | null {
    const trimmed = note.trim();
    // Tonal accepts lower-case letters and octave-less names; the app only writes "C#4".
    if (!/^[A-G]/.test(trimmed)) return null;
    return Note.midi(trimmed);
}

/** MIDI number -> "C#4" (sharps). */
export function midiToNoteName(midi: number): string {
    return Note.fromMidiSharps(midi);
}

export const midiToFrequency = (midi: number): number => 440 * Math.pow(2, (midi - MIDI_A4) / 12);

export const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12;

const parsed = (midi: number) => Note.get(Note.fromMidiSharps(midi));

export const isBlackKey = (midi: number): boolean => parsed(midi).acc !== '';

/** Visible Spanish name: "Do", "Do♯", "Sol". */
export function spanishNoteName(midi: number): string {
    const note = parsed(midi);
    return `${SPANISH_LETTERS[note.letter]}${note.acc ? '♯' : ''}`;
}

/** Screen-reader name with octave: "Do sostenido 4". */
export function spanishNoteLabel(midi: number): string {
    const note = parsed(midi);
    return `${SPANISH_LETTERS[note.letter]}${note.acc ? ' sostenido' : ''} ${note.oct}`;
}

// --- Scales ---

export type ScaleMode = ModeId;

/** Pitch classes (0-11) of a scale. */
export function scalePitchClasses(rootPc: number, mode: ScaleMode): Set<number> {
    return new Set(scaleChromas(rootPc, mode));
}

/** Pitch classes of a chord given as note names (invalid names are ignored). */
export function chordPitchClasses(notes: readonly string[]): Set<number> {
    const set = new Set<number>();
    notes.forEach(n => {
        const midi = noteToMidi(n);
        if (midi !== null) set.add(pitchClass(midi));
    });
    return set;
}

// --- Voice leading ---

/**
 * Picks, for every chord tone, the octave closest to the previous voicing so the
 * hand moves as little as possible (common tones stay, the rest move by step).
 * The result is sorted low -> high and kept inside [low, high].
 */
export function voiceLead(chord: readonly number[], previous: readonly number[], low = 48, high = 79): number[] {
    if (chord.length === 0) return [];
    if (previous.length === 0) return [...chord].sort((a, b) => a - b);
    const center = previous.reduce((s, n) => s + n, 0) / previous.length;
    const voiced = chord.map(note => {
        const pc = pitchClass(note);
        let best = note;
        let bestCost = Infinity;
        for (let candidate = low + pitchClass(pc - low); candidate <= high; candidate += 12) {
            // Distance to the nearest previous voice, with a light pull to the previous center.
            const nearest = Math.min(...previous.map(p => Math.abs(p - candidate)));
            const cost = nearest + Math.abs(candidate - center) * 0.25;
            if (cost < bestCost) {
                bestCost = cost;
                best = candidate;
            }
        }
        return best;
    });
    return Array.from(new Set(voiced)).sort((a, b) => a - b);
}

// --- Computer keyboard ---

/** KeyboardEvent.code -> semitones above the lowest visible C. */
export const COMPUTER_KEY_SEMITONES: Readonly<Record<string, number>> = {
    KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
    KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16,
};

/** Keys that shift the playing octave. */
export const OCTAVE_KEYS: Readonly<Record<string, -1 | 1>> = { KeyZ: -1, KeyX: 1 };

/** Letter shown on the on-screen key for a semitone offset (for the hint labels). */
export function computerKeyLabel(semitone: number): string | null {
    const entry = Object.entries(COMPUTER_KEY_SEMITONES).find(([, s]) => s === semitone);
    if (!entry) return null;
    return entry[0] === 'Semicolon' ? 'Ñ' : entry[0].replace('Key', '');
}
