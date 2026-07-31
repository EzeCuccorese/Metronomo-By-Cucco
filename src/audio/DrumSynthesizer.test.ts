/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAudioParam = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
});

let createdBufferSources: any[] = [];
let createdOscillators: any[] = [];

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
    createOscillator: vi.fn(() => {
        const osc = {
            type: 'sine',
            frequency: mockAudioParam(),
            detune: mockAudioParam(),
            connect: vi.fn(),
            disconnect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            onended: null as any,
        };
        createdOscillators.push(osc);
        return osc;
    }),
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
    createBufferSource: vi.fn((..._args: unknown[]) => {
        const src = {
            buffer: null,
            playbackRate: mockAudioParam(),
            connect: vi.fn(),
            disconnect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            onended: null as any,
        };
        createdBufferSources.push(src);
        return src;
    }),
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
    currentTime = mockAudioContext.currentTime;
    sampleRate = mockAudioContext.sampleRate;
}

class MockOfflineAudioContext {
    createGain() { return mockAudioContext.createGain(); }
    createOscillator() { return mockAudioContext.createOscillator(); }
    createBufferSource() { return mockAudioContext.createBufferSource(); }
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

import DrumSynthesizer from './DrumSynthesizer';

describe('DrumSynthesizer', () => {
    let synth: DrumSynthesizer;

    beforeEach(() => {
        vi.clearAllMocks();
        createdBufferSources = [];
        createdOscillators = [];
        synth = new DrumSynthesizer();
    });

    it('should initialize and load buffers', async () => {
        expect(synth).toBeDefined();
        await synth.loadPromise;
    });

    it('should play all registered instruments without cached samples (synthesis fallback)', () => {
        const instruments = [
            'kick', 'snare', 'hihat', 'clave', 'shaker', 'click',
            'bombo_leguero', 'bombo', 'caja', 'cajon', 'candombe_chico',
            'candombe_repique', 'candombe_piano', 'palmas',
            'tom_high', 'tom_low', 'tom_floor', 'surdo', 'rim', 'ride', 'crash', 'hihat_foot'
        ];

        instruments.forEach((inst) => {
            synth.play(inst as any, 0.1, 0.8, 'parche');
            synth.play(inst as any, 0.1, 0.8, 'aro');
            synth.play(inst as any, 0.1, 0.8, 'snares_off');
            synth.play(inst as any, 0.1, 0.8, 'open');
            synth.play(inst as any, 0.1, 0.8, 'closed');
        });

        // Trigger onended callbacks for full coverage of pool release
        createdOscillators.forEach(osc => osc.onended?.());
        createdBufferSources.forEach(src => src.onended?.());

        expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should play specialized drum synthesis methods directly', () => {
        synth.playRockKick(0.1, 1.0);
        synth.playRockSnare(0.1, 0.8, false);
        synth.playRockSnare(0.1, 0.8, true);
        synth.playHiHat(0.1, 0.7, false);
        synth.playHiHat(0.1, 0.7, true);
        synth.playHiHatFoot(0.1, 0.7);
        synth.playClave(0.1, 0.9);
        synth.playShaker(0.1, 0.8);
        synth.playBomboLegueroParche(0.1, 1.0);
        synth.playBomboLegueroAro(0.1, 1.0);
        synth.playCaja(0.1, 0.8, 'parche');
        synth.playCaja(0.1, 0.8, 'aro');
        synth.playCajon(0.1, 0.8, 'parche');
        synth.playCajon(0.1, 0.8, 'aro');
        synth.playCandombeChico(0.1, 0.8);
        synth.playCandombeRepique(0.1, 0.8);
        synth.playCandombePiano(0.1, 0.8);
        synth.playPalmas(0.1, 0.8);
        synth.playTom(0.1, 0.8, 120);
        synth.playSurdo(0.1, 0.8);
        synth.playCrash(0.1, 0.8);
        synth.playRide(0.1, 0.8);
        synth.playClick(0.1, 0.8);
        synth.playClick(0.1, 0.5);

        createdOscillators.forEach(osc => osc.onended?.());
        createdBufferSources.forEach(src => src.onended?.());
    });

    it('should test channel volume, pan, and mute controls', () => {
        synth.setChannelVolume('kick', 0.8);
        synth.setChannelPan('kick', -0.5);
        synth.setChannelMute('kick', true);
        synth.setChannelMute('kick', false);
        expect(synth.getChannelNode('kick')).toBeDefined();
        expect(synth.getChannelNode('invalid')).toBeDefined();
    });

    it('should test audio buffer trimming and sample playback when audioBuffers are present', () => {
        const dummyBuffer = mockAudioContext.createBuffer(1, 44100, 44100);
        const channelData = dummyBuffer.getChannelData(0);
        for (let i = 0; i < 1000; i++) channelData[i] = 0.5;

        (synth as any).audioBuffers.set('bombo_parche_raw', dummyBuffer);
        (synth as any).audioBuffers.set('bombo_aro_raw', dummyBuffer);
        (synth as any).audioBuffers.set('caja_raw', dummyBuffer);
        (synth as any).audioBuffers.set('cajon_raw', dummyBuffer);
        (synth as any).audioBuffers.set('palmas_raw', dummyBuffer);
        (synth as any).audioBuffers.set('shaker_real_raw', dummyBuffer);
        (synth as any).audioBuffers.set('clave_raw', dummyBuffer);
        (synth as any).audioBuffers.set('candombe_chico_raw', dummyBuffer);
        (synth as any).audioBuffers.set('candombe_repique_raw', dummyBuffer);
        (synth as any).audioBuffers.set('candombe_piano_raw', dummyBuffer);

        (synth as any).trimBomboAssets();

        synth.play('bombo_leguero', 0.1, 0.8, 'parche');
        synth.play('bombo_leguero', 0.1, 0.8, 'aro');
        synth.play('caja', 0.1, 0.8, 'open');
        synth.play('cajon', 0.1, 0.8, 'open');
        synth.play('palmas', 0.1, 0.8);
        synth.play('clave', 0.1, 0.8);
        synth.play('candombe_chico', 0.1, 0.8);
        synth.play('candombe_repique', 0.1, 0.8);
        synth.play('candombe_piano', 0.1, 0.8);

        const success = (synth as any).playBuffer('bombo_parche', 'bombo', 0.1, 1.0);
        expect(success).toBe(true);

        const missing = (synth as any).playBuffer('non_existent_buffer', 'kick', 0.1, 1.0);
        expect(missing).toBe(false);
    });

    it('should test pooling gain and filter nodes', () => {
        const g1 = (synth as any).getGain();
        const f1 = (synth as any).getFilter();
        expect(g1).toBeDefined();
        expect(f1).toBeDefined();
        (synth as any).releaseGain(g1);
        (synth as any).releaseFilter(f1);
    });
});
