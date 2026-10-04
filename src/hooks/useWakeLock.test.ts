import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWakeLock } from './useWakeLock';

class MockSentinel {
    released = false;
    release = vi.fn(async () => { this.released = true; });
}

let visibility: DocumentVisibilityState;
let sentinels: MockSentinel[];
let request: ReturnType<typeof vi.fn>;

const setVisibility = (value: DocumentVisibilityState) => {
    visibility = value;
    document.dispatchEvent(new Event('visibilitychange'));
};

const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

describe('useWakeLock', () => {
    beforeEach(() => {
        visibility = 'visible';
        sentinels = [];
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
        request = vi.fn(async () => {
            const s = new MockSentinel();
            sentinels.push(s);
            return s;
        });
        Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    });

    afterEach(() => {
        Reflect.deleteProperty(navigator, 'wakeLock');
        vi.restoreAllMocks();
    });

    it('holds a screen lock only while playing and releases it when playback stops', async () => {
        const { rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: false } });
        await flush();
        expect(request).not.toHaveBeenCalled();

        rerender({ active: true });
        await flush();
        expect(request).toHaveBeenCalledWith('screen');

        rerender({ active: false });
        expect(sentinels[0].release).toHaveBeenCalled();
    });

    it('requests the lock again when the page becomes visible (the system dropped it)', async () => {
        renderHook(() => useWakeLock(true));
        await flush();
        sentinels[0].released = true; // released by the system while hidden
        act(() => setVisibility('hidden'));
        await flush();
        expect(request).toHaveBeenCalledTimes(1);

        act(() => setVisibility('visible'));
        await flush();
        expect(request).toHaveBeenCalledTimes(2);

        act(() => setVisibility('visible')); // still held: no duplicate
        await flush();
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('waits for visibility before the first request', async () => {
        visibility = 'hidden';
        renderHook(() => useWakeLock(true));
        await flush();
        expect(request).not.toHaveBeenCalled();
        act(() => setVisibility('visible'));
        await flush();
        expect(request).toHaveBeenCalledTimes(1);
    });

    it('keeps going without a lock when the request is refused (low battery)', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        request.mockRejectedValueOnce(new DOMException('battery', 'NotAllowedError'));
        const { unmount } = renderHook(() => useWakeLock(true));
        await flush();
        expect(warn).toHaveBeenCalled();
        expect(() => unmount()).not.toThrow();
    });

    it('releases on unmount, and a lock granted after unmount is released at once', async () => {
        const { unmount } = renderHook(() => useWakeLock(true));
        await flush();
        unmount();
        expect(sentinels[0].release).toHaveBeenCalled();

        let grant!: (s: MockSentinel) => void;
        request.mockReturnValueOnce(new Promise(r => { grant = r; }));
        const late = renderHook(() => useWakeLock(true));
        late.unmount();
        const s = new MockSentinel();
        grant(s);
        await flush();
        expect(s.release).toHaveBeenCalled();
    });

    it('ignores a failing release', async () => {
        const { unmount } = renderHook(() => useWakeLock(true));
        await flush();
        sentinels[0].release.mockRejectedValueOnce(new Error('gone'));
        unmount();
        await flush();

        let grant!: (s: MockSentinel) => void;
        request.mockReturnValueOnce(new Promise(r => { grant = r; }));
        const late = renderHook(() => useWakeLock(true));
        late.unmount();
        const s = new MockSentinel();
        s.release.mockRejectedValueOnce(new Error('gone'));
        grant(s);
        await flush();
        expect(s.release).toHaveBeenCalled();
    });

    it('does nothing where the API is missing', async () => {
        Reflect.deleteProperty(navigator, 'wakeLock');
        const { unmount } = renderHook(() => useWakeLock(true));
        await flush();
        expect(request).not.toHaveBeenCalled();
        unmount();
    });
});
