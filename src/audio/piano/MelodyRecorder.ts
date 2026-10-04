/**
 * Records one take of a melody against the bar lines the Scheduler reports.
 * Note times are audio-clock times; they are snapped to the nearest step of the bar
 * they fall in, so tempo changes between bars are handled too.
 *
 * (ES) Graba una toma de melodía cuantizada a la grilla de cada compás.
 */
import type { Melody, MelodyNote } from './melody';
import { normalizeMelody } from './melody';

interface BarMark {
    time: number;
    stepDuration: number;
}

export class MelodyRecorder {
    private barMarks: BarMark[] = [];
    private notes: MelodyNote[] = [];
    private held = new Map<number, { step: number; time: number; velocity: number }>();
    private endTime: number | null = null;
    private readonly total: number;
    public readonly bars: number;
    public readonly subdivision: number;

    constructor(bars: number, subdivision: number) {
        this.bars = bars;
        this.subdivision = subdivision;
        this.total = bars * subdivision;
    }

    /** Bars already started (0 before the take begins). */
    public get barsStarted(): number {
        return this.barMarks.length;
    }

    public get isFinished(): boolean {
        return this.endTime !== null;
    }

    /**
     * Called at every bar line while recording. Returns true when this bar line ends the take
     * (all bars were recorded): the caller then calls `finish()`.
     */
    public markBar(time: number, stepDuration: number): boolean {
        if (this.barMarks.length >= this.bars) return true;
        this.barMarks.push({ time, stepDuration });
        return false;
    }

    /** Step (0 .. total-1) for an audio time, or null when it falls outside the take. */
    public quantize(time: number): number | null {
        if (this.barMarks.length === 0) return null;
        let k = -1;
        for (let i = 0; i < this.barMarks.length; i++) {
            const m = this.barMarks[i];
            if (m.time - m.stepDuration / 2 <= time) k = i;
        }
        if (k < 0) return null; // count-in: before the first recorded bar
        const mark = this.barMarks[k];
        const step = Math.max(0, Math.round((time - mark.time) / mark.stepDuration));
        if (this.endTime !== null && time >= this.endTime + mark.stepDuration / 2) return null;
        if (step > this.subdivision) return null; // past the last known bar line
        return (k * this.subdivision + step) % this.total;
    }

    /** Duration of one step around `time` (for note lengths). */
    private stepDurationAt(time: number): number {
        let d = this.barMarks[0]?.stepDuration ?? 0.125;
        for (const m of this.barMarks) if (m.time <= time) d = m.stepDuration;
        return d;
    }

    /** Returns true when the note was taken into the recording. */
    public noteOn(midi: number, velocity: number, time: number): boolean {
        const step = this.quantize(time);
        if (step === null) return false;
        this.closeHeld(midi, time);
        this.held.set(midi, { step, time, velocity });
        if (this.endTime !== null) this.closeHeld(midi, this.endTime);
        return true;
    }

    public noteOff(midi: number, time: number) {
        this.closeHeld(midi, time);
    }

    private closeHeld(midi: number, time: number) {
        const h = this.held.get(midi);
        if (!h) return;
        this.held.delete(midi);
        const steps = Math.round((time - h.time) / this.stepDurationAt(h.time));
        const length = Math.min(this.total, Math.max(1, steps));
        this.notes.push({ step: h.step, midi, velocity: h.velocity, length });
    }

    /** Ends the take at `time` (the bar line after the last recorded bar). */
    public finish(time: number): Melody {
        this.endTime = time;
        Array.from(this.held.keys()).forEach(midi => this.closeHeld(midi, time));
        return this.toMelody();
    }

    public toMelody(): Melody {
        return normalizeMelody({ bars: this.bars, subdivision: this.subdivision, notes: [...this.notes] });
    }

    /** After the take ends, a note slightly early for the next downbeat still belongs to it. */
    public acceptsLateNotesAt(time: number): boolean {
        if (this.endTime === null) return true;
        return time < this.endTime + this.stepDurationAt(this.endTime) / 2;
    }
}
