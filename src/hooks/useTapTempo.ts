import { useCallback, useRef } from 'react';
import { MAX_BPM, MIN_BPM } from '../rhythms/meter';

const MAX_TAPS = 8;
const RESET_AFTER_MS = 2000;

/**
 * Pure tap-tempo calculation: average interval of the recent taps, ignoring outliers
 * that differ more than 15% from the median (a missed or doubled tap).
 * Returns null until there are enough taps or when the result is out of range.
 */
export function computeTapBpm(timestamps: number[]): number | null {
    if (timestamps.length < 3) return null;
    const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const valid = intervals.filter(i => Math.abs(i - median) <= median * 0.15);
    if (valid.length === 0) return null;
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    const bpm = Math.round(60000 / avg);
    return bpm >= MIN_BPM && bpm <= MAX_BPM ? bpm : null;
}

const defaultNow = () => performance.now();

export function useTapTempo(onBpm: (bpm: number) => void, now: () => number = defaultNow) {
    const tapsRef = useRef<number[]>([]);

    return useCallback(() => {
        const t = now();
        const taps = tapsRef.current;
        if (taps.length > 0 && t - taps[taps.length - 1] > RESET_AFTER_MS) {
            taps.length = 0;
        }
        taps.push(t);
        if (taps.length > MAX_TAPS) taps.shift();
        const bpm = computeTapBpm(taps);
        if (bpm !== null) onBpm(bpm);
    }, [onBpm, now]);
}
