import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePomodoro, formatTime, DURATIONS } from './usePomodoro';

describe('usePomodoro', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('starts paused in focus mode with 25 minutes', () => {
        const { result } = renderHook(() => usePomodoro());
        expect(result.current.mode).toBe('pomodoro');
        expect(result.current.timeLeft).toBe(1500);
        expect(result.current.isActive).toBe(false);
        expect(result.current.progress).toBe(0);
    });

    it('counts down while active and pauses', () => {
        const { result } = renderHook(() => usePomodoro());
        act(() => result.current.toggle());
        expect(result.current.isActive).toBe(true);
        act(() => { vi.advanceTimersByTime(10_000); });
        expect(result.current.timeLeft).toBe(1490);
        act(() => result.current.toggle());
        expect(result.current.isActive).toBe(false);
        act(() => { vi.advanceTimersByTime(10_000); });
        expect(result.current.timeLeft).toBe(1490);
    });

    it('resumes from the remaining time after a pause', () => {
        const { result } = renderHook(() => usePomodoro());
        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(5_000); });
        act(() => result.current.toggle());
        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(5_000); });
        expect(result.current.timeLeft).toBe(1490);
    });

    it('reset restores the current mode duration and stops', () => {
        const { result } = renderHook(() => usePomodoro());
        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(3_000); });
        act(() => result.current.reset());
        expect(result.current.isActive).toBe(false);
        expect(result.current.timeLeft).toBe(DURATIONS.pomodoro);
        act(() => result.current.setMode('break'));
        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(3_000); });
        act(() => result.current.reset());
        expect(result.current.timeLeft).toBe(DURATIONS.break);
    });

    it('setMode switches to break, stops and resets the clock', () => {
        const { result } = renderHook(() => usePomodoro());
        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(2_000); });
        act(() => result.current.setMode('break'));
        expect(result.current.mode).toBe('break');
        expect(result.current.isActive).toBe(false);
        expect(result.current.timeLeft).toBe(300);
        act(() => result.current.setMode('pomodoro'));
        expect(result.current.timeLeft).toBe(1500);
    });

    it('computes progress per mode', () => {
        const { result } = renderHook(() => usePomodoro());
        act(() => result.current.setMode('break'));
        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(150_000); });
        expect(result.current.progress).toBe(50);
    });

    it('completes a focus phase once, reporting its mode', () => {
        const onComplete = vi.fn();
        const { result } = renderHook(() => usePomodoro(onComplete));
        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(1500 * 1000 - 1000); });
        expect(onComplete).not.toHaveBeenCalled();
        act(() => { vi.advanceTimersByTime(1000); });
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith('pomodoro');
        expect(result.current.isActive).toBe(false);
        expect(result.current.timeLeft).toBe(0);
        expect(result.current.progress).toBe(100);
        act(() => { vi.advanceTimersByTime(10_000); });
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('starting again after a phase ended restarts it instead of completing twice', () => {
        const onComplete = vi.fn();
        const { result } = renderHook(() => usePomodoro(onComplete));
        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(DURATIONS.pomodoro * 1000 + 500); });
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(result.current.timeLeft).toBe(0);

        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(1_000); });
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(result.current.isActive).toBe(true);
        expect(result.current.timeLeft).toBe(DURATIONS.pomodoro - 1);
    });

    it('completes a break phase reporting break', () => {
        const onComplete = vi.fn();
        const { result } = renderHook(() => usePomodoro(onComplete));
        act(() => result.current.setMode('break'));
        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(300_000); });
        expect(onComplete).toHaveBeenCalledWith('break');
    });

    it('uses the latest onComplete without restarting the countdown', () => {
        const first = vi.fn();
        const second = vi.fn();
        const { result, rerender } = renderHook(({ cb }) => usePomodoro(cb), { initialProps: { cb: first } });
        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(1_000); });
        rerender({ cb: second });
        act(() => { vi.advanceTimersByTime(1499_000); });
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('works without an onComplete callback', () => {
        const { result } = renderHook(() => usePomodoro());
        act(() => result.current.setMode('break'));
        act(() => result.current.toggle());
        act(() => { vi.advanceTimersByTime(300_000); });
        expect(result.current.isActive).toBe(false);
    });

    it('follows the wall clock when ticks are delayed', () => {
        const { result } = renderHook(() => usePomodoro());
        act(() => result.current.toggle());
        act(() => { vi.setSystemTime(Date.now() + 60_000); vi.advanceTimersByTime(250); });
        expect(result.current.timeLeft).toBe(1440);
    });

    it('clears the interval on unmount', () => {
        const onComplete = vi.fn();
        const { result, unmount } = renderHook(() => usePomodoro(onComplete));
        act(() => result.current.toggle());
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('formatTime', () => {
    it('pads minutes and seconds', () => {
        expect(formatTime(0)).toBe('00:00');
        expect(formatTime(65)).toBe('01:05');
        expect(formatTime(1500)).toBe('25:00');
    });
});
