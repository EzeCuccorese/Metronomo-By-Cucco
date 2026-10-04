import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';
import { STORAGE_PREFIX, isNumber } from '../state/storage';

describe('usePersistentState', () => {
    afterEach(() => localStorage.clear());

    it('restores and persists values', () => {
        localStorage.setItem(`${STORAGE_PREFIX}count`, '7');
        const { result } = renderHook(() => usePersistentState('count', 0, isNumber));
        expect(result.current[0]).toBe(7);
        act(() => result.current[1](8));
        expect(localStorage.getItem(`${STORAGE_PREFIX}count`)).toBe('8');
    });

    it('ignores invalid stored data', () => {
        localStorage.setItem(`${STORAGE_PREFIX}count`, '"seven"');
        const { result } = renderHook(() => usePersistentState('count', 0, isNumber));
        expect(result.current[0]).toBe(0);
    });

    it('does not overwrite stored data it could not read until the value changes', () => {
        localStorage.setItem(`${STORAGE_PREFIX}count`, '"from a future version"');
        const { result } = renderHook(() => usePersistentState('count', 0, isNumber));
        expect(localStorage.getItem(`${STORAGE_PREFIX}count`)).toBe('"from a future version"');
        act(() => result.current[1](1));
        expect(localStorage.getItem(`${STORAGE_PREFIX}count`)).toBe('1');
    });

    it('repairs values with a sanitizer instead of discarding them', () => {
        localStorage.setItem(`${STORAGE_PREFIX}list`, '[1, "x", 2]');
        const sanitize = (v: unknown) => Array.isArray(v) ? v.filter(isNumber) : undefined;
        const { result } = renderHook(() => usePersistentState<number[]>('list', [], { sanitize }));
        expect(result.current[0]).toEqual([1, 2]);
    });
});

describe('usePersistentState instances', () => {
    afterEach(() => localStorage.clear());

    it('keeps every mounted instance of a key in step and stops tracking after unmount', () => {
        const a = renderHook(() => usePersistentState('shared', 0, isNumber));
        const b = renderHook(() => usePersistentState('shared', 0, isNumber));
        act(() => a.result.current[1](4));
        expect(b.result.current[0]).toBe(4);
        a.unmount();
        b.unmount();
        // A fresh instance starts from storage, with nothing left over from the unmounted ones.
        const c = renderHook(() => usePersistentState('shared', 0, isNumber));
        expect(c.result.current[0]).toBe(4);
    });
});
