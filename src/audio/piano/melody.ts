/**
 * Recorded melodies: a loop of 1-4 bars on a grid of `subdivision` steps per bar.
 * Pure helpers shared by the Scheduler (recording + playback) and the UI (persistence).
 *
 * (ES) Melodías grabadas: un loop de 1 a 4 compases cuantizado a la subdivisión.
 */
import { isNumber, isPlainObject } from '../../state/storage';

export interface MelodyNote {
    /** Step inside the whole loop (0 .. bars * subdivision - 1). */
    step: number;
    midi: number;
    velocity: number;
    /** Length in steps (>= 1). */
    length: number;
}

export interface Melody {
    bars: number;
    subdivision: number;
    notes: MelodyNote[];
}

export const MELODY_BAR_OPTIONS = [1, 2, 3, 4] as const;
export const MAX_MELODY_NOTES = 256;
export const PIANO_MIN_MIDI = 21;
export const PIANO_MAX_MIDI = 108;

const isInt = (v: unknown): v is number => isNumber(v) && Number.isInteger(v);

export const isMelodyNote = (v: unknown, totalSteps: number): v is MelodyNote =>
    isPlainObject(v) && isInt(v.step) && v.step >= 0 && v.step < totalSteps &&
    isInt(v.midi) && v.midi >= PIANO_MIN_MIDI && v.midi <= PIANO_MAX_MIDI &&
    isNumber(v.velocity) && v.velocity > 0 && v.velocity <= 1 &&
    isInt(v.length) && v.length >= 1 && v.length <= totalSteps;

/** Type guard for persisted melodies (anything malformed is rejected as a whole). */
export function isMelody(v: unknown): v is Melody {
    if (!isPlainObject(v) || !isInt(v.bars) || !(MELODY_BAR_OPTIONS as readonly number[]).includes(v.bars)) return false;
    if (!isInt(v.subdivision) || v.subdivision < 1 || v.subdivision > 48) return false;
    if (!Array.isArray(v.notes) || v.notes.length > MAX_MELODY_NOTES) return false;
    const total = v.bars * v.subdivision;
    return v.notes.every(n => isMelodyNote(n, total));
}

export interface ScheduledNote {
    midi: number;
    /** Seconds after the start of the current step. */
    offset: number;
    duration: number;
    velocity: number;
}

/**
 * Notes of the melody that start inside step `stepIdx` (of `stepsPerBar`) of loop bar
 * `loopBar`. The melody keeps its own grid, so it still lands on time if the pattern's
 * subdivision differs from the one it was recorded with.
 */
export function melodyNotesForStep(melody: Melody, loopBar: number, stepIdx: number, stepsPerBar: number, barDuration: number): ScheduledNote[] {
    const S = melody.subdivision;
    const out: ScheduledNote[] = [];
    for (const note of melody.notes) {
        if (Math.floor(note.step / S) !== loopBar) continue;
        const local = note.step % S;
        // Integer test of: stepIdx / stepsPerBar <= local / S < (stepIdx + 1) / stepsPerBar
        if (local * stepsPerBar < stepIdx * S || local * stepsPerBar >= (stepIdx + 1) * S) continue;
        out.push({
            midi: note.midi,
            offset: (local / S - stepIdx / stepsPerBar) * barDuration,
            duration: (note.length / S) * barDuration,
            velocity: note.velocity,
        });
    }
    return out;
}

/** Sorts and de-duplicates (same step + same key keeps the louder take). */
export function normalizeMelody(melody: Melody): Melody {
    const byKey = new Map<string, MelodyNote>();
    for (const n of melody.notes) {
        const key = `${n.step}:${n.midi}`;
        const prev = byKey.get(key);
        if (!prev || n.velocity > prev.velocity) byKey.set(key, n);
    }
    const notes = Array.from(byKey.values())
        .sort((a, b) => a.step - b.step || a.midi - b.midi)
        .slice(0, MAX_MELODY_NOTES);
    return { ...melody, notes };
}
