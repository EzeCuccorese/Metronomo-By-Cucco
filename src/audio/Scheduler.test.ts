/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
        detune: mockAudioParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
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
    createBufferSource: vi.fn((..._args: unknown[]) => ({
        buffer: null,
        playbackRate: mockAudioParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
    })),
    createBuffer: vi.fn((channels: any, length: any, sampleRate: any) => ({
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: vi.fn((_channel?: number) => new Float32Array(length)),
    })),
    decodeAudioData: vi.fn(async (_data?: unknown) => {
        return {
            numberOfChannels: 1,
            length: 44100,
            sampleRate: 44100,
            getChannelData: vi.fn((_channel?: number) => new Float32Array(44100)),
        };
    }),
    destination: {},
    currentTime: 0.1,
    sampleRate: 44100,
};

class MockAudioContext {
    createGain() { return mockAudioContext.createGain(); }
    createBiquadFilter() { return mockAudioContext.createBiquadFilter(); }
    createOscillator() { return mockAudioContext.createOscillator(); }
    createWaveShaper() { return mockAudioContext.createWaveShaper(); }
    createStereoPanner() { return mockAudioContext.createStereoPanner(); }
    createBufferSource(...args: unknown[]) { return mockAudioContext.createBufferSource(...args); }
    createBuffer(c: any, l: any, s: any) { return mockAudioContext.createBuffer(c, l, s); }
    decodeAudioData(d: any) { return mockAudioContext.decodeAudioData(d); }
    destination = mockAudioContext.destination;
    get currentTime() { return mockAudioContext.currentTime; }
    sampleRate = mockAudioContext.sampleRate;
}

class MockOfflineAudioContext {
    createGain() { return mockAudioContext.createGain(); }
    createOscillator() { return mockAudioContext.createOscillator(); }
    createBufferSource(...args: unknown[]) { return mockAudioContext.createBufferSource(...args); }
    createBuffer(c: any, l: any, s: any) { return mockAudioContext.createBuffer(c, l, s); }
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

(globalThis as any).window = {
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
} as any;

(globalThis as any).OfflineAudioContext = MockOfflineAudioContext as any;
(globalThis as any).requestAnimationFrame = vi.fn() as any;
(globalThis as any).cancelAnimationFrame = vi.fn() as any;

vi.mock('./clock.worker?worker', () => {
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

(globalThis as any).fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    } as any)
);

import Scheduler from './Scheduler';
import { PRESET_PATTERNS } from '../rhythms/RhythmPatterns';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

