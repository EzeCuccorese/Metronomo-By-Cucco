
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
        notes.forEach(note => this.playVoice(note, { duration, time, type: 'long' }));
    }

    private playRhythmic(notes: string[], totalDuration: number, startTime: number, offsets: number[], noteLen: number) {
        offsets.forEach(offset => {
            if (offset < totalDuration) {
                notes.forEach(note => this.playVoice(note, { duration: noteLen, time: startTime + offset, type: 'short' }));
            }
        });
    }

    private playArpeggio(notes: string[], duration: number, time: number, steps: number) {
        const stepTime = duration / steps;
        for (let i = 0; i < steps; i++) {
            const note = notes[i % notes.length];
            this.playVoice(note, { duration: stepTime, time: time + (i * stepTime), type: 'pluck' });
        }
    }

    /** Bass on the downbeat, chord on every other beat (zamba: bass on 1, chord on 2 and 3). */
    private playZambaBase(notes: string[], time: number, onBeats: number[], beat: number) {
        const [root, ...upper] = notes;
        const bass = root.replace(/(\d)$/, d => String(Math.max(1, Number(d) - 1)));
        this.playVoice(bass, { duration: beat * 0.9, time, type: 'short' });
        const chordTimes = onBeats.length > 1 ? onBeats.slice(1) : [beat / 2];
        chordTimes.forEach(t => upper.forEach(n => this.playVoice(n, { duration: beat * 0.8, time: time + t, type: 'short' })));
    }

    /**
     * One plucked note (used as the piano's fallback voice while its samples are missing).
     * Short notes get the pluck envelope, longer ones the sustained one.
     */
    public playNote(note: string, duration: number, time: number, velocity: number = 1.0) {
        this.playVoice(note, { duration: Math.max(0.25, duration), time, type: duration < 0.35 ? 'pluck' : 'long', velocity });
    }

    private createHarmonicOscillators(freq: number, target: AudioNode): OscillatorNode[] {
        const specs: [number, number][] = [[1.0, 0.65], [2.0, 0.22], [3.0, 0.08]];
        return specs.map(([mult, gainVal]) => {
            const osc = this.context.createOscillator();
            const g = this.context.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq * mult;
            g.gain.value = gainVal;
            osc.connect(g);
            g.connect(target);
            return osc;
        });
    }

    private applyVoiceEnvelope(
        filter: BiquadFilterNode,
        env: GainNode,
        params: { t: number; duration: number; type: 'long' | 'short' | 'pluck'; vel: number }
    ) {
        const { t, duration, type, vel } = params;
        if (type === 'long') {
            const attackEnd = t + Math.min(0.08, duration * 0.3);
            const releaseStart = Math.max(attackEnd, t + duration - 0.2);
            const peak = 0.28 * vel;
            filter.frequency.setValueAtTime(450, t);
            filter.frequency.exponentialRampToValueAtTime(750, t + duration * 0.4);
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(peak, attackEnd);
            env.gain.setValueAtTime(peak, releaseStart);
            env.gain.linearRampToValueAtTime(0, t + duration);
        } else if (type === 'short') {
            filter.frequency.value = 950;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(0.35 * vel, t + 0.01);
            env.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        } else {
            filter.frequency.setValueAtTime(2500, t);
            filter.frequency.exponentialRampToValueAtTime(150, t + 0.18);
            env.gain.setValueAtTime(0.35 * vel, t);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        }
    }

    private playVoice(note: string, opts: { duration: number; time: number; type?: 'long' | 'short' | 'pluck'; velocity?: number }) {
        const t = Math.max(opts.time, this.context.currentTime);
        const safeDuration = Math.max(0.05, opts.duration);
        const type = opts.type ?? 'long';
        const vel = Math.max(0.05, Math.min(1, opts.velocity ?? 1.0));
        const freq = getFrequency(note);

        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        const tremoloGain = this.context.createGain();
        tremoloGain.gain.value = 1.0;
        const env = this.context.createGain();
        filter.connect(tremoloGain);
        tremoloGain.connect(env);
        env.connect(this.output);

        const harmonics = this.createHarmonicOscillators(freq, filter);
        const tine = this.context.createOscillator();
        const tineGain = this.context.createGain();
        tine.type = 'triangle';
        tine.frequency.value = Math.max(3000, freq * 8);
        tineGain.gain.setValueAtTime(0.18 * vel, t);
        tineGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        tine.connect(tineGain);
        tineGain.connect(env);

        const lfo = this.context.createOscillator();
        const lfoGain = this.context.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 5.0;
        lfoGain.gain.value = 0.15;
        lfo.connect(lfoGain);
        lfoGain.connect(tremoloGain.gain);

        this.applyVoiceEnvelope(filter, env, { t, duration: safeDuration, type, vel });

        for (const osc of [...harmonics, lfo]) {
            osc.start(t);
            this.voices.add(osc);
            osc.stop(t + safeDuration + 0.1);
        }
        tine.start(t);
        this.voices.add(tine);
        tine.stop(t + 0.05);
    }

    public setVolume(vol: number) {
        this.output.gain.value = vol;
    }
}
