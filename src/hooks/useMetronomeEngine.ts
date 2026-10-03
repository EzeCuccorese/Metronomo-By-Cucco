import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Scheduler from '../audio/Scheduler';
import AudioContextManager from '../audio/AudioContextManager';
import type { FormGenre, PlaybackEvent, TrainerConfig } from '../audio/Scheduler';
import type { AccompanimentStyle } from '../audio/PolyphonicSynth';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { createPlaybackStore } from '../state/playbackStore';

interface EngineOptions {
    pattern: RhythmPattern;
    bpm: number;
    /** The engine changed tempo on its own (speed trainer, preset switch at the bar line). */
    onBpmChange: (bpm: number) => void;
    /** The engine switched the sounding pattern (queued switch reached the bar line, or stop while queued). */
    onPatternChange: (pattern: RhythmPattern) => void;
}

interface ChannelSettings {
    volume?: number;
    pan?: number;
    muted?: boolean;
}

/**
 * Settings are mirrored here and replayed onto every new Scheduler. Child components
 * run their effects before this hook creates the scheduler, so nothing may be lost.
 */
interface EngineSettings {
    channels: Record<string, ChannelSettings>;
    harmony: string[][];
    harmonyVolume: number | null;
    accompaniment: AccompanimentStyle | null;
    trainer: TrainerConfig | null;
    silence: { active: boolean; chance: number } | null;
    formas: { enabled: boolean; genre: FormGenre; introBars: number } | null;
}

/**
 * Owns the audio Scheduler for the lifetime of the component and exposes a
 * React-friendly API. High-frequency playback data is published to `store`.
 *
 * (ES) Dueño del Scheduler de audio; expone una API para React.
 */
