import { useState, useRef, useCallback, useEffect } from 'react';
import Scheduler from '../audio/Scheduler';
import AudioContextManager from '../audio/AudioContextManager';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import type { FormState } from '../audio/Scheduler';
import type { AccompanimentStyle } from '../audio/PolyphonicSynth';

export interface UseMetronomeAudioOptions {
  onStepChange?: (step: number) => void;
  onBarComplete?: () => void;
  onFormStateChange?: (state: FormState) => void;
  onBpmChangeByTrainer?: (newBpm: number) => void;
}

export function useMetronomeAudio(pattern: RhythmPattern, options?: UseMetronomeAudioOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [currentStep, setCurrentStep] = useState(0);
  const schedulerRef = useRef<Scheduler | null>(null);

  const optionsRef = useRef(options);
  const patternRef = useRef(pattern);
  const bpmRef = useRef(bpm);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    const scheduler = new Scheduler();
    scheduler.setPattern(patternRef.current);
    scheduler.setTempo(bpmRef.current);
    scheduler.setOnPlaybackUpdate((step, newBpm, _barCount, _totalBars, _activePattern, formUpdate) => {
      setCurrentStep(step);
      optionsRef.current?.onStepChange?.(step);
      setBpm(prevBpm => {
        if (newBpm !== prevBpm) {
          optionsRef.current?.onBpmChangeByTrainer?.(newBpm);
        }
        return newBpm;
      });
      if (formUpdate) {
        optionsRef.current?.onFormStateChange?.(formUpdate);
      }
      if (step === 0) {
        optionsRef.current?.onBarComplete?.();
      }
    });

    schedulerRef.current = scheduler;

    return () => {
      if (schedulerRef.current) {
        schedulerRef.current.stop();
      }
    };
  }, []);

  // Sincronizar patrón
  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.setPattern(pattern);
    }
  }, [pattern]);

  // Sincronizar BPM
  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.setTempo(bpm);
    }
  }, [bpm]);

  const togglePlay = useCallback(async () => {
    await AudioContextManager.getInstance().resume();
    if (!schedulerRef.current) return;

    if (isPlaying) {
      schedulerRef.current.stop();
      setIsPlaying(false);
    } else {
      schedulerRef.current.start();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const stop = useCallback(() => {
    if (schedulerRef.current && isPlaying) {
      schedulerRef.current.stop();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const setChannelMute = useCallback((channel: string, mute: boolean) => {
    schedulerRef.current?.setChannelMute(channel, mute);
  }, []);

  const setChannelVolume = useCallback((channel: string, volume: number) => {
    schedulerRef.current?.setChannelVolume(channel, volume);
  }, []);

  const setChannelPan = useCallback((channel: string, pan: number) => {
    schedulerRef.current?.setChannelPan(channel, pan);
  }, []);

  const setChannelSolo = useCallback((_channel?: string, _solo?: boolean) => {
    void _channel;
    void _solo;
    // Solo is handled via mute on other channels
  }, []);

  const setPitchShift = useCallback((_pitch?: number) => {
    void _pitch;
    // Pitch shift not directly supported in Scheduler
  }, []);

  const setAccompanimentStyle = useCallback((style: AccompanimentStyle) => {
    schedulerRef.current?.setAccompanimentStyle(style);
  }, []);

  const setFormStructureActive = useCallback((active: boolean, genre: string = 'Chacarera Simple', introBars: number = 8) => {
    schedulerRef.current?.configureFormas(active, genre, introBars);
  }, []);

  const setSpeedTrainerConfig = useCallback((config: {
    active: boolean;
    startBpm: number;
    targetBpm: number;
    barsPerStep: number;
    bpmIncrement: number;
    mode?: 'linear' | 'resistance_loop';
  }) => {
    schedulerRef.current?.configureTrainer(
      config.active,
      config.startBpm,
      config.targetBpm,
      config.barsPerStep,
      config.bpmIncrement,
      config.mode
    );
  }, []);

  return {
    isPlaying,
    bpm,
    setBpm,
    currentStep,
    togglePlay,
    stop,
    setChannelMute,
    setChannelVolume,
    setChannelPan,
    setChannelSolo,
    setPitchShift,
    setAccompanimentStyle,
    setFormStructureActive,
    setSpeedTrainerConfig,
    schedulerRef
  };
}
