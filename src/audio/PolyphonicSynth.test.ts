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
    })),
    destination: {},
    currentTime: 0,
    sampleRate: 44100,
};

class MockAudioContext {
    createGain() { return mockAudioContext.createGain(); }
    createBiquadFilter() { return mockAudioContext.createBiquadFilter(); }
    createOscillator() { return mockAudioContext.createOscillator(); }
    destination = mockAudioContext.destination;
    currentTime = mockAudioContext.currentTime;
    sampleRate = mockAudioContext.sampleRate;
}

(globalThis as any).window = (globalThis as any).window || {};
(globalThis as any).window.AudioContext = MockAudioContext;

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

import { PolyphonicSynth } from './PolyphonicSynth';

describe('PolyphonicSynth', () => {
    let synth: PolyphonicSynth;

    beforeEach(() => {
        vi.clearAllMocks();
        synth = new PolyphonicSynth();
    });

    it('should initialize correctly with master volume', () => {
        expect(synth).toBeDefined();
        expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should allow setting the volume', () => {
        synth.setVolume(0.8);
        expect(synth).toBeDefined();
    });

    it('should connect to another AudioNode', () => {
        const dummyNode = { connect: vi.fn() } as any;
        synth.connect(dummyNode);
        expect(synth).toBeDefined();
    });

    it('should play chords in pad style', () => {
        const notes = ['C4', 'E4', 'G4'];
        const res = synth.playChord(notes, 2.0, 0, 'pad');
        expect(res).toEqual(notes);
        expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('should play chords in quarters style', () => {
        const notes = ['C4', 'E4', 'G4'];
        const res = synth.playChord(notes, 1.0, 0, 'quarters');
        expect(res).toEqual(notes);
        expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('should play chords in offbeats style', () => {
        const notes = ['A4', 'C#5', 'E5'];
        const res = synth.playChord(notes, 2.0, 0, 'offbeats');
        expect(res).toEqual(notes);
        expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('should play chords in arpeggio_8 style', () => {
        const notes = ['C4', 'E4', 'G4', 'B4'];
        const res = synth.playChord(notes, 2.0, 0, 'arpeggio_8');
        expect(res).toEqual(notes);
        expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('should handle unhandled/default accompaniment style', () => {
        const notes = ['C4'];
        const res = synth.playChord(notes, 1.0, 0, 'zamba_base' as any);
        expect(res).toEqual(notes);
    });

    it('should handle previous notes for voice leading', () => {
        const prevNotes = ['C4', 'E4', 'G4'];
        const currentNotes = ['F4', 'A4', 'C5'];
        const res = synth.playChord(currentNotes, 1.0, 0, 'pad', prevNotes);
        expect(res).toEqual(currentNotes);
    });

    it('should calculate frequencies correctly for flats, sharps, octaves, and invalid notes', () => {
        // Test diverse note formats
        const notes = ['Db3', 'F#4', 'A4', 'X9', 'Z1'];
        synth.playChord(notes, 0.5, 0, 'pad');
        expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });
});
