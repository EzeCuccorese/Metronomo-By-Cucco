
import AudioContextManager from './AudioContextManager';

// Basic frequency map for Octave 4 (Middle C)
const BASE_FREQUENCIES: Record<string, number> = {
    'C': 261.63, 'C#': 277.18, 'Db': 277.18,
    'D': 293.66, 'D#': 311.13, 'Eb': 311.13,
    'E': 329.63,
    'F': 349.23, 'F#': 369.99, 'Gb': 369.99,
    'G': 392.00, 'G#': 415.30, 'Ab': 415.30,
    'A': 440.00, 'A#': 466.16, 'Bb': 466.16,
    'B': 493.88
};

// Helper to get freq for note + octave (e.g. "C4", "G3")
const getFrequency = (noteStr: string): number => {
    const match = noteStr.match(/([A-G][#b]?)([0-8])/);
    if (!match) return 440;
    const note = match[1];
    const octave = parseInt(match[2]);
    const base = BASE_FREQUENCIES[note];
    if (!base) return 440;

    // Calculate offset from Octave 4
    return base * Math.pow(2, octave - 4);
};

export class PolyphonicSynth {
    private context: AudioContext;
    private output: GainNode;

    constructor() {
        this.context = AudioContextManager.getInstance().getContext();
        this.output = this.context.createGain();
        this.output.connect(this.context.destination);
        this.output.gain.value = 0.3; // Master volume for harmony
    }

    public playChord(notes: string[], duration: number, time: number) {
        notes.forEach(note => {
            this.playVoice(note, duration, time);
        });
    }

    private playVoice(note: string, duration: number, time: number) {
        const freq = getFrequency(note);

        // Oscillator 1 (Sawtooth - warm)
        const osc1 = this.context.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.value = freq;

        // Oscillator 2 (Triangle - body, slightly detuned)
        const osc2 = this.context.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.value = freq * 1.001; // Detune

        // Filter (Lowpass for Pad sound)
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, time);
        filter.frequency.linearRampToValueAtTime(800, time + duration * 0.5); // Subtle filter open

        // Envelope
        const env = this.context.createGain();
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(0.3, time + 0.1); // Attack
        env.gain.setValueAtTime(0.3, time + duration - 0.2);
        env.gain.linearRampToValueAtTime(0, time + duration); // Release

        // Connections
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(env);
        env.connect(this.output);

        // Start/Stop
        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + duration + 0.1);
        osc2.stop(time + duration + 0.1);
    }

    public setVolume(vol: number) {
        this.output.gain.value = vol;
    }
}
