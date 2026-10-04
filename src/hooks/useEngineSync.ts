import { useEffect } from 'react';
import type { AccompanimentStyle } from '../audio/PolyphonicSynth';
import { isMelody } from '../audio/piano/melody';
import type { Melody } from '../audio/piano/melody';
import { usePersistentState } from './usePersistentState';
import { isBoolean, isNumber, isPlainObject, isString } from '../state/storage';

/**
 * Keeps the audio engine in step with settings that are edited in a card (Armonía, Piano).
 * These hooks live in App: the card may be hidden (unmounted) or folded and the sound must not change.
 * They read the very same persisted values the cards write (see `usePersistentState`, which keeps
 * every instance of a key in step), so no state needs to be threaded through the cards.
 *
 * (ES) Estos hooks viven en App: ocultar o plegar una tarjeta no cambia lo que suena.
 */

export interface HarmonyEngine {
    setHarmonyProgression: (progression: string[][]) => void;
    setHarmonyVolume: (volume: number) => void;
    setAccompanimentStyle: (style: AccompanimentStyle) => void;
}

interface ChordStep {
    degree: string;
    durationUnits: number;
    notes: string[];
}

// Same shapes the Armonía card validates (it is the stricter one); here only what the engine needs.
const isChordStep = (v: unknown): v is ChordStep =>
    isPlainObject(v) && isString(v.degree) && isNumber(v.durationUnits) && v.durationUnits >= 1 &&
    Array.isArray(v.notes) && v.notes.every(isString);
const isSequence = (v: unknown): v is ChordStep[] => Array.isArray(v) && v.every(isChordStep);
const isVolume = (v: unknown): v is number => isNumber(v) && v >= 0 && v <= 1;
const isStyle = (v: unknown): v is AccompanimentStyle => isString(v);

const MODE_NAMES: Record<string, string> = { major: 'mayor', minor: 'menor', dorian: 'dórico', mixolydian: 'mixolidio' };

/** Pushes the chord progression, style and volume to the engine; returns a one-line summary for the folded card. */
export function useHarmonySync({ setHarmonyProgression, setHarmonyVolume, setAccompanimentStyle }: HarmonyEngine): string {
    const [sequence] = usePersistentState<ChordStep[]>('harmony.sequence', [], isSequence);
    const [style] = usePersistentState<AccompanimentStyle>('harmony.style', 'pad', isStyle);
    const [volume] = usePersistentState('harmony.volume', 0.3, isVolume);
    const [rootKey] = usePersistentState('harmony.key', 'C', isString);
    const [mode] = usePersistentState('harmony.mode', 'major', isString);

    useEffect(() => { setAccompanimentStyle(style); }, [style, setAccompanimentStyle]);
    useEffect(() => { setHarmonyVolume(volume); }, [volume, setHarmonyVolume]);
    useEffect(() => {
        // One entry per half bar: each chord repeats for as many half bars as it lasts.
        const progression: string[][] = [];
        sequence.forEach(step => {
            for (let i = 0; i < step.durationUnits; i++) progression.push(step.notes);
        });
        setHarmonyProgression(progression);
    }, [sequence, setHarmonyProgression]);

    const degrees = sequence.map(step => step.degree).join('–');
    return `${rootKey} ${MODE_NAMES[mode] ?? mode} · ${degrees || 'sin acordes'}`;
}

export interface MelodyEngine {
    setMelody: (melody: Melody | null) => void;
}

const isLoopSettings = (v: unknown): v is { loop: boolean } => isPlainObject(v) && isBoolean(v.loop);
const isStoredMelody = (v: unknown): v is Melody | null => v === null || isMelody(v);

/** Pushes the recorded melody loop to the engine (it keeps looping while the piano card is hidden). */
export function useMelodySync({ setMelody }: MelodyEngine): void {
    const [settings] = usePersistentState<{ loop: boolean }>('piano.settings', { loop: true }, isLoopSettings);
    const [melody] = usePersistentState<Melody | null>('piano.melody.v1', null, isStoredMelody);
    useEffect(() => { setMelody(settings.loop ? melody : null); }, [melody, settings.loop, setMelody]);
}
