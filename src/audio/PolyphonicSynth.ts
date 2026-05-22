
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

// MIDI note helper (Future Use)
// const getMidiNote = (noteStr: string): number => {
//     const freq = getFrequency(noteStr);
//     return Math.round(69 + 12 * Math.log2(freq / 440));
// };

// Convert MIDI back to Note Name (approx)
// const midiToNote = (midi: number): string => {
//     const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
//     const octave = Math.floor(midi / 12) - 1;
//     const noteIndex = midi % 12;
//     return `${notes[noteIndex]}${octave}`;
// };

export type AccompanimentStyle = 'pad' | 'quarters' | 'offbeats' | 'arpeggio_8' | 'zamba_base';

export class PolyphonicSynth {
    private context: AudioContext;
    private output: GainNode;

    constructor() {
        this.context = AudioContextManager.getInstance().getContext();
        this.output = this.context.createGain();
        this.output.connect(this.context.destination);
        this.output.gain.value = 0.3; // Master volume for harmony
    }

    public connect(node: AudioNode) {
        this.output.disconnect();
        this.output.connect(node);
    }

    public playChord(notes: string[], duration: number, time: number, style: AccompanimentStyle = 'pad', prevNotes: string[] = []) {
        // 1. VOICE LEADING: Optimize inversions
        const optimizedNotes = this.applyVoiceLeading(notes, prevNotes);

        // 2. STYLE SEQUENCER
        switch (style) {
            case 'pad':
                this.playPad(optimizedNotes, duration, time);
                break;
            case 'quarters':
                this.playRhythmic(optimizedNotes, duration, time, [0, 0.25, 0.5, 0.75], 0.2);
                break;
            case 'offbeats':
                this.playRhythmic(optimizedNotes, duration, time, [0.5, 1.5, 2.5, 3.5].map(b => b * (duration / 4)), 0.2);
                break;
            case 'arpeggio_8':
                this.playArpeggio(optimizedNotes, duration, time, 8);
                break;
            // Add other styles as needed
        }

        return optimizedNotes; // Return for next cycle state
    }

    private applyVoiceLeading(currentNotes: string[], prevNotes: string[]): string[] {
        if (!prevNotes || prevNotes.length === 0) return currentNotes;

        // Simple algorithm: Minimize total MIDI distance
        // For each note in current chord, find octave that is closest to ANY note in prev chord? 
        // Better: Find closest voicing for the whole chord.

        // This is a complex topic. Basic heuristic:
        // Keep the bass note (root) fixed or logical.
        // Move upper voices to nearest neighbor.

        // Simplified implementation: Center voicings around C4-C5 range
        return currentNotes; // Placeholder for robust logic later if requested
    }

    private playPad(notes: string[], duration: number, time: number) {
        notes.forEach(note => this.playVoice(note, duration, time, 'long'));
    }

    private playRhythmic(notes: string[], totalDuration: number, startTime: number, offsets: number[], noteLen: number) {
        offsets.forEach(offset => {
            if (offset < totalDuration) {
                notes.forEach(note => this.playVoice(note, noteLen, startTime + offset, 'short'));
            }
        });
    }

    private playArpeggio(notes: string[], duration: number, time: number, steps: number) {
        const stepTime = duration / steps;
        for (let i = 0; i < steps; i++) {
            const note = notes[i % notes.length];
            this.playVoice(note, stepTime, time + (i * stepTime), 'pluck');
        }
    }

    private playVoice(note: string, duration: number, time: number, type: 'long' | 'short' | 'pluck' = 'long') {
        const freq = getFrequency(note);

        const osc1 = this.context.createOscillator();
        const osc2 = this.context.createOscillator();
        const filter = this.context.createBiquadFilter();
        const env = this.context.createGain();

        // Sound Design Setup
        osc1.type = type === 'pluck' ? 'square' : 'sawtooth';
        osc1.frequency.value = freq;

        osc2.type = 'triangle';
        osc2.frequency.value = freq * 1.001;

        filter.type = 'lowpass';

        if (type === 'long') {
            filter.frequency.setValueAtTime(400, time);
            filter.frequency.linearRampToValueAtTime(800, time + duration * 0.5);

            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.3, time + 0.1);
            env.gain.setValueAtTime(0.3, time + duration - 0.2);
            env.gain.linearRampToValueAtTime(0, time + duration);
        } else if (type === 'short') {
            filter.frequency.value = 1200;
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.4, time + 0.01);
            env.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        } else {
            // Pluck
            filter.frequency.setValueAtTime(3000, time);
            filter.frequency.exponentialRampToValueAtTime(200, time + 0.2);
            env.gain.setValueAtTime(0.4, time);
            env.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        }



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
