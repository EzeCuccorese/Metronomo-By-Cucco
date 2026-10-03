import AudioContextManager from './AudioContextManager';
import DrumSynthesizer from './DrumSynthesizer';
import type { RhythmPattern, RhythmStep } from '../rhythms/RhythmPatterns';
import { PolyphonicSynth } from './PolyphonicSynth';
import type { AccompanimentStyle } from './PolyphonicSynth';
import { getBarDurationSeconds, getClickVelocity, getGroupCount } from '../rhythms/meter';
import ClockWorker from './clock.worker?worker'; // Vite Worker Import

export const FORM_GENRES = ['Chacarera Simple', 'Chacarera Doble', 'Zamba', 'Cueca Norteña', 'Gato Norteño'] as const;
export type FormGenre = typeof FORM_GENRES[number];

export interface FormSection {
    name: string;
    audioId: 'Intro' | 'Estrofa' | 'Interludio' | 'Estribillo' | 'Zapateo' | 'Precuenta' | 'Silencio';
    bars: number;
    part: 1 | 2;
    isFinal?: boolean;
}

export interface FormState {
    sectionName: string;
    sectionBar: number;
    sectionTotalBars: number;
    totalFormBars: number;
    part: number;
    isFinal: boolean;
    finished?: boolean;
}

export type TrainerMode = 'linear' | 'resistance_loop';

export interface TrainerConfig {
    active: boolean;
    startBpm: number;
    targetBpm: number;
    barsPerStep: number;
    bpmIncrement: number;
    mode: TrainerMode;
}

/** Snapshot delivered to the UI exactly when the corresponding step is heard. */
export interface PlaybackEvent {
    step: number;
    bpm: number;
    /** Bars elapsed in the current speed-trainer interval. */
    trainerBar: number;
    totalBars: number;
    pattern: RhythmPattern;
    formState: FormState | null;
    chordIndex: number;
    queuedPatternId: string | null;
}

interface VisualQueueEvent extends PlaybackEvent {
    time: number;
}

export function buildFormSections(genre: FormGenre, introBars: number): FormSection[] {
    const list: FormSection[] = [];

    const addPart = (part: 1 | 2) => {
        const suffix = part === 1 ? '1ra' : '2da';
        const push = (s: Omit<FormSection, 'part'>) => list.push({ ...s, part });
        push({ name: `PRECUENTA (${suffix})`, audioId: 'Precuenta', bars: 2 });
        push({ name: `INTRODUCCIÓN (${suffix})`, audioId: 'Intro', bars: introBars });

        if (genre === 'Chacarera Simple' || genre === 'Chacarera Doble') {
            const bars = genre === 'Chacarera Simple' ? 8 : 12;
            push({ name: 'ESTROFA 1', audioId: 'Estrofa', bars });
            push({ name: 'INTERLUDIO 1', audioId: 'Interludio', bars: introBars });
            push({ name: 'ESTROFA 2', audioId: 'Estrofa', bars });
            push({ name: 'INTERLUDIO 2', audioId: 'Interludio', bars: introBars });
            push({ name: 'ESTROFA 3', audioId: 'Estrofa', bars });
            push({ name: 'ESTRIBILLO (¡Se acaba!)', audioId: 'Estribillo', bars, isFinal: true });
        } else if (genre === 'Zamba' || genre === 'Cueca Norteña') {
            push({ name: 'ESTROFA 1', audioId: 'Estrofa', bars: 12 });
            push({ name: 'ESTROFA 2', audioId: 'Estrofa', bars: 12 });
            push({ name: 'ESTRIBILLO (¡Se acaba!)', audioId: 'Estribillo', bars: 12, isFinal: true });
        } else if (genre === 'Gato Norteño') {
            push({ name: 'ESTROFA 1 (A-A-B)', audioId: 'Estrofa', bars: 12 });
            push({ name: 'ZAPATEO 1', audioId: 'Zapateo', bars: 8 });
            push({ name: 'ZARANDEO / GIRO (A)', audioId: 'Estrofa', bars: 4 });
            push({ name: 'ZAPATEO 2', audioId: 'Zapateo', bars: 8 });
            push({ name: '¡AHURA! (B Final)', audioId: 'Estribillo', bars: 4, isFinal: true });
        }
    };

    addPart(1);
    list.push({ name: 'ENTRE TIEMPO (Silencio)', audioId: 'Silencio', bars: 1, part: 1 });
    addPart(2);

    return list;
}