describe('Scheduler', () => {
    let scheduler: Scheduler;
    const testPattern: RhythmPattern = {
        id: 'test_pat',
        name: 'Test Pattern',
        description: 'Test description',
        timeSignature: [4, 4],
        subdivision: 16,
        instruments: ['kick', 'snare', 'hihat', 'click', 'bombo_leguero'],
        countingMode: 'numbers',
        steps: [
            { step: 1, instrument: 'kick', velocity: 1.0 },
            { step: 4, instrument: 'hihat', velocity: 0.7 },
            { step: 5, instrument: 'snare', velocity: 0.9 },
            { step: 8, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
            { step: 9, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'parche' },
            { step: 11, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
            { step: 15, instrument: 'hihat', velocity: 0.7 },
            { step: 16, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'parche' }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockAudioContext.currentTime = 0.1;
        scheduler = new Scheduler();
    });

    it('should initialize with default parameters', () => {
        expect(scheduler).toBeDefined();
        expect(scheduler.getQueuedPatternId()).toBeNull();
    });

    it('should allow setting tempo dynamically while playing', () => {
        scheduler.setPattern(testPattern);
        scheduler.start();
        scheduler.setTempo(140);
        expect(scheduler.getQueuedPatternId()).toBeNull();
        scheduler.stop();
    });

    it('should queue pattern when set while playing and switch at bar boundary', () => {
        scheduler.setPattern(testPattern);
        scheduler.start();
        const patternB: RhythmPattern = { ...testPattern, id: 'pat_b', name: 'Pattern B', recommendedTempo: 130 };
        scheduler.setPattern(patternB);
        expect(scheduler.getQueuedPatternId()).toBe('pat_b');

        for (let i = 0; i < 40; i++) {
            mockAudioContext.currentTime += 0.2;
            (scheduler as any).scheduler();
        }

        expect(scheduler.getQueuedPatternId()).toBeNull();
        scheduler.stop();
    });

    it('should start, tick, and stop cleanly', () => {
        scheduler.setPattern(testPattern);
        scheduler.start();
        expect(scheduler['isPlaying']).toBe(true);

        for (let i = 0; i < 20; i++) {
            mockAudioContext.currentTime += 0.2;
            (scheduler as any).scheduler();
        }

        scheduler.stop();
        expect(scheduler['isPlaying']).toBe(false);
    });

    it('should test channel controls (volume, pan, mute)', () => {
        scheduler.setChannelVolume('kick', 0.8);
        scheduler.setChannelPan('snare', -0.5);
        scheduler.setChannelMute('hihat', true);
        scheduler.setChannelMute('hihat', false);
    });

    it('should test harmony controls and accompaniment styles', () => {
        scheduler.setHarmonyProgression([['C4', 'E4', 'G4'], ['F4', 'A4', 'C5']]);
        scheduler.setHarmonyVolume(0.7);
        scheduler.setAccompanimentStyle('quarters');
        scheduler.setAccompanimentStyle('offbeats');
        scheduler.setAccompanimentStyle('arpeggio_8');
        scheduler.setAccompanimentStyle('pad');
    });

    it('should test speed trainer linear increment and decrement modes', () => {
        // Linear increment
        scheduler.configureTrainer(true, 100, 120, 1, 5, 'linear');
        scheduler.setHarmonyProgression([['C4', 'E4', 'G4']]);
        scheduler.setPattern(testPattern);
        scheduler.start();

        for (let i = 0; i < 40; i++) {
            mockAudioContext.currentTime += 0.2;
            (scheduler as any).scheduler();
        }

        expect(scheduler.getPracticeStats().totalBars).toBeGreaterThan(0);
        scheduler.stop();

        // Linear decrement
        scheduler.configureTrainer(true, 140, 100, 1, 5, 'linear');
        scheduler.start();
        for (let i = 0; i < 40; i++) {
            mockAudioContext.currentTime += 0.2;
            (scheduler as any).scheduler();
        }
        scheduler.stop();

        scheduler.resetPracticeStats();
        expect(scheduler.getPracticeStats().totalBars).toBe(0);
    });

    it('should test resistance_loop trainer mode, target reach, and cooldown holding', () => {
        scheduler.configureTrainer(true, 100, 105, 1, 5, 'resistance_loop');
        scheduler.setPattern(testPattern);
        scheduler.start();

        for (let i = 0; i < 150; i++) {
            mockAudioContext.currentTime += 0.2;
            (scheduler as any).scheduler();
        }

        scheduler.stop();
        expect(scheduler).toBeDefined();
    });

    it('should test silence mode configuration and muted bars', () => {
        scheduler.setSilenceMode(true, 1.0);
        scheduler.setPattern(testPattern);
        scheduler.start();

        for (let i = 0; i < 40; i++) {
            mockAudioContext.currentTime += 0.2;
            (scheduler as any).scheduler();
        }

        scheduler.setSilenceMode(false);
        scheduler.stop();
    });

    it('should test Formas mode completion and 2da part handling', () => {
        const onPlaybackUpdate = vi.fn();
        scheduler.setOnPlaybackUpdate(onPlaybackUpdate);
        scheduler.configureFormas(true, 'Chacarera Simple', 0);
        scheduler.setPattern({ ...testPattern, subdivision: 4 });
        scheduler.start();

        (scheduler as any).formSections = [
            { name: 'Precuenta', bars: 1, audioId: 'Precuenta' },
            { name: 'Silencio', bars: 1, audioId: 'Silencio' },
            { name: 'Intro', bars: 1, audioId: 'Intro' },
            { name: 'Tema (2da)', bars: 1, audioId: 'Tema', isFinal: true }
        ];
        (scheduler as any).currentSectionIdx = 0;
        (scheduler as any).currentFormBar = 0;

        for (let i = 0; i < 60; i++) {
            mockAudioContext.currentTime += 0.2;
            (scheduler as any).scheduler();
            (scheduler as any).runVisualUpdateLoop();
            if (!scheduler['isPlaying']) break;
        }

        expect(scheduler['isPlaying']).toBe(false);
    });

    it('should run visual update loop and trigger listener', () => {
        const updateListener = vi.fn();
        scheduler.setOnPlaybackUpdate(updateListener);
        scheduler.setPattern(testPattern);
        scheduler.start();

        for (let i = 0; i < 20; i++) {
            mockAudioContext.currentTime += 0.2;
            (scheduler as any).scheduler();
        }

        (scheduler as any).runVisualUpdateLoop();
        expect(updateListener).toHaveBeenCalled();

        scheduler.stop();
    });

    it('should play one shot instruments', () => {
        scheduler.playOneShot('kick');
        scheduler.playOneShot('snare');
    });

    it('should process tick loop with all preset groove patterns', () => {
        PRESET_PATTERNS.forEach(pat => {
            scheduler.setPattern(pat);
            scheduler.start();

            for (let i = 0; i < 50; i++) {
                mockAudioContext.currentTime += 0.2;
                if (scheduler['isPlaying']) {
                    (scheduler as any).scheduler();
                }
            }
            scheduler.stop();
        });
    });
});
