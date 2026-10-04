import { describe, it, expect } from 'vitest';
import {
    chordPitchClasses, COMPUTER_KEY_SEMITONES, COMPUTER_LAYOUTS, computerKeyCode, fallbackKeyLabel, layoutSpan, computerKeyLabel, isBlackKey, midiToFrequency, midiToNoteName,
    noteToMidi, OCTAVE_KEYS, pitchClass, scalePitchClasses, spanishNoteLabel, spanishNoteName, voiceLead,
} from './notes';

describe('note helpers', () => {
    it('converts note names to MIDI (sharps, flats and octave edges)', () => {
        expect(noteToMidi('C4')).toBe(60);
        expect(noteToMidi('A4')).toBe(69);
        expect(noteToMidi('C#4')).toBe(61);
        expect(noteToMidi('Db4')).toBe(61);
        expect(noteToMidi('Bb3')).toBe(58);
        expect(noteToMidi('B#3')).toBe(60);
        expect(noteToMidi('Cb4')).toBe(59);
        expect(noteToMidi('C-1')).toBe(0);
        expect(noteToMidi(' E2 ')).toBe(40);
        expect(noteToMidi('H4')).toBeNull();
        expect(noteToMidi('C')).toBeNull();
    });

    it('converts MIDI back to sharp names and frequencies', () => {
        expect(midiToNoteName(60)).toBe('C4');
        expect(midiToNoteName(70)).toBe('A#4');
        expect(midiToNoteName(36)).toBe('C2');
        expect(midiToFrequency(69)).toBeCloseTo(440, 6);
        expect(midiToFrequency(60)).toBeCloseTo(261.63, 2);
        expect(midiToFrequency(81)).toBeCloseTo(880, 6);
    });

    it('knows black keys and pitch classes (also below zero)', () => {
        expect([60, 61, 62, 63, 64, 65, 66].map(isBlackKey)).toEqual([false, true, false, true, false, false, true]);
        expect(pitchClass(-1)).toBe(11);
        expect(pitchClass(73)).toBe(1);
    });

    it('names notes in Spanish, with sostenidos', () => {
        expect(spanishNoteName(60)).toBe('Do');
        expect(spanishNoteName(61)).toBe('Do♯');
        expect(spanishNoteName(67)).toBe('Sol');
        expect(spanishNoteName(70)).toBe('La♯');
        expect(spanishNoteLabel(60)).toBe('Do 4');
        expect(spanishNoteLabel(66)).toBe('Fa sostenido 4');
        expect(spanishNoteLabel(47)).toBe('Si 2');
    });

    it('builds scale and chord pitch-class sets', () => {
        expect([...scalePitchClasses(0, 'major')].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
        expect([...scalePitchClasses(9, 'minor')].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
        expect([...scalePitchClasses(2, 'major')]).toContain(6); // Re mayor has Fa#
        expect([...chordPitchClasses(['C4', 'E4', 'G4', 'nope'])]).toEqual([0, 4, 7]);
    });
});

describe('voiceLead', () => {
    it('keeps the first chord as written (sorted)', () => {
        expect(voiceLead([67, 60, 64], [])).toEqual([60, 64, 67]);
        expect(voiceLead([], [60])).toEqual([]);
    });

    it('moves each voice to the nearest octave of the previous chord (common tones stay)', () => {
        // C major (C4 E4 G4) -> F major written in root position high up (F4 A4 C5)
        const next = voiceLead([65, 69, 72], [60, 64, 67]);
        expect(next).toContain(60); // C stays where it was
        expect(next).toContain(65);
        expect(next).toContain(69);
        // Total movement is small: no voice jumps more than a fourth.
        next.forEach(n => expect(Math.min(...[60, 64, 67].map(p => Math.abs(p - n)))).toBeLessThanOrEqual(5));
    });

    it('stays inside the playable range', () => {
        const voiced = voiceLead([84, 88, 91], [77, 79], 48, 79);
        voiced.forEach(n => {
            expect(n).toBeGreaterThanOrEqual(48);
            expect(n).toBeLessThanOrEqual(79);
        });
    });
});

describe('computer keyboard layout', () => {
    it('maps one octave and a third from A, with Z/X for octaves', () => {
        expect(COMPUTER_KEY_SEMITONES.KeyA).toBe(0);
        expect(COMPUTER_KEY_SEMITONES.KeyW).toBe(1);
        expect(COMPUTER_KEY_SEMITONES.KeyK).toBe(12);
        expect(COMPUTER_KEY_SEMITONES.Semicolon).toBe(16);
        expect(OCTAVE_KEYS.KeyZ).toBe(-1);
        expect(OCTAVE_KEYS.KeyX).toBe(1);
        // The keys must not clash with the global shortcuts (Space, arrows); T is handled by capture.
        expect(Object.keys(COMPUTER_KEY_SEMITONES)).not.toContain('Space');
    });

    it('labels the on-screen keys', () => {
        expect(computerKeyLabel(0)).toBe('A');
        expect(computerKeyLabel(6)).toBe('T');
        expect(computerKeyLabel(16)).toBe('Ñ');
        expect(computerKeyLabel(17)).toBeNull();
    });
});

describe('computer keyboard layouts', () => {
    it('the tracker layout covers the 25 visible keys with two rows and never collides with itself', () => {
        const { notes, octave, velocity } = COMPUTER_LAYOUTS.tracker;
        expect(layoutSpan('tracker')).toBe(24);
        expect(new Set(Object.values(notes)).size).toBe(Object.keys(notes).length);
        expect(Array.from({ length: 25 }, (_, i) => computerKeyCode(i, 'tracker'))).not.toContain(null);
        expect([notes.KeyZ, notes.KeyS, notes.KeyQ, notes.Digit2, notes.KeyI]).toEqual([0, 1, 12, 13, 24]);
        // Octave and velocity moved off the note keys.
        for (const code of [octave.down, octave.up, velocity.down, velocity.up]) expect(notes[code]).toBeUndefined();
        expect(Object.keys(notes)).not.toContain('Space');
    });

    it('keeps the Ableton layout as the default and labels keys with Spanish-friendly fallbacks', () => {
        expect(COMPUTER_LAYOUTS.ableton.notes).toBe(COMPUTER_KEY_SEMITONES);
        expect(layoutSpan('ableton')).toBe(16);
        expect(fallbackKeyLabel('KeyA')).toBe('A');
        expect(fallbackKeyLabel('Digit2')).toBe('2');
        expect(fallbackKeyLabel('Semicolon')).toBe('Ñ');
        expect(fallbackKeyLabel('Comma')).toBe(',');
        expect(fallbackKeyLabel('IntlRo')).toBe('IntlRo');
    });
});