const buildStepCache = (pattern: RhythmPattern): Map<number, RhythmStep[]> => {
    const cache = new Map<number, RhythmStep[]>();
    pattern.steps.forEach(step => {
        const list = cache.get(step.step);
        if (list) list.push(step);
        else cache.set(step.step, [step]);
    });
    return cache;
};

const sameMeter = (a: RhythmPattern, b: RhythmPattern) =>
    a.subdivision === b.subdivision &&
    a.timeSignature[0] === b.timeSignature[0] &&
    a.timeSignature[1] === b.timeSignature[1];

/**
 * Handles the precise scheduling of audio events.
 * Uses the "Lookahead" technique: a Web Worker clock wakes the scheduler, which
 * pushes events slightly ahead into the Web Audio timeline. A requestAnimationFrame
 * loop releases UI updates exactly when each step becomes audible.
 *
 * (ES) Agenda los eventos de audio con precisión usando la técnica "lookahead".
 */
class Scheduler {
    private audioContext: AudioContext;
    private synthesizer: DrumSynthesizer;

    // Harmony State
    private polySynth: PolyphonicSynth;
    private harmonyProgression: string[][] = [];
    private harmonyHalfBarIndex: number = 0;
    private lastChord: string[] = [];
    private currentChordIndex: number = -1;
    private accompanimentStyle: AccompanimentStyle = 'pad';

    // Timing variables
    private isPlaying: boolean = false;
    private nextNoteTime: number = 0.0;
    private tempo: number = 120.0;
    private readonly lookahead: number = 25.0; // ms
    private readonly scheduleAheadTime: number = 0.1; // seconds
    // A note this late still sounds (immediately); later ones were missed during a stall.
    private readonly lateToleranceSeconds: number = 0.03;
    // Stalls up to this long skip the missed steps and stay in phase; longer ones restart the grid.
    private readonly maxCatchUpSeconds: number = 1.0;
    // Until the first note is out there is no phase to keep (the clock may jump while resuming).
    private gridAnchored = false;
    private humanizeSeconds: number = 0;
    private clockWorker: Worker | null = null;
    private rafId: number | null = null;
    private disposed = false;

    // Pattern state
    private currentPattern: RhythmPattern | null = null;
    private queuedPattern: RhythmPattern | null = null;
    private currentStepIndex: number = 0;
    private stepCache: Map<number, RhythmStep[]> = new Map();

    // Precise Visual Synchronization Queue
    private visualQueue: VisualQueueEvent[] = [];

    // Speed Trainer State
    private trainer: TrainerConfig = { active: false, startBpm: 60, targetBpm: 120, barsPerStep: 4, bpmIncrement: 5, mode: 'linear' };
    private trainerCurrentBarCount: number = 0;
    private trainerHoldBars: number = 0;
    private readonly trainerCoolDownFactor: number = 0.95;

    // Study Features
    private silenceModeActive: boolean = false;
    private silenceChance: number = 0.5;
    private isMutedBar: boolean = false;
    private totalBarsPracticed: number = 0;

    // Formas (Folk Structures) State
    private formasMode: boolean = false;
    private formasGenre: FormGenre = 'Chacarera Simple';
    private formasIntroBars: number = 8;
    private formSections: FormSection[] = [];
    private currentSectionIdx: number = 0;
    private currentFormBar: number = 0;
    private currentFormTotalBars: number = 0;
    /** Audio time at which a finished form must stop the transport (set once the last bar is scheduled). */
    private formEndTime: number | null = null;

    private onPlaybackUpdate: ((event: PlaybackEvent) => void) | null = null;
    private onStopped: ((reason: 'form_finished') => void) | null = null;

    constructor() {
        this.audioContext = AudioContextManager.getInstance().getContext();
        this.synthesizer = new DrumSynthesizer();
        this.polySynth = new PolyphonicSynth();

        // Connect Polyphonic Synth to the multi-channel mixer strip
        this.polySynth.connect(this.synthesizer.getChannelNode('synth'));

        if (typeof Worker !== 'undefined') {
            this.clockWorker = new ClockWorker();
            this.clockWorker.onmessage = (e) => {
                if (e.data === 'tick') {
                    this.scheduler();
                }
            };
        }
    }

    // --- Mixer passthrough ---
    public setChannelVolume(name: string, volume: number) {
        this.synthesizer.setChannelVolume(name, volume);
    }

