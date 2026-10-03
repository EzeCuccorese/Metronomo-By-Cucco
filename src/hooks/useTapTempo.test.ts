import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { computeTapBpm, useTapTempo } from './useTapTempo';

describe('computeTapBpm', () => {
    it('needs at least three taps', () => {
        expect(computeTapBpm([0, 500])).toBeNull();
        expect(computeTapBpm([0, 500, 1000])).toBe(120);
    });

    it('ignores a missed or doubled tap', () => {
        expect(computeTapBpm([0, 500, 1000, 2000, 2500, 3000])).toBe(120);
        expect(computeTapBpm([0, 500, 1000, 1100, 1500, 2000])).toBe(120);
    });

    it('rejects tempos out of range', () => {
        expect(computeTapBpm([0, 100, 200, 300])).toBeNull();
        expect(computeTapBpm([0, 5000, 10000])).toBeNull();
    });
});

describe('useTapTempo', () => {
    it('reports the tempo and resets after a long pause', () => {
        let now = 0;
        const onBpm = vi.fn();
        const { result } = renderHook(() => useTapTempo(onBpm, () => now));

        [0, 600, 1200].forEach(t => { now = t; act(() => result.current()); });
        expect(onBpm).toHaveBeenLastCalledWith(100);

        onBpm.mockClear();
        now = 10000; act(() => result.current());
        now = 10500; act(() => result.current());
        expect(onBpm).not.toHaveBeenCalled(); // the old taps were discarded
        now = 11000; act(() => result.current());
        expect(onBpm).toHaveBeenLastCalledWith(120);
    });
});
