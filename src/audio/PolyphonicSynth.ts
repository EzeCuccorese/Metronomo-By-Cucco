
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

        const fundamental = this.context.createOscillator();
        const secondHarmonic = this.context.createOscillator();
        const thirdHarmonic = this.context.createOscillator();
        const tine = this.context.createOscillator();
        
        const harmonicGain1 = this.context.createGain();
        const harmonicGain2 = this.context.createGain();
        const harmonicGain3 = this.context.createGain();
        const tineGain = this.context.createGain();
        const tremoloGain = this.context.createGain();
        const filter = this.context.createBiquadFilter();
        const env = this.context.createGain();

        // 1. Fundamental tone (Sine)
        fundamental.type = 'sine';
        fundamental.frequency.value = freq;
        harmonicGain1.gain.value = 0.65;

        // 2. Second Harmonic (Sine at double freq)
        secondHarmonic.type = 'sine';
        secondHarmonic.frequency.value = freq * 2.0;
        harmonicGain2.gain.value = 0.22;

        // 3. Third Harmonic (Sine at triple freq)
        thirdHarmonic.type = 'sine';
        thirdHarmonic.frequency.value = freq * 3.0;
        harmonicGain3.gain.value = 0.08;

        // 4. Metallic Tine (High pitch triangle transient)
        tine.type = 'triangle';
        tine.frequency.value = Math.max(3000, freq * 8);
        tineGain.gain.setValueAtTime(0.18, time);
        tineGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

        // Connections
        fundamental.connect(harmonicGain1);
        secondHarmonic.connect(harmonicGain2);
        thirdHarmonic.connect(harmonicGain3);

        harmonicGain1.connect(filter);
        harmonicGain2.connect(filter);
        harmonicGain3.connect(filter);

        tine.connect(tineGain);
        tineGain.connect(env); // bypass filter to preserve sharp click transience

        filter.type = 'lowpass';
        filter.connect(tremoloGain);
        tremoloGain.connect(env);
        env.connect(this.output);

        // 5. LFO Tremolo Modulation (modulates tremoloGain)
        const lfo = this.context.createOscillator();
        const lfoGain = this.context.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 5.0; // 5Hz sweep
        lfoGain.gain.value = 0.15; // 15% depth

        tremoloGain.gain.value = 1.0;
        lfo.connect(lfoGain);
        lfoGain.connect(tremoloGain.gain);

        if (type === 'long') {
            filter.frequency.setValueAtTime(450, time);
            filter.frequency.exponentialRampToValueAtTime(750, time + duration * 0.4);

            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.28, time + 0.08); // smooth attack
            env.gain.setValueAtTime(0.28, time + duration - 0.2);
            env.gain.linearRampToValueAtTime(0, time + duration);
        } else if (type === 'short') {
            filter.frequency.value = 950;
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.35, time + 0.01);
            env.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        } else {
            // Pluck
            filter.frequency.setValueAtTime(2500, time);
            filter.frequency.exponentialRampToValueAtTime(150, time + 0.18);
            env.gain.setValueAtTime(0.35, time);
            env.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
        }

        // Start/Stop oscillators
        fundamental.start(time);
        secondHarmonic.start(time);
        thirdHarmonic.start(time);
        tine.start(time);
        lfo.start(time);

        fundamental.stop(time + duration + 0.1);
        secondHarmonic.stop(time + duration + 0.1);
        thirdHarmonic.stop(time + duration + 0.1);
        tine.stop(time + 0.05);
        lfo.stop(time + duration + 0.1);
    }

    public setVolume(vol: number) {
        this.output.gain.value = vol;
    }
}
