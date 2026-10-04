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
    /** Velocity (0..1) for the notes played from the computer keyboard. */
    velocity?: number;
    /** C / V: one level softer / louder. */
    onVelocityShift?: (delta: -1 | 1) => void;
    /** Shift held = sustain pedal down. */
    onSustain?: (down: boolean) => void;
    /** Esc */
    onExit?: () => void;
}

/** Five velocity levels for the computer keyboard (C / V), like the Ableton convention. */
export const VELOCITY_LEVELS = [0.4, 0.55, 0.7, 0.85, 1] as const;
export const DEFAULT_VELOCITY_LEVEL = 3;
export const COMPUTER_KEY_VELOCITY = VELOCITY_LEVELS[DEFAULT_VELOCITY_LEVEL];

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

    const shifts = useRef(new Set<string>()); // Shift keys held (the pedal)

    usePianoScope(options.globalEnabled, () => !!ref.current.containerRef.current?.contains(document.activeElement));

    useShortcutHandlers({
        'piano.notes': {
            down: e => {
                const semitone = COMPUTER_KEY_SEMITONES[e.code];
                if (semitone === undefined || held.current.has(e.code)) return;
                const midi = ref.current.baseMidi + semitone;
                held.current.set(e.code, midi);
                ref.current.onNoteOn(midi, ref.current.velocity ?? COMPUTER_KEY_VELOCITY);
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
        'piano.velocity-down': () => ref.current.onVelocityShift?.(-1),
        'piano.velocity-up': () => ref.current.onVelocityShift?.(1),
        'piano.sustain': {
            down: e => {
                shifts.current.add(e.code);
                if (shifts.current.size === 1) ref.current.onSustain?.(true);
            },
            up: e => {
                if (!shifts.current.delete(e.code) || shifts.current.size > 0) return;
                ref.current.onSustain?.(false);
            },
        },
        'piano.exit': () => ref.current.onExit?.(),
    });

    useEffect(() => {
        const map = held.current;
        const releaseAll = () => {
            map.forEach(midi => ref.current.onNoteOff(midi));
            map.clear();
            if (shifts.current.size > 0) {
                shifts.current.clear();
                ref.current.onSustain?.(false);
            }
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
