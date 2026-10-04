/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
            addEventListener: vi.fn(),
            stop: vi.fn(),
            onended: null as any,
        };
        createdOscillators.push(osc);
        return osc;
    }),
    createAnalyser: vi.fn(() => ({
        fftSize: 2048,
        getFloatTimeDomainData: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
    })),
    createWaveShaper: vi.fn(() => ({
        curve: null,
        oversample: 'none',
        connect: vi.fn(),
        disconnect: vi.fn(),
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
            addEventListener: vi.fn(),
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
    createAnalyser() { return mockAudioContext.createAnalyser(); }
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
import { addTrimmedSamples } from './sampleLibrary';
import { PRESET_PATTERNS } from '../rhythms/RhythmPatterns';
import { CHANNEL_IDS, INSTRUMENT_CHANNEL } from './instrumentChannels';

describe('DrumSynthesizer', () => {
    let synth: DrumSynthesizer;

    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        createdBufferSources = [];
        createdOscillators = [];
        // The constructor starts loading samples in the background. Make that deterministic (no real
        // network) and keep the expected "falls back to synthesis" console.error out of the worker's
        // RPC channel, which otherwise races with environment teardown (EnvironmentTeardownError).
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        synth = new DrumSynthesizer();
    });

    afterEach(async () => {
        // Never leave the background sample load pending when the test (and eventually the file) ends.
        await synth?.loadPromise;
        consoleError?.mockRestore();
        vi.unstubAllGlobals();
    });

    it('should initialize and load buffers', async () => {
        expect(synth).toBeDefined();
        await synth.loadPromise;
        expect(consoleError).toHaveBeenCalled();
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

        addTrimmedSamples((synth as any).context, (synth as any).audioBuffers);

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

    const loadAllSamples = () => {
        const dummyBuffer = mockAudioContext.createBuffer(1, 44100, 44100);
        dummyBuffer.getChannelData(0).fill(0.5, 0, 1000);
        ['kick', 'snare', 'hihat', 'hihat-open', 'ride', 'surdo', 'tom_high', 'tom_low', 'tom_floor',
            'bombo_parche_raw', 'bombo_aro_raw', 'caja_raw', 'cajon_raw', 'palmas_raw', 'shaker_real_raw',
            'clave_raw', 'candombe_chico_raw', 'candombe_repique_raw', 'candombe_piano_raw']
            .forEach(name => (synth as any).audioBuffers.set(name, dummyBuffer));
        addTrimmedSamples((synth as any).context, (synth as any).audioBuffers);
    };

    /** Follows connect() calls from a node and reports whether it reaches the given target. */
    const reaches = (node: any, target: any, depth = 0): boolean => {
        if (node === target) return true;
        if (depth > 6 || !node?.connect?.mock) return false;
        return node.connect.mock.calls.some((c: any[]) => reaches(c[0], target, depth + 1));
    };

    it('routes every instrument used by the presets to an existing mixer channel (C4 regression)', () => {
        loadAllSamples();
        const used = new Set(PRESET_PATTERNS.flatMap(p => p.steps.map(s => s.instrument)));
        used.forEach(inst => {
            createdBufferSources = [];
            createdOscillators = [];
            synth.play(inst, 0.1, 0.9);
            const sources = [...createdBufferSources, ...createdOscillators].filter(n => n.start.mock.calls.length > 0);
            expect(sources.length, `${inst} should start at least one voice`).toBeGreaterThan(0);
            const channelGain = (synth as any).channels[INSTRUMENT_CHANNEL[inst]].gain;
            expect(sources.some(src => reaches(src, channelGain)), `${inst} should reach its channel`).toBe(true);
        });
    });

    it('every preset instrument still sounds through synthesis when no sample could be loaded', () => {
        // No loadAllSamples(): simulates failed downloads or decodes (e.g. constrained mobile browsers).
        const used = new Set(PRESET_PATTERNS.flatMap(p => p.steps.map(s => s.instrument)));
        const channelGains = Object.values((synth as any).channels).map((c: any) => c.gain);
        used.forEach(inst => {
            createdBufferSources = [];
            createdOscillators = [];
            synth.play(inst, 0.1, 0.9);
            const voices = [...createdBufferSources, ...createdOscillators].filter(n => n.start.mock.calls.length > 0);
            expect(voices.length, `${inst} should synthesize a fallback voice`).toBeGreaterThan(0);
            expect(voices.some(v => channelGains.some(g => reaches(v, g))), `${inst} fallback should reach the mixer`).toBe(true);
        });
    });

    it('does not start sample voices on a muted channel', () => {
        loadAllSamples();
        synth.setChannelMute('snare', true);
        createdBufferSources = [];
        synth.play('palmas', 0.1, 1);
        expect(createdBufferSources).toHaveLength(0);
    });

    it('sends the guide click through a clean bus that bypasses the saturator', () => {
        const clickPanner = (synth as any).channels.click.panner;
        const saturator = (synth as any).saturator;
        expect(reaches(clickPanner, saturator)).toBe(false);
        expect(clickPanner.connect).toHaveBeenCalledWith((synth as any).clickTransport);
        expect((synth as any).channels.kick.panner.connect).toHaveBeenCalledWith((synth as any).drumTransport);
    });

    it('silence() stops every scheduled voice and fades the transports', () => {
        loadAllSamples();
        synth.play('kick', 0.5, 1);
        synth.play('click', 0.6, 1);
        expect(synth.activeVoiceCount).toBe(2);
        synth.silence();
        const voices = [...createdBufferSources, ...createdOscillators].filter(n => n.start.mock.calls.some((c: number[]) => c[0] >= 0.5));
        expect(voices).toHaveLength(2);
        voices.forEach(n => expect(n.stop).toHaveBeenCalled());
        expect(synth.activeVoiceCount).toBe(0);
        expect((synth as any).drumTransport.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
    });

    it('reads each channel meter from its own analyser (piano and synth are independent)', () => {
        const analysers = mockAudioContext.createAnalyser.mock.results.map(r => r.value as { getFloatTimeDomainData: ReturnType<typeof vi.fn> });
        expect(analysers).toHaveLength(CHANNEL_IDS.length);
        analysers.forEach(a => a.getFloatTimeDomainData.mockImplementation((buf: Float32Array) => buf.fill(0)));
        analysers[CHANNEL_IDS.indexOf('piano')].getFloatTimeDomainData
            .mockImplementation((buf: Float32Array) => buf.fill(0.2));
        expect(synth.getChannelLevel('piano')).toBeCloseTo(0.6);
        expect(synth.getChannelLevel('synth')).toBe(0);
        expect(synth.getChannelLevel('nope')).toBe(0);
    });

    it('dispose() disconnects the mixer graph', () => {
        synth.dispose();
        expect((synth as any).masterGain.disconnect).toHaveBeenCalled();
        expect((synth as any).channels.kick.gain.disconnect).toHaveBeenCalled();
    });
});
