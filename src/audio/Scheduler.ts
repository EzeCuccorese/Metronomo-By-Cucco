import AudioContextManager from './AudioContextManager';
import DrumSynthesizer from './DrumSynthesizer';
import type { RhythmPattern, RhythmStep } from '../rhythms/RhythmPatterns';
import { PolyphonicSynth } from './PolyphonicSynth';
import type { AccompanimentStyle } from './PolyphonicSynth';
import ClockWorker from './clock.worker?worker&inline'; // Vite Worker Import

export interface FormSection {
    name: string;
    audioId: 'Intro' | 'Estrofa' | 'Interludio' | 'Estribillo' | 'Zapateo' | 'Precuenta' | 'Silencio';
    bars: number;
    isFinal?: boolean;
}

export interface FormState {
    sectionName: string;
    sectionBar: number;
    sectionTotalBars: number;
    totalFormBars: number;
    part: number;
    isFinal: boolean;
}

interface VisualQueueEvent {
    step: number;
    time: number;
    bpm: number;
    barCount: number;
    totalBars: number;
    pattern: RhythmPattern;
    formState?: FormState;
    chordIndex: number;
}

function buildFormSections(genre: string, introBars: number): FormSection[] {
    const list: FormSection[] = [];
    
    const addPart = (partNum: number) => {
        const suffix = partNum === 1 ? '1ra' : '2da';
        list.push({ name: `PRECUENTA (${suffix})`, audioId: 'Precuenta', bars: 2 });
        list.push({ name: `INTRODUCCIÓN (${suffix})`, audioId: 'Intro', bars: introBars });
        
        if (genre === 'Chacarera Simple') {
            list.push({ name: 'ESTROFA 1', audioId: 'Estrofa', bars: 8 });
            list.push({ name: 'INTERLUDIO 1', audioId: 'Interludio', bars: introBars });
            list.push({ name: 'ESTROFA 2', audioId: 'Estrofa', bars: 8 });
            list.push({ name: 'INTERLUDIO 2', audioId: 'Interludio', bars: introBars });
            list.push({ name: 'ESTROFA 3', audioId: 'Estrofa', bars: 8 });
            list.push({ name: 'ESTRIBILLO (¡Se acaba!)', audioId: 'Estribillo', bars: 8, isFinal: true });
        } else if (genre === 'Chacarera Doble') {
            list.push({ name: 'ESTROFA 1', audioId: 'Estrofa', bars: 12 });
            list.push({ name: 'INTERLUDIO 1', audioId: 'Interludio', bars: introBars });
            list.push({ name: 'ESTROFA 2', audioId: 'Estrofa', bars: 12 });
            list.push({ name: 'INTERLUDIO 2', audioId: 'Interludio', bars: introBars });
            list.push({ name: 'ESTROFA 3', audioId: 'Estrofa', bars: 12 });
            list.push({ name: 'ESTRIBILLO (¡Se acaba!)', audioId: 'Estribillo', bars: 12, isFinal: true });
        } else if (genre === 'Zamba' || genre === 'Cueca Norteña') {
            list.push({ name: 'ESTROFA 1', audioId: 'Estrofa', bars: 12 });
            list.push({ name: 'ESTROFA 2', audioId: 'Estrofa', bars: 12 });
            list.push({ name: 'ESTRIBILLO (¡Se acaba!)', audioId: 'Estribillo', bars: 12, isFinal: true });
        } else if (genre === 'Gato Norteño') {
            list.push({ name: 'ESTROFA 1 (A-A-B)', audioId: 'Estrofa', bars: 12 });
            list.push({ name: 'ZAPATEO 1', audioId: 'Zapateo', bars: 8 });
            list.push({ name: 'ZARANDEO / GIRO (A)', audioId: 'Estrofa', bars: 4 });
            list.push({ name: 'ZAPATEO 2', audioId: 'Zapateo', bars: 8 });
            list.push({ name: '¡AHURA! (B Final)', audioId: 'Estribillo', bars: 4, isFinal: true });
        }
    };

    addPart(1);
    list.push({ name: 'ENTRE TIEMPO (Silencio)', audioId: 'Silencio', bars: 1 });
    addPart(2);

    return list;
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
    private currentChordIndex: number = -1;
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
    private stepCache: Map<number, RhythmStep[]> = new Map(); // Cache active steps per index

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
    private silenceChance: number = 0.5;
    private isMutedBar: boolean = false;

    // Formas (Folk Structures) State
    private formasMode: boolean = false;
    private formasGenre: string = 'Chacarera Simple';
    private formasIntroBars: number = 8;
    private formSections: FormSection[] = [];
    private currentSectionIdx: number = 0;
    private currentFormBar: number = 0;
    private currentFormTotalBars: number = 0;
    private currentFormPart: number = 1;
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
        if (typeof Worker !== 'undefined') {
            this.clockWorker = new ClockWorker();
            this.clockWorker.onmessage = (e) => {
                if (e.data === 'tick') {
                    this.scheduler();
                }
            };
        }

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

    public setAccompanimentStyle(style: AccompanimentStyle) {
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

        // Sync all queued visual events to the new tempo to prevent race conditions in React state
        this.visualQueue.forEach(event => {
            event.bpm = bpm;
        });

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
            this.visualQueue.forEach(event => {
                event.bpm = start;
            });
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

    private onPlaybackUpdate: ((
        step: number,
        bpm: number,
        barCount: number,
        totalBars: number,
        pattern: RhythmPattern,
        formState: FormState | null,
        chordIndex: number
    ) => void) | null = null;

    public setOnPlaybackUpdate(callback: (
        step: number,
        bpm: number,
        barCount: number,
        totalBars: number,
        pattern: RhythmPattern,
        formState: FormState | null,
        chordIndex: number
    ) => void) {
        this.onPlaybackUpdate = callback;
    }

    public configureFormas(enabled: boolean, genre: string, introBars: number) {
        this.formasMode = enabled;
        this.formasGenre = genre;
        this.formasIntroBars = introBars;
    }

    public start() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.currentStepIndex = 0;
        this.harmonyBarIndex = 0;
        this.currentChordIndex = -1;
        this.visualQueue = [];
        this.nextNoteTime = this.audioContext.currentTime + 0.05; // Slight buffer

        if (this.formasMode) {
            this.formSections = buildFormSections(this.formasGenre, this.formasIntroBars);
            this.currentSectionIdx = 0;
            this.currentFormBar = 0;
            this.currentFormTotalBars = 0;
            this.currentFormPart = 1;
        }

        // Start Worker
        this.clockWorker?.postMessage({ action: 'start', interval: this.lookahead });
    }

    public stop() {
        this.isPlaying = false;
        this.clockWorker?.postMessage({ action: 'stop' });
        this.visualQueue = [];
        this.queuedPattern = null;
        this.harmonyBarIndex = 0;
        this.currentChordIndex = -1;
    }

    public playOneShot(instrument: string) {
        const time = this.audioContext.currentTime;
        this.synthesizer.play(instrument, time, 1.0); // Full velocity for preview
    }

    private scheduler() {
        // Prevent falling behind and scheduling past notes (which Web Audio plays simultaneously on start/resume)
        if (this.nextNoteTime < this.audioContext.currentTime) {
            this.nextNoteTime = this.audioContext.currentTime;
        }

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

        const currentSec = this.formasMode && this.formSections[this.currentSectionIdx] ? this.formSections[this.currentSectionIdx] : null;
        let shouldPlayHarmony = true;
        if (this.formasMode && currentSec) {
            if (currentSec.audioId === 'Precuenta' || currentSec.audioId === 'Silencio') {
                shouldPlayHarmony = false;
            }
        }

        if (isStart || isMiddle) {
            if (this.harmonyProgression.length > 0 && shouldPlayHarmony) {
                this.currentChordIndex = this.harmonyBarIndex % this.harmonyProgression.length;
            } else {
                this.currentChordIndex = -1;
            }
        }

        if ((isStart || isMiddle) && this.harmonyProgression.length > 0 && shouldPlayHarmony) {
            const chordIndex = this.currentChordIndex;
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
            if (currentSec) {
                if (currentSec.audioId === 'Precuenta' && step.instrument !== 'click') {
                    return; // Count-in: only play metronome tick
                }
                if (currentSec.audioId === 'Silencio') {
                    return; // Mute everything
                }
                if ((currentSec.audioId === 'Intro' || currentSec.audioId === 'Interludio') && step.instrument === 'bombo_leguero' && step.modifier !== 'aro') {
                    return; // Mute bombo skin parche hits in intro/interludio
                }
            }
            this.synthesizer.play(step.instrument, playTime, step.velocity, step.modifier);
        });

        // Auto-schedule metronome guide click on beat boundaries
        const stepsPerBeat = sub / ts[0];
        const isBeatStart = (this.currentStepIndex % stepsPerBeat) === 0;

        if (isBeatStart) {
            const hasExplicitClick = activeSteps.some(s => s.instrument === 'click');
            if (!hasExplicitClick) {
                const clickVelocity = (this.currentStepIndex === 0) ? 1.0 : 0.6;
                let shouldPlayClick = true;
                if (currentSec && currentSec.audioId === 'Silencio') {
                    shouldPlayClick = false;
                }
                if (shouldPlayClick) {
                    this.synthesizer.play('click', playTime, clickVelocity);
                }
            }
        }
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
        const currentFormState = this.formasMode && this.formSections[this.currentSectionIdx] ? {
            sectionName: this.formSections[this.currentSectionIdx].name,
            sectionBar: this.currentFormBar,
            sectionTotalBars: this.formSections[this.currentSectionIdx].bars,
            totalFormBars: this.currentFormTotalBars,
            part: this.currentFormPart,
            isFinal: !!this.formSections[this.currentSectionIdx].isFinal
        } : undefined;

        this.visualQueue.push({
            step: scheduledStep,
            time: time,
            bpm: Math.round(this.tempo),
            barCount: this.trainerCurrentBarCount,
            totalBars: this.totalBarsPracticed,
            pattern: this.currentPattern,
            formState: currentFormState,
            chordIndex: this.currentChordIndex
        });

        // Advance Step Index
        this.currentStepIndex++;
        if (this.currentStepIndex >= sub) {
            this.currentStepIndex = 0; // Bar Wrapped

            if (this.formasMode && this.formSections.length > 0) {
                this.currentFormBar++;
                this.currentFormTotalBars++;
                
                const currentSec = this.formSections[this.currentSectionIdx];
                if (this.currentFormBar >= currentSec.bars) {
                    this.currentSectionIdx++;
                    this.currentFormBar = 0;
                    
                    if (this.currentSectionIdx >= this.formSections.length) {
                        this.stop();
                        if (this.onPlaybackUpdate) {
                            this.onPlaybackUpdate(0, this.tempo, 0, this.totalBarsPracticed, this.currentPattern!, {
                                sectionName: '¡TERMINÓ!',
                                sectionBar: 0,
                                sectionTotalBars: 0,
                                totalFormBars: this.currentFormTotalBars,
                                part: 2,
                                isFinal: true
                            }, this.currentChordIndex);
                        }
                        return;
                    } else {
                        const newSec = this.formSections[this.currentSectionIdx];
                        if (newSec.name.includes('(2da)')) {
                            this.currentFormPart = 2;
                        }
                    }
                }
            }

            // Apply queued pattern switch precisely at the bar boundary!
            if (this.queuedPattern) {
                this.currentPattern = this.queuedPattern;
                this.queuedPattern = null;

                // Automatically switch tempo to the recommended tempo of the new pattern
                if (this.currentPattern.recommendedTempo) {
                    this.tempo = this.currentPattern.recommendedTempo;
                }

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
                    latestUpdate.pattern,
                    latestUpdate.formState || null,
                    latestUpdate.chordIndex
                );
            }
        }
        requestAnimationFrame(this.runVisualUpdateLoop);
    };
}

export default Scheduler;
