/**
 * Harmony theory on top of Tonal.js: modes, diatonic triads/sevenths, roman-numeral labels
 * and chord symbols. Pure (no React, no audio).
 *
 * (ES) Teoría armónica sobre Tonal.js: modos, tríadas y séptimas diatónicas, grados en
 * números romanos y cifrados de acordes.
 */
import * as Chord from '@tonaljs/chord';
import * as Note from '@tonaljs/note';
import * as Scale from '@tonaljs/scale';

export type ModeId =
    | 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian'
    | 'harmonic_minor' | 'melodic_minor';

export interface ModeInfo {
    id: ModeId;
    /** Scale name Tonal understands. */
    tonal: string;
    /** Label in the harmony builder. */
    label: string;
    /** Short lower-case name used next to a tonic ("Do mayor", "La menor armónica"). */
    short: string;
}

export const MODES: readonly ModeInfo[] = [
    { id: 'major', tonal: 'major', label: 'Mayor (Natural)', short: 'mayor' },
    { id: 'minor', tonal: 'minor', label: 'Menor (Natural)', short: 'menor' },
    { id: 'dorian', tonal: 'dorian', label: 'Dórico (Jazzy)', short: 'dórico' },
    { id: 'phrygian', tonal: 'phrygian', label: 'Frigio (Flamenco)', short: 'frigio' },
    { id: 'lydian', tonal: 'lydian', label: 'Lidio (Soñador)', short: 'lidio' },
    { id: 'mixolydian', tonal: 'mixolydian', label: 'Mixolidio (Bluesy)', short: 'mixolidio' },
    { id: 'locrian', tonal: 'locrian', label: 'Locrio', short: 'locrio' },
    { id: 'harmonic_minor', tonal: 'harmonic minor', label: 'Menor armónica', short: 'menor armónica' },
    { id: 'melodic_minor', tonal: 'melodic minor', label: 'Menor melódica', short: 'menor melódica' },
];

export const isModeId = (v: unknown): v is ModeId => MODES.some(m => m.id === v);

const modeInfo = (id: ModeId): ModeInfo => MODES.find(m => m.id === id) ?? MODES[0];

/** Tonics offered by the builder (spelled the way the UI always showed them). */
export const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** Pitch classes (0-11) of a scale built on `rootPc`. */
export function scaleChromas(rootPc: number, mode: ModeId): number[] {
    let offsets = MODE_OFFSETS.get(mode);
    if (!offsets) {
        offsets = Scale.get(`C ${modeInfo(mode).tonal}`).notes.map(n => Note.chroma(n));
        MODE_OFFSETS.set(mode, offsets);
    }
    return offsets.map(o => (o + rootPc + 12) % 12);
}

/** Semitones above the tonic of each mode, computed once per mode. */
const MODE_OFFSETS = new Map<ModeId, number[]>();

export interface BuiltChord {
    /** Roman-numeral degree, e.g. "ii", "vii°", "V7", "Imaj7". */
    degree: string;
    /** Chord symbol, e.g. "Dm", "G7", "Cmaj7". */
    symbol: string;
    /** Note names with octave, root first, ascending ("C4", "E4", "G4"). */
    notes: string[];
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** Roman numeral from the semitone distances above the chord root. */
function romanNumeral(degreeIndex: number, third: number, fifth: number, seventh: number | null): string {
    const minorThird = third === 3;
    let label = minorThird ? ROMAN[degreeIndex].toLowerCase() : ROMAN[degreeIndex];
    if (minorThird && fifth === 6) label += '°';
    else if (!minorThird && fifth === 8) label += '+';
    if (seventh === null) return label;
    if (seventh === 11) return `${label}maj7`;
    if (seventh === 10) return label.endsWith('°') ? `${label.slice(0, -1)}ø7` : `${label}7`;
    return `${label}7`; // 9 (diminished seventh): "vii°7"
}

/** Suffix of the stacked-thirds chords, keyed by the semitones of third, fifth[, seventh]. */
const SUFFIXES: Record<string, string> = {
    '4,7': '', '3,7': 'm', '3,6': 'dim', '4,8': 'aug',
    '4,7,11': 'maj7', '4,7,10': '7', '3,7,10': 'm7', '3,7,11': 'mMaj7',
    '3,6,10': 'm7b5', '3,6,9': 'dim7', '4,8,11': 'maj7#5', '4,8,10': '7#5',
};

/**
 * Chord symbol for notes given root first ("D4","F4","A4","C5" -> "Dm7"). Stacked-thirds
 * triads and sevenths use the table above; anything else is named by Tonal's detector.
 */
export function chordSymbol(notes: readonly string[]): string {
    const names = notes.map(n => Note.pitchClass(n)).filter(Boolean);
    if (names.length === 0) return '';
    const chromas = names.map(n => Note.chroma(n));
    const suffix = SUFFIXES[chromas.slice(1).map(c => (c - chromas[0] + 12) % 12).join(',')];
    if (suffix !== undefined && names.length >= 3) return names[0] + suffix;
    return Chord.detect(names)[0] ?? names[0];
}

/**
 * Diatonic chord on `degreeIndex` (0-6) of `rootKey` in `mode`, voiced upwards from `octave`.
 * Triad by default, with the seventh when `sevenths` is set.
 */
export function buildDiatonicChord(
    rootKey: string, mode: ModeId, degreeIndex: number, octave: number, sevenths = false,
): BuiltChord {
    let scale = Scale.get(`${rootKey} ${modeInfo(mode).tonal}`).notes;
    if (scale.length < 7) {
        // Unknown tonic: fall back to C so the builder never emits "undefined4".
        rootKey = 'C';
        scale = Scale.get(`C ${modeInfo(mode).tonal}`).notes;
    }
    const rootChroma = Note.chroma(rootKey);
    // Semitones above the tonic of every scale degree (always ascending within one octave).
    const offsets = scale.map(n => (Note.chroma(n) - rootChroma + 12) % 12);
    const steps = sevenths ? [0, 2, 4, 6] : [0, 2, 4];
    const offsetOf = (step: number) => offsets[(degreeIndex + step) % 7] + 12 * Math.floor((degreeIndex + step) / 7);
    const base = offsetOf(0);

    const notes = steps.map(step => {
        let name = scale[(degreeIndex + step) % 7];
        // Double accidentals (F## ...) are respelled; the sounding pitch never changes.
        if (/(##|bb)/.test(name)) name = Note.simplify(name);
        const midi = (octave + 1) * 12 + rootChroma + offsetOf(step);
        const reference = Note.midi(`${name}4`) ?? 60;
        return `${name}${4 + Math.round((midi - reference) / 12)}`;
    });

    const third = offsetOf(2) - base;
    const fifth = offsetOf(4) - base;
    const seventh = sevenths ? offsetOf(6) - base : null;
    return {
        degree: romanNumeral(degreeIndex, third, fifth, seventh),
        symbol: chordSymbol(notes),
        notes,
    };
}
