import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type TimerMode = 'pomodoro' | 'break';

export const DURATIONS = { pomodoro: 25 * 60, break: 5 * 60 } as const;
const TICK_MS = 250;

export const formatTime = (seconds: number) => {
    const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * Pomodoro countdown. Counts against a wall-clock deadline so throttled
 * background tabs don't drift. `onComplete` fires once when a phase hits zero.
 *
 * (ES) Temporizador pomodoro basado en un deadline de reloj.
 */
export function usePomodoro(onComplete?: (mode: TimerMode) => void) {
    const [mode, setModeState] = useState<TimerMode>('pomodoro');
    const [timeLeft, setTimeLeft] = useState<number>(DURATIONS.pomodoro);
    const [isActive, setIsActive] = useState(false);
    const endTimeRef = useRef(0);
    const latest = useRef({ timeLeft, mode, onComplete });
    // Layout effect: runs before any passive effect, so the interval effect never reads a stale snapshot.
    useLayoutEffect(() => {
        latest.current = { timeLeft, mode, onComplete };
    });

    useEffect(() => {
        if (!isActive) return;
        endTimeRef.current = Date.now() + latest.current.timeLeft * 1000;
        const id = window.setInterval(() => {
            const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining === 0) {
                clearInterval(id);
                setIsActive(false);
                latest.current.onComplete?.(latest.current.mode);
            }
        }, TICK_MS);
        return () => clearInterval(id);
    }, [isActive]);

    const toggle = useCallback(() => {
        // Starting a finished phase starts it over instead of completing it again at once.
        if (!isActive && latest.current.timeLeft === 0) setTimeLeft(DURATIONS[latest.current.mode]);
        setIsActive(active => !active);
    }, [isActive]);
    const reset = useCallback(() => {
        setIsActive(false);
        setTimeLeft(DURATIONS[latest.current.mode]);
    }, []);
    const setMode = useCallback((next: TimerMode) => {
        setIsActive(false);
        setModeState(next);
        setTimeLeft(DURATIONS[next]);
    }, []);

    const progress = 100 - (timeLeft / DURATIONS[mode]) * 100;

    return { mode, timeLeft, isActive, progress, toggle, reset, setMode };
}
