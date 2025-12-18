import AudioContextManager from './AudioContextManager';
import DrumSynthesizer from './DrumSynthesizer';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { PolyphonicSynth } from './PolyphonicSynth';
import ClockWorker from './clock.worker?worker'; // Vite Worker Import

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
    private accompanimentStyle: 'pad' | 'quarters' | 'offbeats' | 'arpeggio_8' | 'zamba_base' = 'pad';

    // Timing variables
    private isPlaying: boolean = false;
    private nextNoteTime: number = 0.0;
    private tempo: number = 120.0;
    private lookahead: number = 25.0; // ms
    private scheduleAheadTime: number = 0.1; // seconds
    private clockWorker: Worker | null = null;

    // Pattern state
    private currentPattern: RhythmPattern | null = null;
    private currentStepIndex: number = 0;
    private stepCache: Map<number, any[]> = new Map(); // Cache active steps per index

    // Speed Trainer State
    private trainerActive: boolean = false;
    private trainerStartBpm: number = 60;
    private trainerEndBpm: number = 120;
    private trainerBarsInterval: number = 1; // How many bars to hold before changing
    private trainerBpmStep: number = 5;      // How much to change BPM
    private trainerCurrentBarCount: number = 0; // Track bars since last change
    private trainerMode: 'linear' | 'resistance_loop' = 'linear';
    private trainerHoldBars: number = 0; // For resistance mode
    private trainerCoolDownFactor: number = 0.95;

    // Study Features
    private silenceModeActive: boolean = false;
    private silenceChance: number = 0.2; // 20% chance to mute a bar
    private isMutedBar: boolean = false;
    private totalBarsPracticed: number = 0;

    constructor() {
        this.audioContext = AudioContextManager.getInstance().getContext();
        this.synthesizer = new DrumSynthesizer();
        this.polySynth = new PolyphonicSynth();

        // Initialize Worker
        this.clockWorker = new ClockWorker();
        this.clockWorker.onmessage = (e) => {
            if (e.data === 'tick') {
                this.scheduler();
            }
        };
    }

    public setAccompanimentStyle(style: any) {
        this.accompanimentStyle = style;
    }

    public setHarmonyProgression(chords: string[][]) {
        // Simple check to avoid resetting if identical (helps with React StrictMode / Re-renders)
        const isDifferent = JSON.stringify(this.harmonyProgression) !== JSON.stringify(chords);
        if (isDifferent) {
            this.harmonyProgression = chords;
            this.harmonyBarIndex = 0;
        }
    }

    public setHarmonyVolume(vol: number) {
        this.polySynth.setVolume(vol);
    }

    public setTempo(bpm: number) {
        if (this.tempo === bpm) return;

        // Instant Tempo Change Logic
        // We adjust nextNoteTime to preserve the phase but at the new rate.

        // Calculate factor
        const ratio = this.tempo / bpm;
        this.tempo = bpm;

        // If playing, we need to scale the time remaining to the next note
        if (this.isPlaying) {
            const now = this.audioContext.currentTime;
            const timeToNext = this.nextNoteTime - now;

            // If timeToNext is reasonable (not negative or huge), scale it
            if (timeToNext > 0 && timeToNext < 1.0) {
                this.nextNoteTime = now + (timeToNext * ratio);
            }
        }
    }

    public setPattern(pattern: RhythmPattern) {
        // Build Cache
        this.stepCache.clear();
        pattern.steps.forEach(step => {
            if (!this.stepCache.has(step.step)) {
                this.stepCache.set(step.step, []);
            }
            this.stepCache.get(step.step)!.push(step);
        });

        // If playing, try to keep relative position
        if (this.isPlaying && this.currentPattern) {
            const oldSub = this.currentPattern.subdivision;
            const newSub = pattern.subdivision;

            // Calculate progress (0 to 1)
            const progress = this.currentStepIndex / oldSub;

            this.currentPattern = pattern;

            // Map to new subdivision
            this.currentStepIndex = Math.floor(progress * newSub);
        } else {
            // Not playing or first set
            this.currentPattern = pattern;
            this.currentStepIndex = 0;
            this.trainerCurrentBarCount = 0;
        }
    }

    public configureTrainer(
        active: boolean,
        start: number,
        end: number,
        barsInterval: number,
        bpmStep: number,
        mode: 'linear' | 'resistance_loop' = 'linear'
    ) {
        this.trainerActive = active;
        this.trainerStartBpm = start;
        this.trainerEndBpm = end;
        this.trainerBarsInterval = barsInterval;
        this.trainerBpmStep = bpmStep;
        this.trainerMode = mode;

        if (active) {
            this.tempo = start;
            this.trainerCurrentBarCount = 0;
            this.trainerHoldBars = 0;
        }
    }

    public setSilenceMode(active: boolean, chance: number = 0.2) {
        this.silenceModeActive = active;
        this.silenceChance = chance;
    }

    public resetPracticeStats() {
        this.totalBarsPracticed = 0;
    }

    public getPracticeStats() {
        return { totalBars: this.totalBarsPracticed };
    }

    private onPlaybackUpdate: ((step: number, bpm: number, barCount: number, totalBars: number) => void) | null = null;

    public setOnPlaybackUpdate(callback: (step: number, bpm: number, barCount: number, totalBars: number) => void) {
        this.onPlaybackUpdate = callback;
    }

    public start() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.currentStepIndex = 0;
        this.harmonyBarIndex = 0; // Reset Harmony
        this.nextNoteTime = this.audioContext.currentTime + 0.05; // Added slight buffer

        // Start Worker
        this.clockWorker?.postMessage({ action: 'start', interval: this.lookahead });
    }

    public stop() {
        this.isPlaying = false;
        this.clockWorker?.postMessage({ action: 'stop' });
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

        // --- HARMONY TRIGGER (Start of Bar OR Middle of Bar) ---
        // Supports Half-Bar resolution (2 chords per bar)
        const sub = this.currentPattern.subdivision;
        const midPoint = Math.floor(sub / 2);

        // Is this a trigger point?
        const isStart = this.currentStepIndex === 0;
        const isMiddle = this.currentStepIndex === midPoint;

        if ((isStart || isMiddle) && this.harmonyProgression.length > 0) {
            const chordIndex = this.harmonyBarIndex % this.harmonyProgression.length;
            const chord = this.harmonyProgression[chordIndex];

            // Previous Chord for Voice Leading
            const prevIndex = (this.harmonyBarIndex === 0)
                ? 0
                : (this.harmonyBarIndex - 1) % this.harmonyProgression.length;
            const prevChord = (this.harmonyBarIndex > 0) ? this.harmonyProgression[prevIndex] : [];

            // Calculate Duration: It's a HALF BAR duration now
            const ts = this.currentPattern.timeSignature;
            const beats = ts[0];
            const wholeBarSeconds = (60.0 / this.tempo) * beats;
            const chordDuration = wholeBarSeconds / 2;

            if (chord && chord.length > 0) {
                this.polySynth.playChord(chord, chordDuration, time, this.accompanimentStyle, prevChord);
            }

            // Advance Harmony Pointer (Consuming 1 slot from the progression array)
            this.harmonyBarIndex++;
            this.totalBarsPracticed += 0.5; // Tracking
        }

        // Use Cached Steps (Optimization)
        const activeSteps = this.stepCache.get(this.currentStepIndex + 1) || [];

        // Create microTimingOffset variable but don't re-declare sub/ts
        let microTimingOffset = (Math.random() - 0.5) * 0.004; // +/- 2ms humanize jitter

        // Reuse variables from above block (sub, ts already declared around line 215)
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
        } else if (groove === 'chacarera_poliritmica') {
            // "Empuje" en el tiempo 3 del 3/4 (Step 9 en 12 subdivisiones)
            if (activeSteps.some(s => s.step === 9)) {
                // Adelantamos 2ms para dar sensación de urgencia
                microTimingOffset = -0.002;
            }
        } else if (groove === 'zamba_tradicional') {
            // El "Pám" del ba-da-Pám (Step 9) va un poco atrás (sentado)
            if (activeSteps.some(s => s.step === 9)) {
                // Drag de 10% de la duración del paso
                microTimingOffset = stepDuration * 0.10;
            }
        }

        const playTime = time + microTimingOffset;

        if (this.silenceModeActive && this.isMutedBar) {
            // Visual feedback only (if we had it), but no audio
            // Optional: Play only visuals? For now, silence audio.
            return;
        }

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

            // Advance Harmony Pointer -> MOVED TO TRIGGER LOGIC

            // Handle Silence Mode Trigger
            if (this.silenceModeActive) {
                this.isMutedBar = Math.random() < this.silenceChance;
            } else {
                this.isMutedBar = false;
            }

            // Trainer Logic: Increment after N bars
            if (this.trainerActive) {
                this.trainerCurrentBarCount++;

                if (this.trainerCurrentBarCount >= this.trainerBarsInterval) {
                    this.trainerCurrentBarCount = 0;

                    if (this.trainerMode === 'linear') {
                        // EXISTING LINEAR LOGIC
                        if (this.trainerStartBpm < this.trainerEndBpm) {
                            this.tempo = Math.min(this.tempo + this.trainerBpmStep, this.trainerEndBpm);
                        } else if (this.trainerStartBpm > this.trainerEndBpm) {
                            this.tempo = Math.max(this.tempo - this.trainerBpmStep, this.trainerEndBpm);
                        }
                    } else if (this.trainerMode === 'resistance_loop') {
                        // RESISTANCE MODE
                        const isAtTarget = this.tempo >= this.trainerEndBpm;

                        if (isAtTarget) {
                            this.trainerHoldBars++;
                            // Hold for 4 intervals (arbitrary "Resistance" phase)
                            if (this.trainerHoldBars > 4) {
                                // Cool down
                                this.tempo = Math.round(this.tempo * this.trainerCoolDownFactor);
                                this.trainerHoldBars = 0;
                            }
                        } else {
                            // Rise up
                            this.tempo = Math.min(this.tempo + this.trainerBpmStep, this.trainerEndBpm);
                        }
                    }
                }
            }
        }

        if (this.onPlaybackUpdate) {
            // Send the step we just scheduled, not the next one
            this.onPlaybackUpdate(scheduledStep, Math.round(this.tempo), this.trainerCurrentBarCount, this.totalBarsPracticed);
        }
    }
}

export default Scheduler;