    public setChannelPan(name: string, pan: number) {
        this.synthesizer.setChannelPan(name, pan);
    }

    public setChannelMute(name: string, isMuted: boolean) {
        this.synthesizer.setChannelMute(name, isMuted);
    }

    // --- Harmony ---
    public setAccompanimentStyle(style: AccompanimentStyle) {
        this.accompanimentStyle = style;
    }

    public setHarmonyProgression(chords: string[][]) {
        const isDifferent = JSON.stringify(this.harmonyProgression) !== JSON.stringify(chords);
        if (isDifferent) {
            this.harmonyProgression = chords;
            this.harmonyHalfBarIndex = 0;
            this.lastChord = [];
        }
    }

    public setHarmonyVolume(vol: number) {
        this.polySynth.setVolume(vol);
    }

    // --- Transport ---
    public getTempo(): number {
        return this.tempo;
    }

    /** Resolves when the instrument samples are decoded (or failed and will use synthesis). */
    public whenReady(): Promise<void> {
        return this.synthesizer.loadPromise ?? Promise.resolve();
    }

    public getIsPlaying(): boolean {
        return this.isPlaying;
    }

    public setTempo(bpm: number) {
        if (this.tempo === bpm || !(bpm > 0)) return;

        const ratio = this.tempo / bpm;
        this.tempo = bpm;

        // Keep pending visual events consistent with the new tempo.
        this.visualQueue.forEach(event => {
            event.bpm = bpm;
        });

        if (this.isPlaying) {
            // Rescale the wait for the next step so the change is felt immediately.
            const now = this.audioContext.currentTime;
            const timeToNext = this.nextNoteTime - now;
            if (timeToNext > 0 && timeToNext < 1.0) {
                this.nextNoteTime = now + (timeToNext * ratio);
            }
        }
    }

    /** Random timing deviation applied to instruments (never to the guide click). */
    public setHumanize(milliseconds: number) {
        this.humanizeSeconds = Math.max(0, milliseconds) / 1000;
    }

    /**
     * Loads a pattern.
     * - Stopped: applied immediately.
     * - Playing, same pattern edited with the same meter: hot-swapped, heard from the next step.
     * - Playing, different pattern or meter: queued for the next bar line.
     */
    public setPattern(pattern: RhythmPattern) {
        if (this.currentPattern === pattern) {
            this.queuedPattern = null; // Re-selecting the active pattern cancels a pending switch.
            return;
        }
        if (this.queuedPattern === pattern) return;

        if (!this.isPlaying || !this.currentPattern) {
            this.applyPattern(pattern);
            this.currentStepIndex = 0;
            this.trainerCurrentBarCount = 0;
            this.visualQueue = [];
            return;
        }

        if (pattern.id === this.currentPattern.id && sameMeter(pattern, this.currentPattern)) {
            // Live edit: swap the steps in place without touching a pending switch.
            this.currentPattern = pattern;
            this.stepCache = buildStepCache(pattern);
            return;
        }

        this.queuedPattern = pattern;
    }

    private applyPattern(pattern: RhythmPattern) {
        this.currentPattern = pattern;
        this.queuedPattern = null;
        this.stepCache = buildStepCache(pattern);
    }

    public getQueuedPatternId(): string | null {
        return this.queuedPattern ? this.queuedPattern.id : null;
    }

    public configureTrainer(config: TrainerConfig) {
        const wasActive = this.trainer.active;
        this.trainer = { ...config };

        if (config.active && (!wasActive || !this.isPlaying)) {
            this.setTempo(config.startBpm);
            this.trainerCurrentBarCount = 0;
            this.trainerHoldBars = 0;
        }
    }

    public setSilenceMode(active: boolean, chance: number = 0.2) {
        this.silenceModeActive = active;
        this.silenceChance = Math.min(1, Math.max(0, chance));
        if (!active) this.isMutedBar = false;
    }

    public resetPracticeStats() {
        this.totalBarsPracticed = 0;
    }

    public getPracticeStats() {
        return { totalBars: this.totalBarsPracticed };
    }

    public setOnPlaybackUpdate(callback: (event: PlaybackEvent) => void) {
        this.onPlaybackUpdate = callback;
    }

    public setOnStopped(callback: (reason: 'form_finished') => void) {
        this.onStopped = callback;
    }

