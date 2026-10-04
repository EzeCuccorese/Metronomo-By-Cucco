import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { COMPUTER_KEY_SEMITONES } from '../audio/piano/notes';
import { usePianoScope, useShortcutHandlers } from '../shortcuts/dispatcher';

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

/**
 * Plays the piano from the computer keyboard: A W S E D F T G Y H U J K O L P Ñ (one octave
 * and a third), Z / X shift the octave. The keys themselves are declared in the shortcut
 * registry and routed by its single dispatcher; this hook only keeps the piano's own
 * held-key bookkeeping (which note each physical key started, release on blur / hide).
 *
 * (ES) Tocar el piano con el teclado de la computadora.
 */
export function usePianoComputerKeyboard(options: Options) {
    const ref = useRef(options);
    useEffect(() => {
        ref.current = options;
    });

    const held = useRef(new Map<string, number>()); // KeyboardEvent.code -> MIDI note it started

    usePianoScope(options.globalEnabled, () => !!ref.current.containerRef.current?.contains(document.activeElement));

    useShortcutHandlers({
        'piano.notes': {
            down: e => {
                const semitone = COMPUTER_KEY_SEMITONES[e.code];
                if (semitone === undefined || held.current.has(e.code)) return;
                const midi = ref.current.baseMidi + semitone;
                held.current.set(e.code, midi);
                ref.current.onNoteOn(midi, COMPUTER_KEY_VELOCITY);
            },
            up: e => {
                const midi = held.current.get(e.code);
                if (midi === undefined) return;
                held.current.delete(e.code);
                e.preventDefault();
                ref.current.onNoteOff(midi);
            },
        },
        'piano.octave-down': () => ref.current.onOctaveShift(-1),
        'piano.octave-up': () => ref.current.onOctaveShift(1),
    });

    useEffect(() => {
        const map = held.current;
        const releaseAll = () => {
            map.forEach(midi => ref.current.onNoteOff(midi));
            map.clear();
        };
        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') releaseAll();
        };
        window.addEventListener('blur', releaseAll);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('blur', releaseAll);
            document.removeEventListener('visibilitychange', handleVisibility);
            releaseAll();
        };
    }, []);
}
