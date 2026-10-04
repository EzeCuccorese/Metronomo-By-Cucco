/**
 * Note helpers for the piano: MIDI numbers, frequencies, Spanish note names,
 * scales and the computer-keyboard layout.
 *
 * (ES) Utilidades de notas para el piano: MIDI, frecuencias, nombres en español,
 * escalas y el mapeo del teclado de la computadora.
 */

const PITCH_CLASS: Record<string, number> = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6,
    G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11, 'B#': 0,
};

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SPANISH_NAMES = ['Do', 'Do', 'Re', 'Re', 'Mi', 'Fa', 'Fa', 'Sol', 'Sol', 'La', 'La', 'Si'];
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

export const MIDI_A4 = 69;

/** "C#4" / "Eb3" -> MIDI number (C4 = 60), or null when the name is not a note. */
export function noteToMidi(note: string): number | null {
    const match = /^([A-G])([#b]?)(-?\d)$/.exec(note.trim());
    if (!match) return null;
    const pc = PITCH_CLASS[match[1] + match[2]];
    const octave = Number(match[3]);
    // B#/Cb cross the octave boundary.
    const octaveFix = match[1] + match[2] === 'B#' ? 1 : match[1] + match[2] === 'Cb' ? -1 : 0;
    return (octave + 1 + octaveFix) * 12 + pc;
}

/** MIDI number -> "C#4" (sharps). */
export function midiToNoteName(midi: number): string {
    return `${SHARP_NAMES[pitchClass(midi)]}${Math.floor(midi / 12) - 1}`;
}

export const midiToFrequency = (midi: number): number => 440 * Math.pow(2, (midi - MIDI_A4) / 12);

export const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12;

export const isBlackKey = (midi: number): boolean => BLACK_PCS.has(pitchClass(midi));

/** Visible Spanish name: "Do", "Do♯", "Sol". */
export function spanishNoteName(midi: number): string {
    const pc = pitchClass(midi);
    return BLACK_PCS.has(pc) ? `${SPANISH_NAMES[pc]}♯` : SPANISH_NAMES[pc];
}

/** Screen-reader name with octave: "Do sostenido 4". */
export function spanishNoteLabel(midi: number): string {
    const pc = pitchClass(midi);
    const octave = Math.floor(midi / 12) - 1;
    return `${SPANISH_NAMES[pc]}${BLACK_PCS.has(pc) ? ' sostenido' : ''} ${octave}`;
}

// --- Scales ---

export type ScaleMode = 'major' | 'minor';

const SCALE_STEPS: Record<ScaleMode, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
};

/** Pitch classes (0-11) of a scale. */
export function scalePitchClasses(rootPc: number, mode: ScaleMode): Set<number> {
    return new Set(SCALE_STEPS[mode].map(s => pitchClass(rootPc + s)));
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

/**
 * Computer-keyboard layouts. "Ableton": one row of white keys (A S D F…) with the black keys above.
 * "Tracker" (FastTracker / qwerty-hancock style): two rows, Z S X D C V… for the low octave and
 * Q 2 W 3 E R… for the one above, which covers all 25 visible keys. Octave and velocity move to
 * other keys there because Z / X / C / V are notes.
 */
export type PianoLayout = 'ableton' | 'tracker';

export interface ComputerLayout {
    /** KeyboardEvent.code -> semitones above the lowest visible C. */
    notes: Readonly<Record<string, number>>;
    octave: { down: string; up: string };
    velocity: { down: string; up: string };
}

export const COMPUTER_LAYOUTS: Readonly<Record<PianoLayout, ComputerLayout>> = {
    ableton: {
        notes: COMPUTER_KEY_SEMITONES,
        octave: { down: 'KeyZ', up: 'KeyX' },
        velocity: { down: 'KeyC', up: 'KeyV' },
    },
    tracker: {
        notes: {
            KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
            KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23, KeyI: 24,
        },
        octave: { down: 'Minus', up: 'Equal' },
        velocity: { down: 'PageDown', up: 'PageUp' },
    },
};

/** Label a key shows when the browser cannot tell us the real layout (QWERTY, Spanish Ñ). */
export function fallbackKeyLabel(code: string): string {
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    const named: Record<string, string> = { Semicolon: 'Ñ', Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=', PageUp: 'RePág', PageDown: 'AvPág' };
    return named[code] ?? code;
}

/** Key of a layout that plays a semitone offset, if any. */
export function computerKeyCode(semitone: number, layout: PianoLayout = 'ableton'): string | null {
    const entry = Object.entries(COMPUTER_LAYOUTS[layout].notes).find(([, s]) => s === semitone);
    return entry ? entry[0] : null;
}

/** Letter shown on the on-screen key for a semitone offset (for the hint labels). */
export function computerKeyLabel(semitone: number, layout: PianoLayout = 'ableton'): string | null {
    const code = computerKeyCode(semitone, layout);
    return code ? fallbackKeyLabel(code) : null;
}

/** Highest semitone offset a layout reaches. */
export const layoutSpan = (layout: PianoLayout): number => Math.max(...Object.values(COMPUTER_LAYOUTS[layout].notes));