    public configureFormas(enabled: boolean, genre: FormGenre, introBars: number) {
        this.formasMode = enabled;
        this.formasGenre = genre;
        this.formasIntroBars = introBars;
    }

    public start() {
        if (this.isPlaying || this.disposed) return;

        this.isPlaying = true;
        this.currentStepIndex = 0;
        this.harmonyHalfBarIndex = 0;
        this.lastChord = [];
        this.currentChordIndex = -1;
        this.visualQueue = [];
        this.formEndTime = null;
        this.isMutedBar = false;
        this.trainerCurrentBarCount = 0;
        this.trainerHoldBars = 0;
        if (this.trainer.active) {
            this.tempo = this.trainer.startBpm;
        }
        this.nextNoteTime = this.audioContext.currentTime + 0.05; // Slight buffer
        this.gridAnchored = false;

        if (this.formasMode) {
            this.formSections = buildFormSections(this.formasGenre, this.formasIntroBars);
            this.currentSectionIdx = 0;
            this.currentFormBar = 0;
            this.currentFormTotalBars = 0;
        }

        this.clockWorker?.postMessage({ action: 'start', interval: this.lookahead });
        this.startVisualLoop();
    }

    public stop() {
        if (this.isPlaying) {
            this.synthesizer.silence();
            this.polySynth.silence();
        }
        this.isPlaying = false;
        this.clockWorker?.postMessage({ action: 'stop' });
        this.stopVisualLoop();
        this.visualQueue = [];
        this.formEndTime = null;
        if (this.queuedPattern) {
            // A queued switch that never reached its bar line becomes the active pattern.
            this.applyPattern(this.queuedPattern);
        }
        this.harmonyHalfBarIndex = 0;
        this.lastChord = [];
        this.currentChordIndex = -1;
    }

    /** Releases the worker, the animation loop and every audio node. The instance is unusable afterwards. */
    public dispose() {
        if (this.disposed) return;
        this.stop();
        this.disposed = true;
        this.clockWorker?.terminate();
        this.clockWorker = null;
        this.onPlaybackUpdate = null;
        this.onStopped = null;
        this.synthesizer.dispose();
        this.polySynth.dispose();
    }

    public playOneShot(instrument: string, modifier?: string) {
        const time = this.audioContext.currentTime;
        this.synthesizer.play(instrument, time, 1.0, modifier); // Full velocity for preview
    }

    private scheduler() {
        if (!this.isPlaying) return;

        const now = this.audioContext.currentTime;

        // Before the first note (start/resume) or after a long stall (e.g. a throttled background
        // tab) restart the grid from now instead of skipping or fast-forwarding through bars.
        const behind = now - this.nextNoteTime;
        if ((!this.gridAnchored && behind > 0) || behind > this.maxCatchUpSeconds) {
            this.nextNoteTime = now;
        }

        while (this.isPlaying && this.formEndTime === null && this.nextNoteTime < now + this.scheduleAheadTime) {
            const time = this.nextNoteTime;
            // Steps missed during a short stall advance silently so the grid stays in phase
            // (playing them would fire a burst of notes at once).
            const missed = time < now - this.lateToleranceSeconds;
            this.scheduleNote(time, missed);
            this.nextStep(time, missed);
            this.gridAnchored = true;
        }
    }

    private currentSection(): FormSection | null {
        return this.formasMode ? this.formSections[this.currentSectionIdx] ?? null : null;
    }

    private grooveOffset(idx: number, stepDuration: number, activeSteps: RhythmStep[]): number {
        const pattern = this.currentPattern!;
        switch (pattern.grooveType) {
            case 'swing_triplet':
                return idx % 2 !== 0 ? stepDuration * (pattern.swingBase || 0.15) : 0;
            case 'samba_carioca': {
                const pos = idx % 4;
                if (pos === 1) return stepDuration * 0.18;
                if (pos === 3) return -stepDuration * 0.05;
                return 0;
            }
            case 'chacarera_poliritmica':
                // Urgency on beat 3 of the 3/4 feel (step 9)
                return activeSteps.some(s => s.step === 9) ? -0.003 : 0;
            case 'zamba_tradicional':
                // Drag on the main "Pám" (step 9)
                return activeSteps.some(s => s.step === 9) ? stepDuration * 0.12 : 0;
            case 'chamame_saltadito':
                if (idx === 4) return -0.006;
                if (idx === 10) return -0.004;
                return 0;
            case 'salsa_tumbao':
                return idx === 7 || idx === 15 ? -0.004 : 0;
            case 'cumbia_colombiana': {
                const pos = idx % 4;
                if (pos === 1) return stepDuration * 0.08;
                if (pos === 3) return -stepDuration * 0.04;
                return 0;
            }
            default:
                return 0;
        }
    }

