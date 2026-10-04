import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { computerKeyLabel, isBlackKey, pitchClass, spanishNoteLabel, spanishNoteName } from '../../audio/piano/notes';
import { velocityFromPointer } from './pianoUi';
import './piano.css';

export interface PianoKeyboardProps {
    /** Lowest key (a C). */
    startMidi: number;
    octaves?: number;
    /** Keys currently held (pointer, keyboard or Enter). */
    pressed: ReadonlySet<number>;
    /** Pitch classes of the chord that is sounding. */
    chordPcs?: ReadonlySet<number>;
    chordRootPc?: number | null;
    /** Pitch classes of the selected scale (null: no scale shown). */
    scalePcs?: ReadonlySet<number> | null;
    /** Show the computer-keyboard letter on each key. */
    showKeyHints?: boolean;
    onNoteOn: (midi: number, velocity: number) => void;
    onNoteOff: (midi: number) => void;
}

const midiFromElement = (el: Element | null): number | null => {
    const key = el?.closest<HTMLElement>('[data-midi]');
    if (!key) return null;
    const midi = Number(key.dataset.midi);
    return Number.isFinite(midi) ? midi : null;
};

/**
 * On-screen piano. Pointer handling is per pointer id (multi-touch), and a pointer that
 * slides across keys plays each one (glissando) without ever leaving a note stuck:
 * the container captures the pointer, so up/cancel always arrive here.
 *
 * (ES) Teclado de piano en pantalla: multitáctil y con glissando seguro.
 */
export default function PianoKeyboard({
    startMidi, octaves = 2, pressed, chordPcs, chordRootPc = null, scalePcs = null, showKeyHints = false, onNoteOn, onNoteOff,
}: PianoKeyboardProps) {
    const keys = useMemo(() => Array.from({ length: octaves * 12 + 1 }, (_, i) => startMidi + i), [startMidi, octaves]);
    const whiteKeys = keys.filter(m => !isBlackKey(m));
    const pointers = useRef(new Map<number, number>()); // pointerId -> MIDI note it holds
    const [focusMidi, setFocusMidi] = useState(startMidi);
    const keyRefs = useRef(new Map<number, HTMLButtonElement>());
    const enterHeld = useRef(new Set<number>());

    const tabStop = keys.includes(focusMidi) ? focusMidi : startMidi;

    const release = useCallback((pointerId: number) => {
        const midi = pointers.current.get(pointerId);
        if (midi === undefined) return;
        pointers.current.delete(pointerId);
        onNoteOff(midi);
    }, [onNoteOff]);

    // Lift every pointer note if the keyboard disappears or shifts octave mid-gesture.
    useEffect(() => {
        const held = pointers.current;
        return () => {
            held.forEach(midi => onNoteOff(midi));
            held.clear();
        };
    }, [startMidi, onNoteOff]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const target = e.target as Element;
        const midi = midiFromElement(target);
        if (midi === null) return;
        e.preventDefault(); // no text selection / focus stealing / emulated mouse events
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            // Synthetic events (tests) have no active pointer to capture.
        }
        release(e.pointerId);
        pointers.current.set(e.pointerId, midi);
        const keyEl = target.closest<HTMLElement>('[data-midi]');
        // preventDefault suppressed the native focus: move it to the key explicitly so the
        // computer keyboard (scoped to focus inside the panel) works right after a click.
        keyEl?.focus({ preventScroll: true });
        setFocusMidi(midi);
        onNoteOn(midi, keyEl ? velocityFromPointer(e.clientY, keyEl.getBoundingClientRect()) : 0.8);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const current = pointers.current.get(e.pointerId);
        if (current === undefined) return;
        // With pointer capture the target stays the container: look up what is under the finger.
        const under = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(e.clientX, e.clientY) : null;
        const midi = midiFromElement(under);
        if (midi === current) return;
        release(e.pointerId);
        if (midi !== null && e.currentTarget.contains(under)) {
            pointers.current.set(e.pointerId, midi);
            onNoteOn(midi, 0.7);
        }
    };

    const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => release(e.pointerId);

    const handleKeyDown = (midi: number, e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!e.repeat && !enterHeld.current.has(midi)) {
                enterHeld.current.add(midi);
                onNoteOn(midi, 0.8);
            }
            return;
        }
        // Roving focus between keys (Up/Down stay the global tempo shortcuts).
        const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        const edge = e.key === 'Home' ? keys[0] : e.key === 'End' ? keys[keys.length - 1] : null;
        if (!delta && edge === null) return;
        e.preventDefault();
        const next = edge ?? Math.min(keys[keys.length - 1], Math.max(keys[0], midi + delta));
        setFocusMidi(next);
        keyRefs.current.get(next)?.focus();
    };

    const handleKeyUp = (midi: number, e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key !== 'Enter' || !enterHeld.current.has(midi)) return;
        e.preventDefault();
        enterHeld.current.delete(midi);
        onNoteOff(midi);
    };

    const handleBlur = (midi: number) => {
        if (enterHeld.current.delete(midi)) onNoteOff(midi);
    };

    const renderKey = (midi: number) => {
        const black = isBlackKey(midi);
        const pc = pitchClass(midi);
        const inChord = chordPcs?.has(pc) ?? false;
        const isRoot = inChord && chordRootPc === pc;
        const inScale = scalePcs?.has(pc) ?? false;
        const whiteIndex = whiteKeys.findIndex(w => w > midi); // first white key to the right
        const hint = showKeyHints ? computerKeyLabel(midi - startMidi) : null;
        const classes = [
            'piano-key',
            black ? 'piano-key--black' : 'piano-key--white',
            inChord ? 'is-chord' : '',
            isRoot ? 'is-root' : '',
            scalePcs ? (inScale ? 'is-scale' : 'is-outside') : '',
        ].filter(Boolean).join(' ');
        return (
            <button
                key={midi}
                type="button"
                ref={el => { if (el) keyRefs.current.set(midi, el); else keyRefs.current.delete(midi); }}
                className={classes}
                data-midi={midi}
                data-testid={`piano-key-${midi}`}
                data-chord={inChord || undefined}
                aria-label={spanishNoteLabel(midi) + (isRoot ? ', fundamental del acorde' : inChord ? ', nota del acorde' : '')}
                aria-pressed={pressed.has(midi)}
                tabIndex={midi === tabStop ? 0 : -1}
                onFocus={() => setFocusMidi(midi)}
                onKeyDown={e => handleKeyDown(midi, e)}
                onKeyUp={e => handleKeyUp(midi, e)}
                onBlur={() => handleBlur(midi)}
                onContextMenu={e => e.preventDefault()}
                style={black ? { left: `calc(${whiteIndex} * var(--piano-white-w) - var(--piano-black-w) / 2)` } : undefined}
            >
                {!black && (
                    <span className="piano-key__name" aria-hidden="true">
                        {spanishNoteName(midi)}{pc === 0 ? Math.floor(midi / 12) - 1 : ''}
                    </span>
                )}
                {hint && <span className="piano-key__hint" aria-hidden="true">{hint}</span>}
            </button>
        );
    };

    return (
        <div className="piano-scroll" data-testid="piano-scroll">
            <div
                className="piano-keys"
                role="group"
                aria-label="Teclado de piano"
                style={{ ['--piano-white-count' as string]: whiteKeys.length }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onLostPointerCapture={handlePointerEnd}
            >
                {whiteKeys.map(renderKey)}
                {keys.filter(isBlackKey).map(renderKey)}
            </div>
        </div>
    );
}
