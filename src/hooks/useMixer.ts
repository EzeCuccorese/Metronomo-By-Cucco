import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { CHANNEL_IDS, getChannelForInstrument } from '../audio/instrumentChannels';
import type { ChannelId } from '../audio/instrumentChannels';
import { CUSTOM_PATTERN_ID, isMetronomePattern } from '../rhythms/patternLibrary';
import { usePersistentState } from './usePersistentState';
import { isBoolean, isNumber, isPlainObject, isString } from '../state/storage';
import { isMelody } from '../audio/piano/melody';
import type { Melody } from '../audio/piano/melody';

export interface ChannelState {
    id: ChannelId;
    name: string;
    volume: number;
    pan: number;
    isMuted: boolean;
}

interface MixerState {
    channels: ChannelState[];
    /** Pattern for which the automatic click mute rule was last applied. */
    clickRulePatternId: string | null;
}

const INITIAL_CHANNELS: ChannelState[] = [
    { id: 'bombo', name: 'BOMBO', volume: 1.0, pan: 0.0, isMuted: false },
    { id: 'clave', name: 'CLAVE', volume: 1.0, pan: -0.15, isMuted: false },
    { id: 'shaker', name: 'SHAKER', volume: 0.8, pan: 0.25, isMuted: false },
    { id: 'kick', name: 'KICK', volume: 1.0, pan: 0.0, isMuted: false },
    { id: 'snare', name: 'REDO', volume: 0.9, pan: -0.1, isMuted: false },
    { id: 'hihat', name: 'HI-HAT', volume: 0.85, pan: 0.2, isMuted: false },
    { id: 'click', name: 'CLICK', volume: 0.9, pan: 0.05, isMuted: false },
    { id: 'synth', name: 'TECLADO', volume: 0.7, pan: -0.3, isMuted: false },
    { id: 'piano', name: 'PIANO', volume: 0.9, pan: 0.1, isMuted: false },
];

const INITIAL_MIXER: MixerState = { channels: INITIAL_CHANNELS, clickRulePatternId: null };

const isChannelState = (v: unknown): v is ChannelState =>
    isPlainObject(v) && isString(v.id) && (CHANNEL_IDS as readonly string[]).includes(v.id) && isString(v.name) &&
    isNumber(v.volume) && v.volume >= 0 && v.volume <= 1.5 && isNumber(v.pan) && v.pan >= -1 && v.pan <= 1 && isBoolean(v.isMuted);

/**
 * Keeps every valid stored channel and adds the ones this version introduced
 * (e.g. PIANO), so an upgrade never resets the user's mix.
 */
export const sanitizeMixerState = (v: unknown): MixerState | undefined => {
    if (!isPlainObject(v) || !Array.isArray(v.channels)) return undefined;
    if (!(v.clickRulePatternId === null || isString(v.clickRulePatternId))) return undefined;
    const stored = new Map<string, ChannelState>();
    v.channels.forEach(ch => { if (isChannelState(ch) && !stored.has(ch.id)) stored.set(ch.id, ch); });
    if (stored.size === 0) return undefined;
    const channels = INITIAL_CHANNELS.map(def => stored.get(def.id) ?? def);
    return { channels, clickRulePatternId: v.clickRulePatternId };
};

/** Rhythm presets bring their own groove, so the guide click starts muted there. */
const shouldMuteClick = (pattern: RhythmPattern) =>
    !(isMetronomePattern(pattern) || pattern.id === CUSTOM_PATTERN_ID);

export interface MixerEngine {
    onVolumeChange: (channel: string, volume: number) => void;
    onPanChange: (channel: string, pan: number) => void;
    onMuteChange: (channel: string, muted: boolean) => void;
}

/** Names shown in the mixer (the stored `name` is the old upper-case label). */
export const CHANNEL_LABELS: Record<ChannelId, string> = {
    bombo: 'Bombo',
    clave: 'Clave',
    shaker: 'Shaker',
    kick: 'Bombo de batería',
    snare: 'Redoblante',
    hihat: 'Hi-hat',
    click: 'Click',
    synth: 'Teclado',
    piano: 'Piano',
};

export type MixerView = 'console' | 'compact';
const isMixerView = (v: unknown): v is MixerView => v === 'console' || v === 'compact';
const PHONE_QUERY = '(max-width: 599.98px)';

/** Linear gain -> dB for the readout (1.0 = 0 dB). */
export const gainToDb = (gain: number): number => (gain <= 0 ? -Infinity : 20 * Math.log10(gain));
export const formatDb = (gain: number): string => {
    const db = gainToDb(gain);
    return db === -Infinity ? '−∞ dB' : `${db > 0.05 ? '+' : db < -0.05 ? '−' : ''}${Math.abs(db).toFixed(0)} dB`;
};

