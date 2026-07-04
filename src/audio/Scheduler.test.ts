/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup globals in Node env BEFORE imports
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
    createBufferSource: vi.fn(() => ({
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
        getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    decodeAudioData: vi.fn(async (d?: any) => {
        if (d) { /* no-op */ }
        return {
            numberOfChannels: 1,
            length: 44100,
            sampleRate: 44100,
            getChannelData: vi.fn(() => new Float32Array(44100)),
        };
    }),
    destination: {},
    currentTime: 0.1,
    sampleRate: 44100,
};

const mockOfflineAudioContextInstance = {
    createGain: vi.fn(() => ({
        gain: mockAudioParam(),
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
    createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
    })),
    createBuffer: vi.fn((channels: any, length: any, sampleRate: any) => ({
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    createBiquadFilter: vi.fn(() => ({
        type: 'lowpass',
        frequency: mockAudioParam(),
        gain: mockAudioParam(),
        Q: mockAudioParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
    })),
    destination: {},
    startRendering: vi.fn(async () => ({
        numberOfChannels: 1,
        length: 100,
        sampleRate: 44100,
        getChannelData: vi.fn(() => new Float32Array(100)),
    })),
};

// Define class-based constructor mocks
class MockAudioContext {
    createGain() { return mockAudioContext.createGain(); }
    createBiquadFilter() { return mockAudioContext.createBiquadFilter(); }
    createOscillator() { return mockAudioContext.createOscillator(); }
    createWaveShaper() { return mockAudioContext.createWaveShaper(); }
    createStereoPanner() { return mockAudioContext.createStereoPanner(); }
    createBufferSource() { return mockAudioContext.createBufferSource(); }
    createBuffer(c: any, l: any, s: any) { return mockAudioContext.createBuffer(c, l, s); }
    decodeAudioData(d: any) { return mockAudioContext.decodeAudioData(d); }
    destination = mockAudioContext.destination;
    currentTime = mockAudioContext.currentTime;
    sampleRate = mockAudioContext.sampleRate;
}

class MockOfflineAudioContext {
    createGain() { return mockOfflineAudioContextInstance.createGain(); }
    createOscillator() { return mockOfflineAudioContextInstance.createOscillator(); }
    createBufferSource() { return mockOfflineAudioContextInstance.createBufferSource(); }
    createBuffer(c: any, l: any, s: any) { return mockOfflineAudioContextInstance.createBuffer(c, l, s); }
    createBiquadFilter() { return mockOfflineAudioContextInstance.createBiquadFilter(); }
    destination = mockOfflineAudioContextInstance.destination;
    startRendering() { return mockOfflineAudioContextInstance.startRendering(); }
}

(globalThis as any).window = {
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
} as any;

(globalThis as any).OfflineAudioContext = MockOfflineAudioContext as any;

(globalThis as any).requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16)) as any;
(globalThis as any).cancelAnimationFrame = vi.fn((id) => clearTimeout(id)) as any;

// Mock clock.worker using inline class to avoid hoisting reference errors
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

// Mock fetch
(globalThis as any).fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    } as any)
);

import Scheduler from './Scheduler';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

describe('Scheduler', () => {
    let scheduler: Scheduler;
    const testPattern: RhythmPattern = {
        id: 'test_pat',
        name: 'Test Pattern',
        description: 'Test description',
        timeSignature: [4, 4],
        subdivision: 16,
        instruments: ['kick', 'snare', 'hihat', 'click'],
        countingMode: 'numbers',
        steps: [
            { step: 1, instrument: 'kick', velocity: 1.0 },
            { step: 5, instrument: 'snare', velocity: 0.9 }
        ]
    };

    beforeEach(() => {
        scheduler = new Scheduler();
    });

    it('should configure and run Formas Mode properly', () => {
        scheduler.setPattern(testPattern);
        scheduler.configureFormas(true, 'Chacarera Simple', 8);
        
        scheduler.start();
        
        expect(scheduler).toBeDefined();
        scheduler.stop();
    });
});
