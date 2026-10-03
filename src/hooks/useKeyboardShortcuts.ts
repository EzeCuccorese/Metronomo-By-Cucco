import { useEffect, useRef } from 'react';

interface Shortcuts {
    onTogglePlay: () => void;
    onTap: () => void;
    onNudgeBpm: (delta: number) => void;
}

/**
 * Elements that already react to Space/arrows on their own. Handling the key
 * globally there would double-trigger (e.g. a focused button "clicks" on Space).
 */
const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)) return true;
    return !!target.closest('[role="slider"], [role="button"], [role="option"], [role="listbox"], [role="menu"], [role="dialog"], [role="spinbutton"]');
};

/**
 * Global shortcuts: Space = play/stop, T = tap tempo, ↑/↓ = ±1 BPM (Shift: ±5).
 * (ES) Atajos globales de teclado.
 */
export function useKeyboardShortcuts(shortcuts: Shortcuts) {
    const ref = useRef(shortcuts);
    useEffect(() => {
        ref.current = shortcuts;
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || (e.repeat && e.code === 'Space')) return;
            if (isInteractiveTarget(e.target)) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    ref.current.onTogglePlay();
                    break;
                case 'KeyT':
                    ref.current.onTap();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    ref.current.onNudgeBpm(e.shiftKey ? 5 : 1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    ref.current.onNudgeBpm(e.shiftKey ? -5 : -1);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
}
