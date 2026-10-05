import { useCallback, useEffect, useRef } from 'react';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { CHANNEL_IDS } from '../audio/instrumentChannels';
import type { ChannelId } from '../audio/instrumentChannels';
import { CUSTOM_PATTERN_ID, isMetronomePattern } from '../rhythms/patternLibrary';
import { usePersistentState } from './usePersistentState';
import { isBoolean, isNumber, isPlainObject, isString } from '../state/storage';

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

export interface MixerApi {
    channels: ChannelState[];
    setVolume: (id: ChannelId, volume: number) => void;
    setPan: (id: ChannelId, pan: number) => void;
    toggleMute: (id: ChannelId) => void;
}

/**
 * The mix (volumes, pan, mutes), its persistence and its link to the audio engine.
 * It lives in App, not in the mixer card: hiding or folding the card must never change the sound.
 *
 * (ES) La mezcla vive en App: ocultar o plegar el mezclador no cambia el sonido.
 */
export function useMixer(pattern: RhythmPattern, { onVolumeChange, onPanChange, onMuteChange }: MixerEngine): MixerApi {
    const [mixer, setMixer] = usePersistentState<MixerState>('mixer', INITIAL_MIXER, { sanitize: sanitizeMixerState });
    const channels = mixer.channels;

    // Push mixer changes to the engine (only what changed, to avoid piling up automation events).
    const pushedRef = useRef<Partial<Record<ChannelId, ChannelState>>>({});
    useEffect(() => {
        channels.forEach(ch => {
            const prev = pushedRef.current[ch.id];
            if (prev?.volume !== ch.volume) onVolumeChange(ch.id, ch.volume);
            if (prev?.pan !== ch.pan) onPanChange(ch.id, ch.pan);
            if (prev?.isMuted !== ch.isMuted) onMuteChange(ch.id, ch.isMuted);
            pushedRef.current[ch.id] = ch;
        });
    }, [channels, onVolumeChange, onPanChange, onMuteChange]);

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

    return { channels, setVolume, setPan, toggleMute };
}
