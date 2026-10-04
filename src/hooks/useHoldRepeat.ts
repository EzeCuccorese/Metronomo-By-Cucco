import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

const FIRST_DELAY_MS = 380;
const START_INTERVAL_MS = 130;
const MIN_INTERVAL_MS = 45;
/** After this many repeats the step grows (BPM jumps by 5 instead of 1). */
const FAST_AFTER = 10;

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
    useEffect(() => stop, [stop]);

    const start = useCallback((e: PointerEvent<HTMLElement>) => {
        if (disabled || e.button !== 0) return;
        stop();
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
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !disabled) stepRef.current(1);
    }, [disabled]);

    return {
        onPointerDown: start,
        onPointerUp: stop,
        onPointerLeave: stop,
        onPointerCancel: stop,
        onBlur: stop,
        onKeyDown,
        // The pointer already stepped on press; a mouse/touch click must not step again.
        onClick: (e: React.MouseEvent) => e.preventDefault(),
    };
}
