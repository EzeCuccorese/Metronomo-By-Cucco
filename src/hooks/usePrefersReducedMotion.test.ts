import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPrefersReducedMotion, usePrefersReducedMotion } from './usePrefersReducedMotion';

type Listener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(initial: boolean) {
    const listeners = new Set<Listener>();
    const mql = {
        matches: initial,
        addEventListener: (_: string, l: Listener) => listeners.add(l),
        removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    return {
        listeners,
        emit: (matches: boolean) => {
            mql.matches = matches;
            listeners.forEach(l => l({ matches } as MediaQueryListEvent));
        },
    };
}

describe('usePrefersReducedMotion', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('is false when matchMedia is unavailable', () => {
        vi.stubGlobal('matchMedia', undefined);
        expect(getPrefersReducedMotion()).toBe(false);
        const { result } = renderHook(() => usePrefersReducedMotion());
        expect(result.current).toBe(false);
    });

    it('reads the initial preference', () => {
        mockMatchMedia(true);
        const { result } = renderHook(() => usePrefersReducedMotion());
        expect(result.current).toBe(true);
    });

    it('updates on change events and unsubscribes on unmount', () => {
        const mm = mockMatchMedia(false);
        const { result, unmount } = renderHook(() => usePrefersReducedMotion());
        expect(result.current).toBe(false);
        act(() => mm.emit(true));
        expect(result.current).toBe(true);
        act(() => mm.emit(false));
        expect(result.current).toBe(false);
        unmount();
        expect(mm.listeners.size).toBe(0);
    });
});
