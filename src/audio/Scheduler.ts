import AudioContextManager from './AudioContextManager';
import DrumSynthesizer from './DrumSynthesizer';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

/**
 * Handles the precise scheduling of audio events.
 * Uses the "Lookahead" technique: A `setInterval` (on the main thread)
 * pushes events into the Web Audio API scheduler queue.
 */
class Scheduler {
    private audioContext: AudioContext;
    private synthesizer: DrumSynthesizer;

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
        // const step = this.currentStepIndex + 1; // 1-based logic for steps array if needed. But array is just list.

        // Find steps that match current step index (1-based in pattern data)
        const activeSteps = this.currentPattern.steps.filter(s => s.step === (this.currentStepIndex + 1));

        activeSteps.forEach(step => {
            this.synthesizer.play(step.instrument, time, step.velocity);
        });
    }

    private nextStep() {
        if (!this.currentPattern) return;


        // Wait. Tempo is Beats Per Minute (Quarter Notes usually). 
        // We need to calculate how much time per STEP.

        const sub = this.currentPattern.subdivision;
        const ts = this.currentPattern.timeSignature;
        const beatsPerBar = ts[0]; // e.g. 4
        // const beatUnit = ts[1]; // e.g. 4

        // Time per Bar = (60 / BPM) * BeatsPerBar
        // Time per Step = Time per Bar / Subdivision
        const timePerBar = (60.0 / this.tempo) * beatsPerBar;
        const timePerStep = timePerBar / sub;

        // Save CURRENT step for UI update
        const scheduledStep = this.currentStepIndex;

        this.nextNoteTime += timePerStep;

        // Advance Step Index
        this.currentStepIndex++;
        if (this.currentStepIndex >= sub) {
            this.currentStepIndex = 0; // Bar Wrapped

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
