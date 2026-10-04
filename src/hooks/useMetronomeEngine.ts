import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Scheduler from '../audio/Scheduler';
import AudioContextManager from '../audio/AudioContextManager';
import type { FormGenre, PlaybackEvent, TrainerConfig } from '../audio/Scheduler';
import type { AccompanimentStyle } from '../audio/PolyphonicSynth';
import type { PianoStatus } from '../audio/piano/PianoSampler';
import type { Melody } from '../audio/piano/melody';
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

/** Longest wait for the samples before starting anyway with the synthesized fallbacks. */
const SAMPLE_WAIT_MS = 2500;

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
    melody: Melody | null;
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
        channels: {}, harmony: [], harmonyVolume: null, accompaniment: null, trainer: null, silence: null, formas: null, melody: null
    });
    const [harmonyProgression, setHarmonyState] = useState<string[][]>([]);
    const [pianoStatus, setPianoStatus] = useState<PianoStatus>('idle');
    const melodyListenersRef = useRef(new Set<(melody: Melody, isLateUpdate: boolean) => void>());
    const callbacksRef = useRef({ onBpmChange, onPatternChange });
    const patternRef = useRef(pattern);
    const bpmRef = useRef(bpm);
    const lastEngineBpmRef = useRef(bpm);
    const pendingPatternRef = useRef<RhythmPattern | null>(null);
    const stopRequestedRef = useRef(false);
    /** Bumped when the AudioContext is recreated: the scheduler (and its whole graph) is rebuilt. */
    const [contextGeneration, setContextGeneration] = useState(0);
    /** The transport was running (or starting) when the context was replaced: restart on the new one. */
    const restartAfterRebuildRef = useRef(false);

    useEffect(() => {
        callbacksRef.current = { onBpmChange, onPatternChange };
        patternRef.current = pattern;
        bpmRef.current = bpm;
    });

    const setPlaying = useCallback((value: boolean) => {
        isPlayingRef.current = value;
        setIsPlaying(value);
    }, []);

    // --- AudioContext replacement (iOS: stuck resume or muted context) ---
    useEffect(() => AudioContextManager.getInstance().onContextReplaced(() => {
        restartAfterRebuildRef.current = isPlayingRef.current || startingRef.current;
        setContextGeneration(generation => generation + 1);
    }), []);

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
        scheduler.setMelody(s.melody);
        const unsubscribePiano = scheduler.onPianoStatusChange(setPianoStatus);
        scheduler.setOnMelodyRecorded((melody, isLateUpdate) => {
            settingsRef.current.melody = melody;
            melodyListenersRef.current.forEach(l => l(melody, isLateUpdate));
        });
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
                melodyState: event.melodyState,
                recordingBar: event.recordingBar,
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
            store.update({ chordIndex: -1, queuedPatternId: null, melodyState: 'idle' });
        });

        schedulerRef.current = scheduler;

        if (restartAfterRebuildRef.current) {
            // Rebuilt after a context replacement while playing: keep the music going on the new graph.
            restartAfterRebuildRef.current = false;
            if (!stopRequestedRef.current) {
                scheduler.start();
                isPlayingRef.current = true;
                const pending = pendingPatternRef.current;
                if (pending) scheduler.setPattern(pending); // re-queue the switch for the next bar line
                store.update({ step: 0, queuedPatternId: scheduler.getQueuedPatternId(), melodyState: 'idle' });
                setPlaying(true);
            }
        }

        return () => {
            unsubscribePiano();
            setPianoStatus('idle'); // the next scheduler starts with its own sampler
            scheduler.dispose();
            if (schedulerRef.current === scheduler) schedulerRef.current = null;
            isPlayingRef.current = false;
        };
        // contextGeneration: a replaced AudioContext needs a whole new graph.
    }, [store, setPlaying, contextGeneration]);

    // --- Pattern & tempo sync ---
    useEffect(() => {
        schedulerRef.current?.setPattern(pattern);
    }, [pattern]);

    useEffect(() => {
        lastEngineBpmRef.current = bpm;
        schedulerRef.current?.setTempo(bpm);
    }, [bpm]);

    // Resuming after the page is hidden or interrupted is handled by AudioContextManager.

    // --- Transport ---

    const start = useCallback(async () => {
        if (isPlayingRef.current || startingRef.current) return;
        startingRef.current = true;
        stopRequestedRef.current = false;
        try {
            await AudioContextManager.getInstance().resume();
            // Give the samples a moment to arrive so the first bars don't play synthesized fallbacks.
            const scheduler = schedulerRef.current;
            if (scheduler) {
                let timer: ReturnType<typeof setTimeout> | undefined;
                await Promise.race([
                    scheduler.whenReady(),
                    new Promise<void>(resolve => { timer = setTimeout(resolve, SAMPLE_WAIT_MS); }),
                ]);
                clearTimeout(timer);
            }
            // The user may have pressed stop (or the component unmounted) while we were waiting.
            // A context replacement during the wait rebuilds and restarts the scheduler on its own.
            if (stopRequestedRef.current || isPlayingRef.current || restartAfterRebuildRef.current || !schedulerRef.current || schedulerRef.current !== scheduler) return;
            scheduler.resetPracticeStats();
            scheduler.start();
            store.update({ step: 0, totalBars: 0, trainerBar: 0, formState: null });
            setPlaying(true);
        } catch (error) {
            // e.g. iOS refusing to resume an interrupted context: stay stopped, the next tap retries.
            console.error('Could not start audio playback', error);
        } finally {
            startingRef.current = false;
        }
    }, [store, setPlaying]);

    const stop = useCallback(() => {
        if (startingRef.current) stopRequestedRef.current = true;
        const scheduler = schedulerRef.current;
        if (!scheduler || !isPlayingRef.current) return;
        scheduler.stop();
        setPlaying(false);
        store.update({ chordIndex: -1, queuedPatternId: null, melodyState: 'idle' });

        // A switch requested during playback that never reached its bar line is applied now.
        const pending = pendingPatternRef.current;
        pendingPatternRef.current = null;
        if (pending && pending !== patternRef.current) {
            callbacksRef.current.onPatternChange(pending);
            if (pending.recommendedTempo) callbacksRef.current.onBpmChange(pending.recommendedTempo);
        }
    }, [store, setPlaying]);

    const toggle = useCallback(() => {
        if (isPlayingRef.current || startingRef.current) stop();
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

    const getChannelLevel = useCallback((name: string): number =>
        schedulerRef.current?.getChannelLevel(name) ?? 0, []);

    const setHarmonyProgression = useCallback((chords: string[][]) => {
        settingsRef.current.harmony = chords;
        schedulerRef.current?.setHarmonyProgression(chords);
        setHarmonyState(prev => JSON.stringify(prev) === JSON.stringify(chords) ? prev : chords);
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

    // --- Piano ---
    const pianoNoteOn = useCallback((midi: number, velocity: number) => {
        // Not awaited: the note is scheduled now and sounds as soon as the context runs.
        void AudioContextManager.getInstance().resume().catch(() => undefined);
        schedulerRef.current?.pianoNoteOn(midi, velocity);
    }, []);

    const pianoNoteOff = useCallback((midi: number) => {
        schedulerRef.current?.pianoNoteOff(midi);
    }, []);

    const releaseAllPianoKeys = useCallback(() => {
        schedulerRef.current?.releaseAllPianoKeys();
    }, []);

    const preloadPiano = useCallback(() => {
        void schedulerRef.current?.preloadPiano();
    }, []);

    const setMelody = useCallback((melody: Melody | null) => {
        settingsRef.current.melody = melody;
        schedulerRef.current?.setMelody(melody);
    }, []);

    /** Called with every take the recorder finishes. Returns the unsubscribe function. */
    const subscribeMelodyRecorded = useCallback((listener: (melody: Melody, isLateUpdate: boolean) => void) => {
        melodyListenersRef.current.add(listener);
        return () => { melodyListenersRef.current.delete(listener); };
    }, []);

    /**
     * Records a take of `bars` bars. Stopped: starts the transport with one bar of count-in.
     * Playing: recording starts at the next bar line.
     */
    const recordMelody = useCallback(async (bars: number) => {
        if (isPlayingRef.current) {
            schedulerRef.current?.armMelodyRecording(bars, 0);
            store.update({ melodyState: 'armed' });
            return;
        }
        await start();
        if (!isPlayingRef.current) return;
        schedulerRef.current?.armMelodyRecording(bars, 1);
        store.update({ melodyState: 'armed' });
    }, [start, store]);

    const cancelMelodyRecording = useCallback(() => {
        schedulerRef.current?.cancelMelodyRecording();
        store.update({ melodyState: 'idle' });
    }, [store]);

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
        getChannelLevel,
        setHarmonyProgression,
        setHarmonyVolume,
        setAccompanimentStyle,
        configureTrainer,
        setSilenceMode,
        configureFormas,
        harmonyProgression,
        pianoStatus,
        pianoNoteOn,
        pianoNoteOff,
        releaseAllPianoKeys,
        preloadPiano,
        setMelody,
        subscribeMelodyRecorded,
        recordMelody,
        cancelMelodyRecording,
    };
}

export type MetronomeEngine = ReturnType<typeof useMetronomeEngine>;
