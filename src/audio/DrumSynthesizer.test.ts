/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define complete AudioContext mocks
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

// Setup globals in Node env
(globalThis as any).window = {
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
} as any;

(globalThis as any).OfflineAudioContext = MockOfflineAudioContext as any;

// Mock AudioContextManager to return the same context instance
vi.mock('./AudioContextManager', () => {
    return {
        default: {
            getInstance: vi.fn(() => ({
                getContext: vi.fn(() => new MockAudioContext() as any),
                resume: vi.fn(async () => {}),
            })),
        },
    };
});

// Mock fetch
(globalThis as any).fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    } as any)
);

// Now import DrumSynthesizer!
import DrumSynthesizer from './DrumSynthesizer';

describe('DrumSynthesizer', () => {
    let synth: DrumSynthesizer;

    beforeEach(() => {
        vi.clearAllMocks();
        synth = new DrumSynthesizer();
    });

    it('should initialize and trigger assets loading', async () => {
        expect(synth).toBeDefined();
        expect(synth.loadPromise).toBeDefined();
        await synth.loadPromise;
        expect((globalThis as any).fetch).toHaveBeenCalled();
    });

    it('should play click instrument via synthesized fallback', () => {
        synth.play('click', 0.5, 1.0);
        expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });
});
