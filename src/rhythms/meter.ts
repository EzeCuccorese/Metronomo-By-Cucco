/**
 * Meter helpers shared by the scheduler and the UI.
 * BPM always refers to the quarter note (♩), as in the scheduler's bar formula.
 *
 * (ES) Utilidades de compás compartidas por el scheduler y la UI.
 * El BPM siempre se refiere a la negra (♩).
 */

export type TimeSignature = [number, number];

export const MIN_BPM = 30;
export const MAX_BPM = 300;

export const clampBpm = (bpm: number): number => {
    if (!Number.isFinite(bpm)) return 120;
    return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
};

/** Compound meters (6/8, 9/8, 12/8) group their pulses in threes. */
export const isCompoundMeter = ([num, den]: TimeSignature): boolean =>
    den === 8 && num % 3 === 0 && num > 3;

/** Number of counted beats shown to the musician (6/8 -> 2, 3/4 -> 3). */
export const getGroupCount = (ts: TimeSignature): number =>
    isCompoundMeter(ts) ? ts[0] / 3 : ts[0];

export const getBarDurationSeconds = (bpm: number, [num, den]: TimeSignature): number =>
    (60 / bpm) * (4 / den) * num;

/** True when the 0-based step falls exactly on a pulse (denominator note) of the bar. */
export const isPulseStart = (stepIndex: number, subdivision: number, ts: TimeSignature): boolean =>
    (stepIndex * ts[0]) % subdivision === 0;

/** True when the 0-based step starts a counted beat (dotted quarter in compound meters). */
export const isGroupStart = (stepIndex: number, subdivision: number, ts: TimeSignature): boolean =>
    (stepIndex * getGroupCount(ts)) % subdivision === 0;

/**
 * Guide click velocity for a step, or null when no click belongs there.
 * Downbeat > beat start > remaining pulses, so compound meters keep their feel.
 */
export const getClickVelocity = (stepIndex: number, subdivision: number, ts: TimeSignature): number | null => {
    if (!isPulseStart(stepIndex, subdivision, ts)) return null;
    if (stepIndex === 0) return 1.0;
    if (isGroupStart(stepIndex, subdivision, ts)) return 0.7;
    return 0.45;
};
