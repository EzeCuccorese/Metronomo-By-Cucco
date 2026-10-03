import { describe, it, expect } from 'vitest';
import { MelodyRecorder } from './MelodyRecorder';

// 4/4 at 120 BPM with a 16th-note grid: bar = 2 s, step = 0.125 s.
const STEP = 0.125;
const BAR = 2;

describe('MelodyRecorder', () => {
    it('ignores notes before the first recorded bar (count-in)', () => {
        const rec = new MelodyRecorder(1, 16);
        expect(rec.noteOn(60, 1, 0.5)).toBe(false);
        rec.markBar(BAR, STEP);
        expect(rec.noteOn(60, 1, BAR - 0.5)).toBe(false);
        expect(rec.quantize(BAR - 0.2)).toBeNull();
    });

    it('snaps note times to the nearest step of their bar', () => {
        const rec = new MelodyRecorder(2, 16);
        rec.markBar(10, STEP);
        expect(rec.quantize(10)).toBe(0);
        expect(rec.quantize(10 - 0.05)).toBe(0); // slightly early still counts as the downbeat
        expect(rec.quantize(10 + 0.06)).toBe(0);
        expect(rec.quantize(10 + 0.07)).toBe(1);
        expect(rec.quantize(10 + 0.5)).toBe(4);
        rec.markBar(12, STEP);
        expect(rec.quantize(12 + 0.25)).toBe(18);
        expect(rec.quantize(12 + 2 + 0.5)).toBeNull(); // beyond the last known bar line
    });

    it('records lengths from note-off and closes held notes at the end of the take', () => {
        const rec = new MelodyRecorder(1, 16);
        expect(rec.barsStarted).toBe(0);
        rec.markBar(0, STEP);
        expect(rec.barsStarted).toBe(1);
        rec.noteOn(60, 0.9, 0.01);
        rec.noteOff(60, 0.5); // 4 steps
        rec.noteOn(64, 0.6, 1.0);
        rec.noteOff(64, 1.02); // shorter than a step -> 1
        rec.noteOn(67, 0.7, 1.5); // still held at the end
        expect(rec.markBar(BAR, STEP)).toBe(true);
        const melody = rec.finish(BAR);
        expect(rec.isFinished).toBe(true);
        expect(melody).toEqual({
            bars: 1,
            subdivision: 16,
            notes: [
                { step: 0, midi: 60, velocity: 0.9, length: 4 },
                { step: 8, midi: 64, velocity: 0.6, length: 1 },
                { step: 12, midi: 67, velocity: 0.7, length: 4 },
            ],
        });
    });

    it('re-pressing a held key closes the previous note first', () => {
        const rec = new MelodyRecorder(1, 4);
        rec.markBar(0, 0.5);
        rec.noteOn(60, 1, 0);
        rec.noteOn(60, 1, 1);
        rec.noteOff(60, 1.5);
        expect(rec.toMelody().notes).toEqual([
            { step: 0, midi: 60, velocity: 1, length: 2 },
            { step: 2, midi: 60, velocity: 1, length: 1 },
        ]);
    });

    it('a note just before the closing downbeat wraps to step 0', () => {
        const rec = new MelodyRecorder(1, 16);
        rec.markBar(0, STEP);
        expect(rec.markBar(BAR, STEP)).toBe(true);
        rec.finish(BAR);
        expect(rec.acceptsLateNotesAt(BAR - 0.03)).toBe(true);
        expect(rec.noteOn(72, 0.8, BAR - 0.03)).toBe(true);
        expect(rec.toMelody().notes).toEqual([{ step: 0, midi: 72, velocity: 0.8, length: 1 }]);
        expect(rec.acceptsLateNotesAt(BAR + 0.1)).toBe(false);
        expect(rec.noteOn(74, 0.8, BAR + 0.1)).toBe(false);
    });

    it('accepts notes at any time while the take is open', () => {
        const rec = new MelodyRecorder(1, 4);
        expect(rec.acceptsLateNotesAt(123)).toBe(true);
    });

    it('follows tempo changes bar by bar', () => {
        const rec = new MelodyRecorder(2, 4);
        rec.markBar(0, 0.5); // 120 BPM
        rec.markBar(2, 0.25); // 240 BPM
        expect(rec.quantize(2.25)).toBe(5);
        rec.noteOn(60, 1, 2.25);
        rec.noteOff(60, 2.75); // two steps at the new tempo
        expect(rec.toMelody().notes[0].length).toBe(2);
    });
});
