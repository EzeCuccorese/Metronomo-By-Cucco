import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { labelFor, useKeyLabels } from './useKeyLabels';

const layoutMap = (entries: Record<string, string>) => ({ get: (code: string) => entries[code] });

describe('key labels', () => {
    afterEach(() => { delete (navigator as unknown as { keyboard?: unknown }).keyboard; });

    it('labelFor uses the layout map, uppercases letters and falls back when it has nothing', () => {
        const map = layoutMap({ KeyA: 'q', Semicolon: 'ñ', Comma: '', Dead: 'Dead' });
        expect(labelFor('KeyA', map)).toBe('Q'); // AZERTY: the physical A key prints Q
        expect(labelFor('Semicolon', map)).toBe('Ñ');
        expect(labelFor('Comma', map)).toBe(','); // empty entry -> fallback
        expect(labelFor('KeyB', map)).toBe('B'); // not in the map -> fallback
        expect(labelFor('KeyB', null)).toBe('B');
        expect(labelFor('Semicolon', null)).toBe('Ñ');
    });

    it('uses the fallback where the Keyboard API does not exist (Safari, Firefox)', () => {
        const { result } = renderHook(() => useKeyLabels());
        expect(result.current('KeyA')).toBe('A');
    });

    it('reads navigator.keyboard.getLayoutMap() and follows layout changes', async () => {
        let entries: Record<string, string> = { KeyA: 'q' };
        const keyboard = Object.assign(new EventTarget(), { getLayoutMap: vi.fn(async () => layoutMap(entries)) });
        Object.defineProperty(navigator, 'keyboard', { configurable: true, value: keyboard });
        const { result } = renderHook(() => useKeyLabels());
        await waitFor(() => expect(result.current('KeyA')).toBe('Q'));

        entries = { KeyA: 'a' };
        await act(async () => { keyboard.dispatchEvent(new Event('layoutchange')); });
        await waitFor(() => expect(result.current('KeyA')).toBe('A'));
    });

    it('works when navigator.keyboard is not an EventTarget (real Chromium)', async () => {
        Object.defineProperty(navigator, 'keyboard', { configurable: true, value: { getLayoutMap: async () => layoutMap({ KeyA: 'q' }) } });
        const { result, unmount } = renderHook(() => useKeyLabels());
        await waitFor(() => expect(result.current('KeyA')).toBe('Q'));
        expect(() => unmount()).not.toThrow();
    });

    it('survives a failing getLayoutMap', async () => {
        Object.defineProperty(navigator, 'keyboard', { configurable: true, value: Object.assign(new EventTarget(), { getLayoutMap: async () => { throw new Error('nope'); } }) });
        const { result } = renderHook(() => useKeyLabels());
        await act(async () => {});
        expect(result.current('KeyA')).toBe('A');
    });
});
