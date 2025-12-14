import AudioContextManager from './AudioContextManager';
import DrumSynthesizer from './DrumSynthesizer';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { PolyphonicSynth } from './PolyphonicSynth';

/**
 * Handles the precise scheduling of audio events.
 * Uses the "Lookahead" technique: A `setInterval` (on the main thread)
 * pushes events into the Web Audio API scheduler queue.
 */
class Scheduler {
    private audioContext: AudioContext;
    private synthesizer: DrumSynthesizer;

    // Harmony State
    private polySynth: PolyphonicSynth;
    private harmonyProgression: string[][] = [];
    private harmonyBarIndex: number = 0;

    // Timing variables
    private isPlaying: boolean = false;
    private nextNoteTime: number = 0.0;
    private tempo: number = 120.0;
    private lookahead: number = 25.0; // ms
    private scheduleAheadTime: number = 0.1; // seconds
    private timerID: number | null = null;

    // Pattern state
    private currentPattern: RhythmPattern | null = null;
    private currentStepIndex: number = 0;

    // Speed Trainer State
    private trainerActive: boolean = false;
    private trainerStartBpm: number = 60;
    private trainerEndBpm: number = 120;
    private trainerBarsInterval: number = 1; // How many bars to hold before changing
    private trainerBpmStep: number = 5;      // How much to change BPM
    private trainerCurrentBarCount: number = 0; // Track bars since last change

    constructor() {
        this.audioContext = AudioContextManager.getInstance().getContext();
        this.synthesizer = new DrumSynthesizer();
        this.polySynth = new PolyphonicSynth();
    }

    public setHarmonyProgression(chords: string[][]) {
        this.harmonyProgression = chords;
        this.harmonyBarIndex = 0;
    }

    public setHarmonyVolume(vol: number) {
        this.polySynth.setVolume(vol);
    }

    public setTempo(bpm: number) {
        this.tempo = bpm;
    }

    public setPattern(pattern: RhythmPattern) {
        // If playing, try to keep relative position
        if (this.isPlaying && this.currentPattern) {
            const oldSub = this.currentPattern.subdivision;
            const newSub = pattern.subdivision;

            // Calculate progress (0 to 1)
            const progress = this.currentStepIndex / oldSub;

            this.currentPattern = pattern;

            // Map to new subdivision
            this.currentStepIndex = Math.floor(progress * newSub);

            // Do NOT reset trainerBarCount to keep flow
        } else {
            // Not playing or first set
            this.currentPattern = pattern;
            this.currentStepIndex = 0;
            this.trainerCurrentBarCount = 0;
        }
    }

    public configureTrainer(active: boolean, start: number, end: number, barsInterval: number, bpmStep: number) {
        this.trainerActive = active;
        this.trainerStartBpm = start;
        this.trainerEndBpm = end;
        this.trainerBarsInterval = barsInterval;
        this.trainerBpmStep = bpmStep;

        if (active) {
            this.tempo = start;
            this.trainerCurrentBarCount = 0;
        }
    }

    private onPlaybackUpdate: ((step: number, bpm: number, barCount: number) => void) | null = null;

    public setOnPlaybackUpdate(callback: (step: number, bpm: number, barCount: number) => void) {
        this.onPlaybackUpdate = callback;
    }

    public start() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.currentStepIndex = 0;
        this.harmonyBarIndex = 0; // Reset Harmony
        this.nextNoteTime = this.audioContext.currentTime;