export function useMetronomeEngine({ pattern, bpm, onBpmChange, onPatternChange }: EngineOptions) {
    const store = useMemo(() => createPlaybackStore(), []);
    const schedulerRef = useRef<Scheduler | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(false);
    const startingRef = useRef(false);

    const settingsRef = useRef<EngineSettings>({
        channels: {}, harmony: [], harmonyVolume: null, accompaniment: null, trainer: null, silence: null, formas: null
    });
    const callbacksRef = useRef({ onBpmChange, onPatternChange });
    const patternRef = useRef(pattern);
    const bpmRef = useRef(bpm);
    const lastEngineBpmRef = useRef(bpm);
    const pendingPatternRef = useRef<RhythmPattern | null>(null);

    useEffect(() => {
        callbacksRef.current = { onBpmChange, onPatternChange };
        patternRef.current = pattern;
        bpmRef.current = bpm;
    });

    const setPlaying = useCallback((value: boolean) => {
        isPlayingRef.current = value;
        setIsPlaying(value);
    }, []);

    // --- Scheduler lifecycle ---
    useEffect(() => {
        const scheduler = new Scheduler();
        const s = settingsRef.current;
        Object.entries(s.channels).forEach(([name, ch]) => {
            if (ch.volume !== undefined) scheduler.setChannelVolume(name, ch.volume);
            if (ch.pan !== undefined) scheduler.setChannelPan(name, ch.pan);
            if (ch.muted !== undefined) scheduler.setChannelMute(name, ch.muted);
        });
        scheduler.setHarmonyProgression(s.harmony);
        if (s.harmonyVolume !== null) scheduler.setHarmonyVolume(s.harmonyVolume);
        if (s.accompaniment) scheduler.setAccompanimentStyle(s.accompaniment);
        if (s.trainer) scheduler.configureTrainer(s.trainer);
        if (s.silence) scheduler.setSilenceMode(s.silence.active, s.silence.chance);
        if (s.formas) scheduler.configureFormas(s.formas.enabled, s.formas.genre, s.formas.introBars);
        scheduler.setPattern(patternRef.current);
        scheduler.setTempo(bpmRef.current);
        lastEngineBpmRef.current = bpmRef.current;

        scheduler.setOnPlaybackUpdate((event: PlaybackEvent) => {
            store.update({
                step: event.step,
                chordIndex: event.chordIndex,
                trainerBar: event.trainerBar,
                totalBars: event.totalBars,
                formState: event.formState,
                queuedPatternId: event.queuedPatternId,
            });
            // Compare by id: queued events may still carry the pre-edit object of the same pattern.
            if (event.pattern.id !== patternRef.current.id) {
                if (event.pattern === pendingPatternRef.current) pendingPatternRef.current = null;
                callbacksRef.current.onPatternChange(event.pattern);
            }
            if (event.bpm !== lastEngineBpmRef.current) {
                lastEngineBpmRef.current = event.bpm;
                if (event.bpm !== bpmRef.current) callbacksRef.current.onBpmChange(event.bpm);
            }
        });
        scheduler.setOnStopped(() => {
            setPlaying(false);
            store.update({ chordIndex: -1, queuedPatternId: null });
        });

        schedulerRef.current = scheduler;
        return () => {
            scheduler.dispose();
            if (schedulerRef.current === scheduler) schedulerRef.current = null;
            isPlayingRef.current = false;
        };
    }, [store, setPlaying]);

    // --- Pattern & tempo sync ---
    useEffect(() => {
        schedulerRef.current?.setPattern(pattern);
    }, [pattern]);

    useEffect(() => {
        lastEngineBpmRef.current = bpm;
        schedulerRef.current?.setTempo(bpm);
    }, [bpm]);

    // Mobile browsers suspend audio in the background; resume when the page is visible again.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && isPlayingRef.current) {
                void AudioContextManager.getInstance().resume();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    // --- Transport ---
    const start = useCallback(async () => {
        if (isPlayingRef.current || startingRef.current) return;
        startingRef.current = true;
        try {
            await AudioContextManager.getInstance().resume();
            const scheduler = schedulerRef.current;
            if (!scheduler) return;
            scheduler.resetPracticeStats();
            scheduler.start();
            store.update({ step: 0, totalBars: 0, trainerBar: 0, formState: null });
            setPlaying(true);
        } finally {
            startingRef.current = false;
        }
    }, [store, setPlaying]);

    const stop = useCallback(() => {
        const scheduler = schedulerRef.current;
        if (!scheduler || !isPlayingRef.current) return;
        scheduler.stop();
        setPlaying(false);
        store.update({ chordIndex: -1, queuedPatternId: null });

        // A switch requested during playback that never reached its bar line is applied now.
        const pending = pendingPatternRef.current;
        pendingPatternRef.current = null;
        if (pending && pending !== patternRef.current) {
            callbacksRef.current.onPatternChange(pending);
            if (pending.recommendedTempo) callbacksRef.current.onBpmChange(pending.recommendedTempo);
        }
    }, [store, setPlaying]);

    const toggle = useCallback(() => {
        if (isPlayingRef.current) stop();
        else void start();
    }, [start, stop]);

    /** While playing, switches pattern at the next bar line. */
    const queuePattern = useCallback((next: RhythmPattern) => {
        const scheduler = schedulerRef.current;
        if (!scheduler) return;
        pendingPatternRef.current = next === patternRef.current ? null : next;
        scheduler.setPattern(next);
        store.update({ queuedPatternId: scheduler.getQueuedPatternId() });
    }, [store]);

    const previewInstrument = useCallback(async (instrument: string, modifier?: string) => {
        await AudioContextManager.getInstance().resume();
        schedulerRef.current?.playOneShot(instrument, modifier);
    }, []);

    // --- Settings (mirrored + applied) ---
    const updateChannel = useCallback((name: string, patch: ChannelSettings) => {
        const channels = settingsRef.current.channels;
        channels[name] = { ...channels[name], ...patch };
    }, []);

    const setChannelVolume = useCallback((name: string, volume: number) => {
        updateChannel(name, { volume });
        schedulerRef.current?.setChannelVolume(name, volume);
    }, [updateChannel]);

    const setChannelPan = useCallback((name: string, pan: number) => {
        updateChannel(name, { pan });
        schedulerRef.current?.setChannelPan(name, pan);
    }, [updateChannel]);

    const setChannelMute = useCallback((name: string, muted: boolean) => {
        updateChannel(name, { muted });
        schedulerRef.current?.setChannelMute(name, muted);
    }, [updateChannel]);

    const setHarmonyProgression = useCallback((chords: string[][]) => {
        settingsRef.current.harmony = chords;
        schedulerRef.current?.setHarmonyProgression(chords);
    }, []);

    const setHarmonyVolume = useCallback((volume: number) => {
        settingsRef.current.harmonyVolume = volume;
        schedulerRef.current?.setHarmonyVolume(volume);
    }, []);

    const setAccompanimentStyle = useCallback((style: AccompanimentStyle) => {
        settingsRef.current.accompaniment = style;
        schedulerRef.current?.setAccompanimentStyle(style);
    }, []);

    const configureTrainer = useCallback((config: TrainerConfig) => {
        settingsRef.current.trainer = config;
        schedulerRef.current?.configureTrainer(config);
    }, []);

    const setSilenceMode = useCallback((active: boolean, chance: number) => {
        settingsRef.current.silence = { active, chance };
        schedulerRef.current?.setSilenceMode(active, chance);
    }, []);

    const configureFormas = useCallback((enabled: boolean, genre: FormGenre, introBars: number) => {
        settingsRef.current.formas = { enabled, genre, introBars };
        schedulerRef.current?.configureFormas(enabled, genre, introBars);
    }, []);

    return {
        store,
        isPlaying,
        start,
        stop,
        toggle,
        queuePattern,
        previewInstrument,
        setChannelVolume,
        setChannelPan,
        setChannelMute,
        setHarmonyProgression,
        setHarmonyVolume,
        setAccompanimentStyle,
        configureTrainer,
        setSilenceMode,
        configureFormas,
    };
}

export type MetronomeEngine = ReturnType<typeof useMetronomeEngine>;
