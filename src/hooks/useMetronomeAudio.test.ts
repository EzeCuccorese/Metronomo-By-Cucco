/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Setup AudioContext mocks
const mockAudioParam = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
});

const mockAudioContext = {
    createGain: vi.fn(() => ({
        gain: mockAudioParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => ({
        type: 'lowpass',
        frequency: mockAudioParam(),
        gain: mockAudioParam(),
        Q: mockAudioParam(),
        detune: mockAudioParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
    })),
    createOscillator: vi.fn(() => ({
        type: 'sine',
        frequency: mockAudioParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
    })),
    createWaveShaper: vi.fn(() => ({
        curve: null,
        oversample: 'none',
        connect: vi.fn(),
    })),
    createStereoPanner: vi.fn(() => ({
        pan: mockAudioParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
    })),
    createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(100)),
    })),
    destination: {},
    currentTime: 0,
    sampleRate: 44100,
};

class MockAudioContext {
    createGain() { return mockAudioContext.createGain(); }
    createBiquadFilter() { return mockAudioContext.createBiquadFilter(); }
    createOscillator() { return mockAudioContext.createOscillator(); }
    createWaveShaper() { return mockAudioContext.createWaveShaper(); }
    createStereoPanner() { return mockAudioContext.createStereoPanner(); }
    createBufferSource() { return mockAudioContext.createBufferSource(); }
    createBuffer() { return mockAudioContext.createBuffer(); }
    destination = mockAudioContext.destination;
    currentTime = mockAudioContext.currentTime;
    sampleRate = mockAudioContext.sampleRate;
}

class MockOfflineAudioContext {
    createGain() { return mockAudioContext.createGain(); }
    createOscillator() { return mockAudioContext.createOscillator(); }
    createBufferSource() { return mockAudioContext.createBufferSource(); }
    createBuffer() { return mockAudioContext.createBuffer(); }
    createBiquadFilter() { return mockAudioContext.createBiquadFilter(); }
    destination = mockAudioContext.destination;
    startRendering() {
        return Promise.resolve({
            numberOfChannels: 1,
            length: 100,
            sampleRate: 44100,
            getChannelData: vi.fn(() => new Float32Array(100)),
        });
    }
}

(globalThis as any).window = (globalThis as any).window || {};
(globalThis as any).window.AudioContext = MockAudioContext;
(globalThis as any).window.OfflineAudioContext = MockOfflineAudioContext;
(globalThis as any).OfflineAudioContext = MockOfflineAudioContext;

vi.mock('../audio/clock.worker?worker', () => {
    return {
        default: class MockWorker {
            postMessage = vi.fn();
            terminate = vi.fn();
            addEventListener = vi.fn();
            removeEventListener = vi.fn();
            onmessage = null;
        }
    };
});

vi.mock('../audio/AudioContextManager', () => {
    return {
        default: {
            getInstance: vi.fn(() => ({
                getContext: vi.fn(() => new MockAudioContext() as any),
                resume: vi.fn(async () => {}),
            })),
        },
    };
});

import { useMetronomeAudio } from './useMetronomeAudio';
import { PRESET_PATTERNS } from '../rhythms/RhythmPatterns';

describe('useMetronomeAudio', () => {
    const testPattern = PRESET_PATTERNS[0];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize with default state', () => {
        const { result } = renderHook(() => useMetronomeAudio(testPattern));

        expect(result.current.isPlaying).toBe(false);
        expect(result.current.bpm).toBe(120);
        expect(result.current.currentStep).toBe(0);
        expect(result.current.schedulerRef.current).not.toBeNull();
    });

    it('should handle togglePlay state', async () => {
        const { result } = renderHook(() => useMetronomeAudio(testPattern));

        await act(async () => {
            await result.current.togglePlay();
        });

        expect(result.current.isPlaying).toBe(true);

        await act(async () => {
            await result.current.togglePlay();
        });

        expect(result.current.isPlaying).toBe(false);
    });

    it('should handle stop function when playing', async () => {
        const { result } = renderHook(() => useMetronomeAudio(testPattern));

        await act(async () => {
            await result.current.togglePlay();
        });

        expect(result.current.isPlaying).toBe(true);

        act(() => {
            result.current.stop();
        });

        expect(result.current.isPlaying).toBe(false);
    });

    it('should update BPM state', () => {
        const { result } = renderHook(() => useMetronomeAudio(testPattern));

        act(() => {
            result.current.setBpm(140);
        });

        expect(result.current.bpm).toBe(140);
    });

    it('should update pattern when prop changes', () => {
        const { result, rerender } = renderHook(
            ({ pattern }) => useMetronomeAudio(pattern),
            { initialProps: { pattern: testPattern } }
        );

        const newPattern = PRESET_PATTERNS[1];
        rerender({ pattern: newPattern });

        expect(result.current.schedulerRef.current).not.toBeNull();
    });

    it('should handle channel control helper methods', () => {
        const { result } = renderHook(() => useMetronomeAudio(testPattern));

        act(() => {
            result.current.setChannelMute('kick', true);
            result.current.setChannelVolume('kick', 0.5);
            result.current.setChannelPan('kick', -0.5);
            result.current.setChannelSolo('kick', true);
            result.current.setPitchShift(2);
            result.current.setAccompanimentStyle('quarters');
            result.current.setFormStructureActive(true, 'Chacarera Simple', 8);
            result.current.setSpeedTrainerConfig({
                active: true,
                startBpm: 100,
                targetBpm: 140,
                barsPerStep: 4,
                bpmIncrement: 5,
                mode: 'linear'
            });
        });

        expect(result.current.schedulerRef.current).not.toBeNull();
    });

    it('should trigger options callbacks on playback updates', () => {
        const onStepChange = vi.fn();
        const onBpmChangeByTrainer = vi.fn();
        const onFormStateChange = vi.fn();
        const onBarComplete = vi.fn();

        const { result } = renderHook(() =>
            useMetronomeAudio(testPattern, {
                onStepChange,
                onBpmChangeByTrainer,
                onFormStateChange,
                onBarComplete,
            })
        );

        const scheduler = result.current.schedulerRef.current as any;
        expect(scheduler).toBeDefined();

        // Simulate playback update callback from scheduler
        act(() => {
            scheduler.onPlaybackUpdate?.(0, 130, 1, 8, testPattern, { currentSection: 'A' }, 0);
        });

        expect(onStepChange).toHaveBeenCalledWith(0);
        expect(onBpmChangeByTrainer).toHaveBeenCalledWith(130);
        expect(onFormStateChange).toHaveBeenCalledWith({ currentSection: 'A' });
        expect(onBarComplete).toHaveBeenCalled();
    });

    it('should stop scheduler on unmount', () => {
        const { result, unmount } = renderHook(() => useMetronomeAudio(testPattern));
        const scheduler = result.current.schedulerRef.current as any;
        const stopSpy = vi.spyOn(scheduler, 'stop');

        unmount();
        expect(stopSpy).toHaveBeenCalled();
    });
});