    private scheduleNote(time: number, silent = false) {
        if (!this.currentPattern) return;

        const sub = this.currentPattern.subdivision;
        const ts = this.currentPattern.timeSignature;
        const idx = this.currentStepIndex;
        const section = this.currentSection();

        // --- HARMONY TRIGGER ---
        // The progression is counted in half bars. Meters with an even number of beats
        // (2/4, 4/4, 6/8, 12/8) change chord on each half; odd ones (3/4) can't be split
        // on a beat, so each chord lasts the whole bar and consumes two half-bar units.
        const harmonyAllowed = !section || (section.audioId !== 'Precuenta' && section.audioId !== 'Silencio');
        const groups = getGroupCount(ts);
        const segments = groups % 2 === 0 && sub % 2 === 0 ? 2 : 1;
        const isSegmentStart = idx === 0 || (segments === 2 && idx === sub / 2);

        if (isSegmentStart) {
            if (this.harmonyProgression.length > 0 && harmonyAllowed) {
                const chordIndex = this.harmonyHalfBarIndex % this.harmonyProgression.length;
                this.currentChordIndex = chordIndex;
                const chord = this.harmonyProgression[chordIndex];
                const segmentDuration = getBarDurationSeconds(this.tempo, ts) / segments;

                if (silent) {
                    // Missed during a stall: keep voice leading anchored to the progression.
                    if (chord && chord.length > 0) this.lastChord = chord;
                } else if (chord && chord.length > 0 && !(this.silenceModeActive && this.isMutedBar)) {
                    // A slightly late chord starts now: envelope ramps can't be scheduled in the past.
                    const chordTime = Math.max(time, this.audioContext.currentTime);
                    this.polySynth.playChord(chord, segmentDuration, chordTime, this.accompanimentStyle, this.lastChord, groups / segments);
                    this.lastChord = chord;
                }
                this.harmonyHalfBarIndex += 2 / segments;
            } else {
                this.currentChordIndex = -1;
            }
        }

        if (silent) {
            return; // Missed step: harmony counters advanced above, nothing sounds.
        }
        if (this.silenceModeActive && this.isMutedBar) {
            return; // Silent bar: the musician keeps time alone.
        }
        if (section?.audioId === 'Silencio') {
            return;
        }

        const activeSteps = this.stepCache.get(idx + 1) || [];
        const stepDuration = getBarDurationSeconds(this.tempo, ts) / sub;
        const now = this.audioContext.currentTime;

        const groove = this.grooveOffset(idx, stepDuration, activeSteps);
        const jitter = this.humanizeSeconds > 0 ? (Math.random() - 0.5) * this.humanizeSeconds : 0;
        // Never schedule in the past: late events would pile up and fire together.
        const playTime = Math.max(now, time + groove + jitter);

        activeSteps.forEach(step => {
            if (section) {
                if (section.audioId === 'Precuenta' && step.instrument !== 'click') return; // Count-in: click only
                if ((section.audioId === 'Intro' || section.audioId === 'Interludio') && step.instrument === 'bombo_leguero' && step.modifier !== 'aro') {
                    return; // Only the rim plays during intro/interludio
                }
            }
            const stepTime = step.instrument === 'click' ? Math.max(now, time) : playTime;
            this.synthesizer.play(step.instrument, stepTime, step.velocity, step.modifier);
        });

        // Guide click on every pulse, exactly on the grid (no groove, no humanize).
        const clickVelocity = getClickVelocity(idx, sub, ts);
        if (clickVelocity !== null && !activeSteps.some(s => s.instrument === 'click')) {
            this.synthesizer.play('click', Math.max(now, time), clickVelocity);
        }
    }

    private buildFormState(): FormState | null {
        const section = this.currentSection();
        if (!section) return null;
        return {
            sectionName: section.name,
            sectionBar: this.currentFormBar,
            sectionTotalBars: section.bars,
            totalFormBars: this.currentFormTotalBars,
            part: section.part,
            isFinal: !!section.isFinal
        };
    }

