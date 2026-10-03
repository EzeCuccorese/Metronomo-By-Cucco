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
