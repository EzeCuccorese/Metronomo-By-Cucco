import { useEffect, useRef } from 'react';

interface Shortcuts {
    onTogglePlay: () => void;
    onTap: () => void;
    onNudgeBpm: (delta: number) => void;
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time']);

/** Places where typing must never trigger shortcuts. */
const isTextEditing = (el: HTMLElement): boolean => {
    if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
    return el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type);
};

/** Widgets that use Space and/or arrows themselves (sliders, menus, checkboxes, open dialogs…). */
const ownsKeys = (el: HTMLElement): boolean => {
    if (el instanceof HTMLInputElement) return true; // checkbox, radio, range, switch
    return !!el.closest('[role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="option"], [role="menu"], [role="menuitem"], [role="radio"], [role="tab"], [role="dialog"]');
};

/**
 * Global shortcuts: Space = play/stop, T = tap tempo, ↑/↓ = ±1 BPM (Shift: ±5).
 * They also work while a plain button has focus (after clicking Play, Tap, a grid cell…):
 * for a metronome, Space must always mean play/stop. Buttons stay operable with Enter.
 *
 * (ES) Atajos globales de teclado.
 */
export function useKeyboardShortcuts(shortcuts: Shortcuts) {
    const ref = useRef(shortcuts);
    useEffect(() => {
        ref.current = shortcuts;
    });

    useEffect(() => {
        let swallowSpaceKeyup = false;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
            const target = e.target instanceof HTMLElement ? e.target : null;
            if (target && (isTextEditing(target) || ownsKeys(target))) return;

            switch (e.code) {
                case 'Space':
                    // Stop the focused button from also "clicking" (browsers activate it on keyup).
                    e.preventDefault();
                    swallowSpaceKeyup = true;
                    if (!e.repeat) ref.current.onTogglePlay();
                    break;
                case 'KeyT':
                    if (!e.repeat) ref.current.onTap();
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

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space' && swallowSpaceKeyup) {
                swallowSpaceKeyup = false;
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp, true);
        };
    }, []);
}
