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
});
