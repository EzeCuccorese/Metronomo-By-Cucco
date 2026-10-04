import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { COMPUTER_KEY_SEMITONES, OCTAVE_KEYS } from '../audio/piano/notes';
import { isTextEditing } from './useKeyboardShortcuts';

interface Options {
    /** Play from anywhere on the page (otherwise only while focus is inside `containerRef`). */
    globalEnabled: boolean;
    containerRef: RefObject<HTMLElement | null>;
    /** MIDI note of the key mapped to "A". */
    baseMidi: number;
    onNoteOn: (midi: number, velocity: number) => void;
    onNoteOff: (midi: number) => void;
    onOctaveShift: (delta: -1 | 1) => void;
}

export const COMPUTER_KEY_VELOCITY = 0.8;

/** Widgets whose own keys must never become notes. */
const OWNS_LETTERS = '[role="dialog"], [role="listbox"], [role="menu"], [role="combobox"], [role="option"]';

/**
 * Plays the piano from the computer keyboard: A W S E D F T G Y H U J K O L P Ñ (one octave
 * and a third), Z / X shift the octave. It listens in the capture phase and marks the
 * handled keys, so the global shortcuts (T = tap tempo) stand aside only for those keys;
 * Space (play/stop) and the arrows (tempo) keep working.
 *
 * (ES) Tocar el piano con el teclado de la computadora.
 */
export function usePianoComputerKeyboard(options: Options) {
    const ref = useRef(options);
    useEffect(() => {
        ref.current = options;
    });

    useEffect(() => {
        const held = new Map<string, number>(); // KeyboardEvent.code -> MIDI note it started

        const isActive = () => {
            const { globalEnabled, containerRef } = ref.current;
            return globalEnabled || !!containerRef.current?.contains(document.activeElement);
        };

        const releaseAll = () => {
            held.forEach(midi => ref.current.onNoteOff(midi));
            held.clear();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
            const target = e.target instanceof Element ? e.target : null; // SVG icons are Elements, not HTMLElements
            if (target && ((target instanceof HTMLElement && isTextEditing(target)) || target.closest(OWNS_LETTERS))) return;
            if (!isActive()) return;

            const shift = OCTAVE_KEYS[e.code];
            if (shift) {
                e.preventDefault();
                if (!e.repeat) ref.current.onOctaveShift(shift);
                return;
            }
            const semitone = COMPUTER_KEY_SEMITONES[e.code];
            if (semitone === undefined) return;
            e.preventDefault();
            if (e.repeat || held.has(e.code)) return;
            const midi = ref.current.baseMidi + semitone;
            held.set(e.code, midi);
            ref.current.onNoteOn(midi, COMPUTER_KEY_VELOCITY);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const midi = held.get(e.code);
            if (midi === undefined) return;
            held.delete(e.code);
            e.preventDefault();
            ref.current.onNoteOff(midi);
        };

        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') releaseAll();
        };

        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyUp, true);
        window.addEventListener('blur', releaseAll);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyUp, true);
            window.removeEventListener('blur', releaseAll);
            document.removeEventListener('visibilitychange', handleVisibility);
            releaseAll();
        };
    }, []);
}