    private nextStep(time: number, silent = false) {
        if (!this.currentPattern) return;

        const sub = this.currentPattern.subdivision;
        const timePerStep = getBarDurationSeconds(this.tempo, this.currentPattern.timeSignature) / sub;

        if (!silent) this.visualQueue.push({
            step: this.currentStepIndex,
            time,
            bpm: Math.round(this.tempo),
            trainerBar: this.trainerCurrentBarCount,
            totalBars: this.totalBarsPracticed,
            pattern: this.currentPattern,
            formState: this.buildFormState(),
            chordIndex: this.currentChordIndex,
            queuedPatternId: this.getQueuedPatternId()
        });

        this.nextNoteTime += timePerStep;
        this.currentStepIndex++;

        if (this.currentStepIndex < sub) return;

        // --- Bar line ---
        this.currentStepIndex = 0;
        this.totalBarsPracticed++;

        if (this.formasMode && this.formSections.length > 0) {
            this.currentFormBar++;
            this.currentFormTotalBars++;

            const section = this.formSections[this.currentSectionIdx];
            if (section && this.currentFormBar >= section.bars) {
                this.currentSectionIdx++;
                this.currentFormBar = 0;

                if (this.currentSectionIdx >= this.formSections.length) {
                    // Stop when the last bar has actually been heard, not when it was scheduled.
                    this.formEndTime = this.nextNoteTime;
                    return;
                }
            }
        }

        // Apply queued pattern switch precisely at the bar boundary
        if (this.queuedPattern) {
            this.applyPattern(this.queuedPattern);
            if (this.currentPattern.recommendedTempo && !this.trainer.active) {
                this.tempo = this.currentPattern.recommendedTempo;
            }
        }

        this.isMutedBar = this.silenceModeActive && Math.random() < this.silenceChance;

        if (this.trainer.active) {
            this.advanceTrainer();
        }
    }

    private advanceTrainer() {
        this.trainerCurrentBarCount++;
        if (this.trainerCurrentBarCount < this.trainer.barsPerStep) return;
        this.trainerCurrentBarCount = 0;

        const { startBpm, targetBpm, bpmIncrement, mode } = this.trainer;
        if (mode === 'linear') {
            if (startBpm < targetBpm) {
                this.tempo = Math.min(this.tempo + bpmIncrement, targetBpm);
            } else if (startBpm > targetBpm) {
                this.tempo = Math.max(this.tempo - bpmIncrement, targetBpm);
            }
        } else if (this.tempo >= targetBpm) {
            this.trainerHoldBars++;
            if (this.trainerHoldBars > 4) {
                this.tempo = Math.round(this.tempo * this.trainerCoolDownFactor);
                this.trainerHoldBars = 0;
            }
        } else {
            this.tempo = Math.min(this.tempo + bpmIncrement, targetBpm);
        }
    }

    private startVisualLoop() {
        if (this.rafId === null && typeof requestAnimationFrame !== 'undefined') {
            this.rafId = requestAnimationFrame(this.runVisualUpdateLoop);
        }
    }

    private stopVisualLoop() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    /**
     * requestAnimationFrame loop: releases each queued step to the UI when the
     * audio clock reaches it, and ends finished forms on time.
     */
    private runVisualUpdateLoop = () => {
        this.rafId = null;
        if (!this.isPlaying) return;

        const now = this.audioContext.currentTime;
        let latestUpdate: VisualQueueEvent | null = null;

        while (this.visualQueue.length > 0 && this.visualQueue[0].time <= now) {
            latestUpdate = this.visualQueue.shift()!;
        }

        if (latestUpdate) {
            this.onPlaybackUpdate?.(latestUpdate);
        }

        if (this.formEndTime !== null && now >= this.formEndTime && this.visualQueue.length === 0) {
            const finishedState: FormState = {
                sectionName: '¡TERMINÓ!',
                sectionBar: 0,
                sectionTotalBars: 0,
                totalFormBars: this.currentFormTotalBars,
                part: 2,
                isFinal: true,
                finished: true
            };
            const pattern = this.currentPattern!;
            this.stop();
            this.onPlaybackUpdate?.({
                step: 0,
                bpm: Math.round(this.tempo),
                trainerBar: 0,
                totalBars: this.totalBarsPracticed,
                pattern,
                formState: finishedState,
                chordIndex: -1,
                queuedPatternId: null
            });
            this.onStopped?.('form_finished');
            return;
        }

        this.startVisualLoop();
    };
}

export default Scheduler;
