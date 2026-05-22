import AudioContextManager from './AudioContextManager';
import DrumSynthesizer from './DrumSynthesizer';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { PolyphonicSynth } from './PolyphonicSynth';
import ClockWorker from './clock.worker?worker'; // Vite Worker Import

interface VisualQueueEvent {
    step: number;
    time: number;
    bpm: number;
    barCount: number;
    totalBars: number;
    pattern: RhythmPattern;
}

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
    private queuedPattern: RhythmPattern | null = null;
    private currentStepIndex: number = 0;
    private stepCache: Map<number, any[]> = new Map(); // Cache active steps per index

    // Precise Visual Synchronization Queue
    private visualQueue: VisualQueueEvent[] = [];

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

        // Connect Polyphonic Synth to the multi-channel mixer strip
        const synthChannelNode = this.synthesizer.getChannelNode('synth');
        if (synthChannelNode) {
            this.polySynth.connect(synthChannelNode);
        }

        // Initialize Worker
        this.clockWorker = new ClockWorker();
        this.clockWorker.onmessage = (e) => {
            if (e.data === 'tick') {
                this.scheduler();
            }
        };

        // Start the high-precision visual loop on requestAnimationFrame
        requestAnimationFrame(this.runVisualUpdateLoop);
    }

    public setChannelVolume(name: string, volume: number) {
        this.synthesizer.setChannelVolume(name, volume);
    }

    public setChannelPan(name: string, pan: number) {
        this.synthesizer.setChannelPan(name, pan);
    }

    public setChannelMute(name: string, isMuted: boolean) {
        this.synthesizer.setChannelMute(name, isMuted);
    }

    public setAccompanimentStyle(style: any) {
        this.accompanimentStyle = style;
    }

    public setHarmonyProgression(chords: string[][]) {
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
        const ratio = this.tempo / bpm;
        this.tempo = bpm;

        if (this.isPlaying) {
            const now = this.audioContext.currentTime;
            const timeToNext = this.nextNoteTime - now;

            if (timeToNext > 0 && timeToNext < 1.0) {
                this.nextNoteTime = now + (timeToNext * ratio);
            }
        }
    }

    public setPattern(pattern: RhythmPattern) {
        if (this.currentPattern && this.currentPattern.id === pattern.id) {
            return; // Avoid redundant sets and feedback loops!
        }
        if (this.isPlaying && this.currentPattern) {
            // Queue the rhythm switch smoothly for the start of the next bar
            this.queuedPattern = pattern;
        } else {
            // Not playing or first load, apply instantly
            this.currentPattern = pattern;
            this.queuedPattern = null;
            this.currentStepIndex = 0;
            this.trainerCurrentBarCount = 0;
            this.visualQueue = [];

            // Build Cache
            this.stepCache.clear();
            pattern.steps.forEach(step => {
                if (!this.stepCache.has(step.step)) {
                    this.stepCache.set(step.step, []);
                }
                this.stepCache.get(step.step)!.push(step);
            });
        }
    }

    public getQueuedPatternId(): string | null {
        return this.queuedPattern ? this.queuedPattern.id : null;
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

    private onPlaybackUpdate: ((step: number, bpm: number, barCount: number, totalBars: number, pattern: RhythmPattern) => void) | null = null;

    public setOnPlaybackUpdate(callback: (step: number, bpm: number, barCount: number, totalBars: number, pattern: RhythmPattern) => void) {
        this.onPlaybackUpdate = callback;
    }

    public start() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.currentStepIndex = 0;
        this.harmonyBarIndex = 0;
        this.visualQueue = [];
        this.nextNoteTime = this.audioContext.currentTime + 0.05; // Slight buffer

        // Start Worker
        this.clockWorker?.postMessage({ action: 'start', interval: this.lookahead });
    }

    public stop() {
        this.isPlaying = false;
        this.clockWorker?.postMessage({ action: 'stop' });
        this.visualQueue = [];
        this.queuedPattern = null;
    }

    public playOneShot(instrument: string) {
        const time = this.audioContext.currentTime;
        this.synthesizer.play(instrument, time, 1.0); // Full velocity for preview
    }

    private scheduler() {
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            const time = this.nextNoteTime;
            this.scheduleNote(time);
            this.nextStep(time);
        }
    }

    private scheduleNote(time: number) {
        if (!this.currentPattern) return;

        const sub = this.currentPattern.subdivision;
        const ts = this.currentPattern.timeSignature;

        // --- HARMONY TRIGGER (Start of Bar OR Middle of Bar) ---
        const midPoint = Math.floor(sub / 2);
        const isStart = this.currentStepIndex === 0;
        const isMiddle = this.currentStepIndex === midPoint;

        if ((isStart || isMiddle) && this.harmonyProgression.length > 0) {
            const chordIndex = this.harmonyBarIndex % this.harmonyProgression.length;
            const chord = this.harmonyProgression[chordIndex];

            const prevIndex = (this.harmonyBarIndex === 0)
                ? 0
                : (this.harmonyBarIndex - 1) % this.harmonyProgression.length;
            const prevChord = (this.harmonyBarIndex > 0) ? this.harmonyProgression[prevIndex] : [];

            // Correct Duration: contemple compound meters (beats * 60 / tempo) scaled by denominator
            const beats = ts[0];
            const wholeBarSeconds = (60.0 / this.tempo) * (4.0 / ts[1]) * beats;
            const chordDuration = wholeBarSeconds / 2;

            if (chord && chord.length > 0) {
                this.polySynth.playChord(chord, chordDuration, time, this.accompanimentStyle, prevChord);
            }

            this.harmonyBarIndex++;
            this.totalBarsPracticed += 0.5;
        }

        // Use Cached Steps
        const activeSteps = this.stepCache.get(this.currentStepIndex + 1) || [];

        let microTimingOffset = (Math.random() - 0.5) * 0.003; // Slight humanize jitter (3ms)

        // Step Duration (Ideal) - Fixed formula scaling by denominator
        const timePerBar = (60.0 / this.tempo) * (4.0 / ts[1]) * ts[0];
        const stepDuration = timePerBar / sub;

        const groove = this.currentPattern.grooveType || 'straight';
        const idx = this.currentStepIndex;

        if (groove === 'swing_triplet') {
            const isOffBeat = idx % 2 !== 0;
            if (isOffBeat) {
                microTimingOffset = stepDuration * (this.currentPattern.swingBase || 0.15);
            }
        } else if (groove === 'samba_carioca') {
            const positionInBeat = idx % 4;
            if (positionInBeat === 1) {
                microTimingOffset = stepDuration * 0.18;
            } else if (positionInBeat === 3) {
                microTimingOffset = -stepDuration * 0.05;
            }
        } else if (groove === 'chacarera_poliritmica') {
            // Urgency on beat 3 of 3/4 feel (Step 9)
            if (activeSteps.some(s => s.step === 9)) {
                microTimingOffset = -0.003; // Adelantado 3ms
            }
        } else if (groove === 'zamba_tradicional') {
            // Drag on the main "Pám" (Step 9)
            if (activeSteps.some(s => s.step === 9)) {
                microTimingOffset = stepDuration * 0.12; // Drag 12% of step duration
            }
        } else if (groove === 'chamame_saltadito') {
            // Bouncing triplet swing with dynamic anticipation on step 5 (-6ms) and step 11 (-4ms)
            if (idx === 4) {
                microTimingOffset = -0.006;
            } else if (idx === 10) {
                microTimingOffset = -0.004;
            }
        } else if (groove === 'salsa_tumbao') {
            // Syncopated conga/clave groove with anticipation on the "ponche" steps 8 and 16 (-4ms)
            if (idx === 7 || idx === 15) {
                microTimingOffset = -0.004;
            }
        } else if (groove === 'cumbia_colombiana') {
            // Driving shaker galopa swing: dragging the middle-beats slightly, anticipating the drop
            const pos = idx % 4;
            if (pos === 1) {
                microTimingOffset = stepDuration * 0.08;
            } else if (pos === 3) {
                microTimingOffset = -stepDuration * 0.04;
            }
        }

        const playTime = time + microTimingOffset;

        if (this.silenceModeActive && this.isMutedBar) {
            return; // Silent bar
        }

        activeSteps.forEach(step => {
            this.synthesizer.play(step.instrument, playTime, step.velocity, step.modifier);
        });
    }

    private nextStep(time: number) {
        if (!this.currentPattern) return;

        const sub = this.currentPattern.subdivision;
        const ts = this.currentPattern.timeSignature;
        const beatsPerBar = ts[0];

        // Fixed Bar and Step Durations
        const timePerBar = (60.0 / this.tempo) * (4.0 / ts[1]) * beatsPerBar;
        const timePerStep = timePerBar / sub;

        const scheduledStep = this.currentStepIndex;

        this.nextNoteTime += timePerStep;

        // Push scheduled event parameters to visual queue with exact target audio time
        this.visualQueue.push({
            step: scheduledStep,
            time: time,
            bpm: Math.round(this.tempo),
            barCount: this.trainerCurrentBarCount,
            totalBars: this.totalBarsPracticed,
            pattern: this.currentPattern
        });

        // Advance Step Index
        this.currentStepIndex++;
        if (this.currentStepIndex >= sub) {
            this.currentStepIndex = 0; // Bar Wrapped

            // Apply queued pattern switch precisely at the bar boundary!
            if (this.queuedPattern) {
                this.currentPattern = this.queuedPattern;
                this.queuedPattern = null;

                // Rebuild cache for the new pattern
                this.stepCache.clear();
                this.currentPattern.steps.forEach(step => {
                    if (!this.stepCache.has(step.step)) {
                        this.stepCache.set(step.step, []);
                    }
                    this.stepCache.get(step.step)!.push(step);
                });
            }

            // Handle Silence Mode Trigger
            if (this.silenceModeActive) {
                this.isMutedBar = Math.random() < this.silenceChance;
            } else {
                this.isMutedBar = false;
            }

            // Trainer Logic
            if (this.trainerActive) {
                this.trainerCurrentBarCount++;

                if (this.trainerCurrentBarCount >= this.trainerBarsInterval) {
                    this.trainerCurrentBarCount = 0;

                    if (this.trainerMode === 'linear') {
                        if (this.trainerStartBpm < this.trainerEndBpm) {
                            this.tempo = Math.min(this.tempo + this.trainerBpmStep, this.trainerEndBpm);
                        } else if (this.trainerStartBpm > this.trainerEndBpm) {
                            this.tempo = Math.max(this.tempo - this.trainerBpmStep, this.trainerEndBpm);
                        }
                    } else if (this.trainerMode === 'resistance_loop') {
                        const isAtTarget = this.tempo >= this.trainerEndBpm;

                        if (isAtTarget) {
                            this.trainerHoldBars++;
                            if (this.trainerHoldBars > 4) {
                                this.tempo = Math.round(this.tempo * this.trainerCoolDownFactor);
                                this.trainerHoldBars = 0;
                            }
                        } else {
                            this.tempo = Math.min(this.tempo + this.trainerBpmStep, this.trainerEndBpm);
                        }
                    }
                }
            }
        }
    }

    /**
     * Bucle requestAnimationFrame que corre continuamente en el hilo principal.
     * Lee la cola visual y gatilla el callback de React EXACTAMENTE cuando el
     * reloj de audio pasa el tiempo de reproducción programado.
     */
    private runVisualUpdateLoop = () => {
        if (this.isPlaying) {
            const now = this.audioContext.currentTime;
            let latestUpdate: VisualQueueEvent | null = null;

            // Consumir todos los eventos que ya se tendrían que estar reproduciendo
            while (this.visualQueue.length > 0 && this.visualQueue[0].time <= now) {
                latestUpdate = this.visualQueue.shift() || null;
            }

            if (latestUpdate && this.onPlaybackUpdate) {
                this.onPlaybackUpdate(
                    latestUpdate.step,
                    latestUpdate.bpm,
                    latestUpdate.barCount,
                    latestUpdate.totalBars,
                    latestUpdate.pattern
                );
            }
        }
        requestAnimationFrame(this.runVisualUpdateLoop);
    };
}

export default Scheduler;
