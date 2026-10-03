import type { RhythmStep } from './RhythmPatterns';
import type { TimeSignature } from './meter';

export const TIME_SIGNATURES: { label: string; value: TimeSignature }[] = [
    { label: '2/4', value: [2, 4] },
    { label: '3/4', value: [3, 4] },
    { label: '4/4', value: [4, 4] },
    { label: '6/8', value: [6, 8] },
    { label: '12/8', value: [12, 8] },
];

export const sameSignature = (a: TimeSignature, b: TimeSignature) => a[0] === b[0] && a[1] === b[1];

/** Moves every step to the closest position of a new grid, keeping one hit per instrument and cell. */
export function remapSteps(steps: RhythmStep[], oldSub: number, newSub: number): RhythmStep[] {
    const seen = new Set<string>();
    const result: RhythmStep[] = [];
    steps.forEach(s => {
        const position = (s.step - 1) / oldSub;
        const step = Math.round(position * newSub) + 1;
        if (step > newSub) return;
        const key = `${step}:${s.instrument}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push({ ...s, step });
    });
    return result;
}

/** Steps per pulse (denominator note) offered by the editor for each pulse unit. */
export const STEPS_PER_PULSE_OPTIONS: Record<4 | 8, number[]> = {
    4: [1, 2, 3, 4, 6],
    8: [1, 2, 3, 4],
};

export const stepsPerPulseOptions = (den: number): number[] => STEPS_PER_PULSE_OPTIONS[den === 8 ? 8 : 4];

/**
 * Changes the meter while keeping every hit at the same musical duration from the
 * downbeat: a 4/4 pattern in sixteenths becomes a 6/8 pattern in sixteenths
 * (2 steps per eighth), not in thirty-seconds. Hits beyond the new bar are dropped.
 */
export function changeTimeSignature(
    pattern: { timeSignature: TimeSignature; subdivision: number; steps: RhythmStep[] },
    next: TimeSignature,
): { timeSignature: TimeSignature; subdivision: number; steps: RhythmStep[] } {
    const [num, den] = pattern.timeSignature;
    const [nextNum, nextDen] = next;
    const stepQuarters = (4 / den) / (pattern.subdivision / num); // duration of one step, in quarter notes

    const ideal = (4 / nextDen) / stepQuarters; // steps per pulse that keep that duration
    const options = stepsPerPulseOptions(nextDen);
    const stepsPerPulse = options.reduce((best, o) => Math.abs(o - ideal) < Math.abs(best - ideal) ? o : best, options[0]);
    const subdivision = nextNum * stepsPerPulse;
    const nextStepQuarters = (4 / nextDen) / stepsPerPulse;

    const seen = new Set<string>();
    const steps: RhythmStep[] = [];
    pattern.steps.forEach(s => {
        const index = Math.round(((s.step - 1) * stepQuarters) / nextStepQuarters);
        if (index >= subdivision) return;
        const key = `${index}:${s.instrument}`;
        if (seen.has(key)) return;
        seen.add(key);
        steps.push({ ...s, step: index + 1 });
    });

    return { timeSignature: next, subdivision, steps };
}
