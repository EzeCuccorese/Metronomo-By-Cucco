
import AudioContextManager from './AudioContextManager';
import { VoiceTracker } from './VoiceTracker';
import { midiToFrequency, noteToMidi } from './piano/notes';
import type { PianoStyle } from './piano/pianoAccompaniment';

// Frequency of a note name with octave (e.g. "C4", "G3"), any Tonal spelling (E#, Cb...).
const getFrequency = (noteStr: string): number => {
    const midi = noteToMidi(noteStr.match(/[A-G](?:##|bb|#|b)?-?[0-8]/)?.[0] ?? '');
    return midi !== null ? midiToFrequency(midi) : 440;
};

/** Synth styles are played here; piano styles are routed by the Scheduler to the PianoSampler. */
export type AccompanimentStyle = 'pad' | 'quarters' | 'offbeats' | 'arpeggio_8' | 'zamba_base' | PianoStyle;

export class PolyphonicSynth {
    private context: AudioContext;
    private output: GainNode;
    // Separate fade stage so silence() never fights with the user's volume setting.
    private fade: GainNode;
    private voices = new VoiceTracker();

    constructor() {
        this.context = AudioContextManager.getInstance().getContext();
        this.output = this.context.createGain();
        this.fade = this.context.createGain();
        this.output.connect(this.fade);
        this.fade.connect(this.context.destination);
        this.output.gain.value = 0.3; // Master volume for harmony
    }

    public connect(node: AudioNode) {
        this.fade.disconnect();
        this.fade.connect(node);
    }

    /** Fades out and stops every sounding or pending chord voice. */
    public silence(fadeSeconds: number = 0.02) {
        const now = this.context.currentTime;
        this.fade.gain.cancelScheduledValues(now);
        this.fade.gain.setValueAtTime(1, now);
        this.fade.gain.linearRampToValueAtTime(0, now + fadeSeconds);
        this.fade.gain.setValueAtTime(1, now + fadeSeconds + 0.005);
        this.voices.stopAll(now + fadeSeconds);
    }

    public dispose() {
        this.voices.stopAll(this.context.currentTime);
        this.output.disconnect();
        this.fade.disconnect();
    }

    /**
     * @param duration length of the harmonic segment (seconds)
     * @param beats counted beats inside the segment, so rhythmic styles land on the pulse in any meter
     */
    public playChord(notes: string[], duration: number, time: number, style: AccompanimentStyle = 'pad', prevNotes: string[] = [], beats: number = 2) {
        // 1. VOICE LEADING: Optimize inversions
        const optimizedNotes = this.applyVoiceLeading(notes, prevNotes);
        const beatCount = Math.max(1, Math.round(beats));
        const beat = duration / beatCount;
        const onBeats = Array.from({ length: beatCount }, (_, i) => i * beat);

        // 2. STYLE SEQUENCER
        switch (style) {
            case 'pad':
                this.playPad(optimizedNotes, duration, time);
                break;
            case 'quarters':
                this.playRhythmic(optimizedNotes, duration, time, onBeats, Math.min(0.2, beat * 0.8));
                break;
            case 'offbeats':
                this.playRhythmic(optimizedNotes, duration, time, onBeats.map(t => t + beat / 2), Math.min(0.2, beat * 0.4));
                break;
            case 'arpeggio_8':
                this.playArpeggio(optimizedNotes, duration, time, beatCount * 2);
                break;
            case 'zamba_base':
                this.playZambaBase(optimizedNotes, time, onBeats, beat);
                break;
            default:
                // Piano styles reach this synth only as a fallback: a plain sustained chord.
                this.playPad(optimizedNotes, duration, time);
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

    /** Bass on the downbeat, chord on every other beat (zamba: bass on 1, chord on 2 and 3). */
    private playZambaBase(notes: string[], time: number, onBeats: number[], beat: number) {
        const [root, ...upper] = notes;
        const bass = root.replace(/(\d)$/, d => String(Math.max(1, Number(d) - 1)));
        this.playVoice(bass, beat * 0.9, time, 'short');
        const chordTimes = onBeats.length > 1 ? onBeats.slice(1) : [beat / 2];
        chordTimes.forEach(t => upper.forEach(n => this.playVoice(n, beat * 0.8, time + t, 'short')));
    }

    /**
     * One plucked note (used as the piano's fallback voice while its samples are missing).
     * Short notes get the pluck envelope, longer ones the sustained one.
     */
    public playNote(note: string, duration: number, time: number) {
        this.playVoice(note, Math.max(0.25, duration), time, duration < 0.35 ? 'pluck' : 'long');
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
        this.voices.add(fundamental);
        secondHarmonic.start(time);
        this.voices.add(secondHarmonic);
        thirdHarmonic.start(time);
        this.voices.add(thirdHarmonic);
        tine.start(time);
        this.voices.add(tine);
        lfo.start(time);
        this.voices.add(lfo);

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
