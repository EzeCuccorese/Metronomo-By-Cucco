import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';

const FIRST_DELAY_MS = 380;
const START_INTERVAL_MS = 130;
const MIN_INTERVAL_MS = 45;
/** After this many repeats the step grows (BPM jumps by 5 instead of 1). */
const FAST_AFTER = 10;
/** A click this soon after a pointer/key press is the same gesture, not a second one. */
const CLICK_AFTER_PRESS_MS = 800;

/**
 * Press-and-hold repeat with acceleration for the − / + tempo buttons.
 * `onStep(multiplier)` is called once on press, then repeatedly while held (the multiplier grows when held long).
 * Keyboard activation (Enter / Space) steps once per press.
 *
 * (ES) Mantener presionado repite, y acelera si se sostiene.
 */
export function useHoldRepeat(onStep: (multiplier: number) => void, disabled = false) {
    const stepRef = useRef(onStep);
    useEffect(() => { stepRef.current = onStep; });
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stop = useCallback(() => {
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = null;
    }, []);
    useEffect(() => {
        // Locking the tempo (speed trainer) while a button is held must end the repeat.
        if (disabled) stop();
        return stop;
    }, [disabled, stop]);

    // Pointer and key presses step on their own; a synthetic click (screen readers) steps here instead.
    const lastHandled = useRef(0);
    const markHandled = () => { lastHandled.current = Date.now(); };

    const start = useCallback((e: PointerEvent<HTMLElement>) => {
        if (disabled || e.button !== 0) return;
        stop();
        markHandled();
        let repeats = 0;
        let interval = START_INTERVAL_MS;
        stepRef.current(1);
        const tick = () => {
            repeats += 1;
            stepRef.current(repeats > FAST_AFTER ? 5 : 1);
            interval = Math.max(MIN_INTERVAL_MS, interval * 0.93);
            timer.current = setTimeout(tick, interval);
        };
        timer.current = setTimeout(tick, FIRST_DELAY_MS);
    }, [disabled, stop]);

    const onKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        // Space would scroll the page.
        e.preventDefault();
        if (e.repeat || disabled) return;
        markHandled();
        stepRef.current(1);
    }, [disabled]);

    const onClick = useCallback((e: MouseEvent<HTMLElement>) => {
        e.preventDefault();
        if (disabled || Date.now() - lastHandled.current < CLICK_AFTER_PRESS_MS) return;
        stepRef.current(1);
    }, [disabled]);

    return {
        onPointerDown: start,
        onPointerUp: stop,
        onPointerLeave: stop,
        onPointerCancel: stop,
        onBlur: stop,
        onKeyDown,
        onClick,
    };
}