        // Start Scheduler Loop
        this.timerID = window.setInterval(() => this.scheduler(), this.lookahead);
    }

    public stop() {
        this.isPlaying = false;
        if (this.timerID !== null) {
            window.clearInterval(this.timerID);
            this.timerID = null;
        }
    }

    public playOneShot(instrument: string) {
        // Play immediately
        const time = this.audioContext.currentTime;
        this.synthesizer.play(instrument, time, 1.0); // Full velocity for preview
    }

    private scheduler() {
        // While there are notes that will need to play before the next interval,
        // schedule them and advance the pointer.
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote();
            this.nextStep();
        }
    }

    private scheduleNote() {
        if (!this.currentPattern) return;

        const time = this.nextNoteTime;

        // --- HARMONY TRIGGER (Start of Bar) ---
        if (this.currentStepIndex === 0 && this.harmonyProgression.length > 0) {
            const chordIndex = this.harmonyBarIndex % this.harmonyProgression.length;
            const chord = this.harmonyProgression[chordIndex];

            // Calculate Bar Duration for the Pad
            const ts = this.currentPattern.timeSignature;
            const beats = ts[0];
            const barDuration = (60.0 / this.tempo) * beats;

            if (chord && chord.length > 0) {
                this.polySynth.playChord(chord, barDuration, time);
            }
        }

        // --- MICRO-TIMING / GROOVE LOGIC ---
        let microTimingOffset = 0;

        const sub = this.currentPattern.subdivision;
        const ts = this.currentPattern.timeSignature; // e.g. [4,4]
        // Step Duration (Ideal) = (60 / BPM * Beats) / Subdivision
        const timePerBar = (60.0 / this.tempo) * ts[0];
        const stepDuration = timePerBar / sub;

        const groove = this.currentPattern.grooveType || 'straight';
        const idx = this.currentStepIndex;

        if (groove === 'swing_triplet') {
            const isOffBeat = idx % 2 !== 0;
            if (isOffBeat) {
                microTimingOffset = stepDuration * (this.currentPattern.swingBase || 0.15); // Default slight swing
            }
        } else if (groove === 'samba_carioca') {
            const positionInBeat = idx % 4; // 0, 1, 2, 3
            if (positionInBeat === 1) { // The 'e' (2nd semi)
                microTimingOffset = stepDuration * 0.18;
            } else if (positionInBeat === 3) { // The 'a' (4th semi)
                microTimingOffset = -stepDuration * 0.05;
            }
        }

        const playTime = time + microTimingOffset;

        // Find steps that match current step index (1-based in pattern data)
        const activeSteps = this.currentPattern.steps.filter(s => s.step === (this.currentStepIndex + 1));

        activeSteps.forEach(step => {
            this.synthesizer.play(step.instrument, playTime, step.velocity, step.modifier);
        });
    }

    private nextStep() {
        if (!this.currentPattern) return;

        // Time per Bar = (60 / BPM) * BeatsPerBar
        // Time per Step = Time per Bar / Subdivision
        const sub = this.currentPattern.subdivision;
        const ts = this.currentPattern.timeSignature;
        const beatsPerBar = ts[0]; // e.g. 4

        const timePerBar = (60.0 / this.tempo) * beatsPerBar;
        const timePerStep = timePerBar / sub;

        // Save CURRENT step for UI update
        const scheduledStep = this.currentStepIndex;

        this.nextNoteTime += timePerStep;

        // Advance Step Index
        this.currentStepIndex++;
        if (this.currentStepIndex >= sub) {
            this.currentStepIndex = 0; // Bar Wrapped

            // Advance Harmony Pointer
            this.harmonyBarIndex++;

            // Trainer Logic: Increment after N bars
            if (this.trainerActive) {
                this.trainerCurrentBarCount++;

                if (this.trainerCurrentBarCount >= this.trainerBarsInterval) {
                    this.trainerCurrentBarCount = 0;

                    // Change Tempo
                    if (this.trainerStartBpm < this.trainerEndBpm) {
                        this.tempo = Math.min(this.tempo + this.trainerBpmStep, this.trainerEndBpm);
                    } else if (this.trainerStartBpm > this.trainerEndBpm) {
                        this.tempo = Math.max(this.tempo - this.trainerBpmStep, this.trainerEndBpm);
                    }
                }
            }
        }

        if (this.onPlaybackUpdate) {
            // Send the step we just scheduled, not the next one
            this.onPlaybackUpdate(scheduledStep, Math.round(this.tempo), this.trainerCurrentBarCount);
        }
    }
}

export default Scheduler;