export interface MixerApi {
    /** Every channel, in console order (this is what is saved and sent to the engine). */
    channels: ChannelState[];
    /** The strips to draw: the ones this rhythm and the harmony/piano use, or all of them. */
    visibleChannels: ChannelState[];
    showAll: boolean;
    setShowAll: (showAll: boolean) => void;
    view: MixerView;
    setView: (view: MixerView) => void;
    /** Channels in solo (while any is, only those sound). */
    solo: ReadonlySet<ChannelId>;
    toggleSolo: (id: ChannelId) => void;
    setVolume: (id: ChannelId, volume: number) => void;
    setPan: (id: ChannelId, pan: number) => void;
    toggleMute: (id: ChannelId) => void;
}

const isSequenceNotEmpty = (v: unknown): v is unknown[] => Array.isArray(v);
const isStoredMelody = (v: unknown): v is Melody | null => v === null || isMelody(v);

/**
 * The mix (volumes, pan, mutes, solo), its persistence and its link to the audio engine.
 * It lives in App, not in the mixer card: hiding or folding the card must never change the sound.
 *
 * (ES) La mezcla vive en App: ocultar o plegar el mezclador no cambia el sonido.
 */
export function useMixer(pattern: RhythmPattern, { onVolumeChange, onPanChange, onMuteChange }: MixerEngine): MixerApi {
    const [mixer, setMixer] = usePersistentState<MixerState>('mixer', INITIAL_MIXER, { sanitize: sanitizeMixerState });
    const [showAll, setShowAll] = usePersistentState('mixer.showAll', false, isBoolean);
    const [storedView, setView] = usePersistentState<MixerView | null>('mixer.view', null, (v): v is MixerView | null => v === null || isMixerView(v));
    const [solo, setSolo] = useState<ReadonlySet<ChannelId>>(() => new Set());
    // Same persisted values the harmony and piano cards write (see usePersistentState): no state is threaded through.
    const [sequence] = usePersistentState<unknown[]>('harmony.sequence', [], isSequenceNotEmpty);
    const [melody] = usePersistentState<Melody | null>('piano.melody.v1', null, isStoredMelody);
    const channels = mixer.channels;

    // Push mixer changes to the engine (only what changed, to avoid piling up automation events).
    // While any channel is in solo, only the soloed ones sound; mutes come back when the solo ends.
    const pushedRef = useRef<Partial<Record<ChannelId, { volume: number; pan: number; muted: boolean }>>>({});
    useEffect(() => {
        channels.forEach(ch => {
            const muted = solo.size > 0 ? !solo.has(ch.id) : ch.isMuted;
            const prev = pushedRef.current[ch.id];
            if (prev?.volume !== ch.volume) onVolumeChange(ch.id, ch.volume);
            if (prev?.pan !== ch.pan) onPanChange(ch.id, ch.pan);
            if (prev?.muted !== muted) onMuteChange(ch.id, muted);
            pushedRef.current[ch.id] = { volume: ch.volume, pan: ch.pan, muted };
        });
    }, [channels, solo, onVolumeChange, onPanChange, onMuteChange]);

    // Automatic click mute when the selected pattern changes (not on reload of the same pattern).
    if (mixer.clickRulePatternId !== pattern.id) {
        const muteClick = shouldMuteClick(pattern);
        setMixer(prev => ({
            clickRulePatternId: pattern.id,
            channels: prev.channels.map(ch => ch.id === 'click' ? { ...ch, isMuted: muteClick } : ch),
        }));
    }

    const update = useCallback((id: ChannelId, patch: (ch: ChannelState) => Partial<ChannelState>) => {
        setMixer(prev => ({ ...prev, channels: prev.channels.map(ch => ch.id === id ? { ...ch, ...patch(ch) } : ch) }));
    }, [setMixer]);

    const setVolume = useCallback((id: ChannelId, volume: number) => update(id, () => ({ volume })), [update]);
    const setPan = useCallback((id: ChannelId, pan: number) => update(id, () => ({ pan })), [update]);
    const toggleMute = useCallback((id: ChannelId) => update(id, ch => ({ isMuted: !ch.isMuted })), [update]);
    const toggleSolo = useCallback((id: ChannelId) => setSolo(prev => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
    }), []);

    const used = useMemo(() => {
        const ids = new Set<ChannelId>(['click']);
        pattern.steps.forEach(step => ids.add(getChannelForInstrument(step.instrument)));
        if (sequence.length > 0) { ids.add('synth'); ids.add('piano'); }
        if (melody) ids.add('piano');
        return ids;
    }, [pattern, sequence.length, melody]);
    // A soloed channel stays on screen so its Solo can be switched off.
    const visibleChannels = useMemo(
        () => showAll ? channels : channels.filter(ch => used.has(ch.id) || solo.has(ch.id)),
        [channels, showAll, used, solo],
    );

    const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches);
    useEffect(() => {
        const query = window.matchMedia(PHONE_QUERY);
        const onChange = (e: MediaQueryListEvent) => setPhone(e.matches);
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);
    const view: MixerView = storedView ?? (phone ? 'compact' : 'console');

    return { channels, visibleChannels, showAll, setShowAll, view, setView, solo, toggleSolo, setVolume, setPan, toggleMute };
}
