import { describe, it, expect } from 'vitest';
import { buildPianoSegment, isPianoStyle } from './pianoAccompaniment';

const C = ['C4', 'E4', 'G4'];
const G = ['G4', 'B4', 'D5'];

describe('piano accompaniment', () => {
    it('recognises the piano styles', () => {
        expect(isPianoStyle('piano')).toBe(true);
        expect(isPianoStyle('piano_arpeggio')).toBe(true);
        expect(isPianoStyle('pad')).toBe(false);
    });

    it("'piano': bass on the downbeat and the chord on every beat (4/4 half bar)", () => {
        const { notes, voicing } = buildPianoSegment('piano', { chord: C, previous: [], duration: 1, beats: 2, pulsesPerBeat: 2 });
        expect(voicing).toEqual([60, 64, 67]);
        const bass = notes.filter(n => n.midi < 48);
        expect(bass).toEqual([{ midi: 36, offset: 0, duration: 0.95, velocity: 0.72 }]);
        const chordHits = Array.from(new Set(notes.filter(n => n.midi >= 48).map(n => n.offset)));
        expect(chordHits).toEqual([0, 0.5]);
        // Downbeat accented.
        expect(notes.find(n => n.midi === 60 && n.offset === 0)!.velocity).toBeGreaterThan(notes.find(n => n.midi === 60 && n.offset === 0.5)!.velocity);
    });

    it("'piano' in 3/4 hits the chord on the three beats", () => {
        const { notes } = buildPianoSegment('piano', { chord: C, previous: [], duration: 1.5, beats: 3, pulsesPerBeat: 2 });
        expect(Array.from(new Set(notes.filter(n => n.midi >= 48).map(n => n.offset)))).toEqual([0, 0.5, 1]);
    });

    it('voice-leads the next chord from the previous voicing', () => {
        const first = buildPianoSegment('piano', { chord: C, previous: [], duration: 1, beats: 2, pulsesPerBeat: 2 });
        const second = buildPianoSegment('piano', { chord: G, previous: first.voicing, duration: 1, beats: 2, pulsesPerBeat: 2 });
        // G major near C major: G4 stays, B3 and D4 instead of B4/D5.
        expect(second.voicing).toEqual([59, 62, 67]);
        // The bass still plays the root low.
        expect(second.notes[0].midi).toBe(43);
    });

    it("'piano_arpeggio' walks the chord on every pulse, triplet feel in compound meters", () => {
        const simple = buildPianoSegment('piano_arpeggio', { chord: C, previous: [], duration: 1, beats: 2, pulsesPerBeat: 2 });
        expect(simple.notes.map(n => n.offset)).toEqual([0, 0.25, 0.5, 0.75]);
        expect(simple.notes.map(n => n.midi)).toEqual([36, 60, 64, 67]);
        // Notes ring until the end of the segment (pedal).
        simple.notes.slice(1).forEach(n => expect(n.offset + n.duration).toBeCloseTo(1, 9));

        const compound = buildPianoSegment('piano_arpeggio', { chord: C, previous: [], duration: 0.75, beats: 1, pulsesPerBeat: 3 });
        expect(compound.notes.map(n => n.offset)).toEqual([0, 0.25, 0.5]);

        const long = buildPianoSegment('piano_arpeggio', { chord: C, previous: [], duration: 2, beats: 4, pulsesPerBeat: 2 });
        expect(long.notes.slice(1).map(n => n.midi)).toEqual([60, 64, 67, 72, 67, 64, 60]);
    });

    it('arpeggiates a single-note chord with its octave, and plays it as a block on a single pulse', () => {
        const one = buildPianoSegment('piano_arpeggio', { chord: ['A3'], previous: [], duration: 1, beats: 2, pulsesPerBeat: 2 });
        expect(one.notes.slice(1).map(n => n.midi)).toEqual([57, 69, 57]);
        const block = buildPianoSegment('piano_arpeggio', { chord: C, previous: [], duration: 1, beats: 1, pulsesPerBeat: 1 });
        expect(block.notes.map(n => n.midi)).toEqual([36, 60, 64, 67]);
    });

    it('keeps the bass in the low register for high and very low roots', () => {
        expect(buildPianoSegment('piano', { chord: ['C6'], previous: [], duration: 1, beats: 1, pulsesPerBeat: 2 }).notes[0].midi).toBe(36);
        expect(buildPianoSegment('piano', { chord: ['A1'], previous: [], duration: 1, beats: 1, pulsesPerBeat: 2 }).notes[0].midi).toBe(45);
    });

    it('ignores invalid chords', () => {
        expect(buildPianoSegment('piano', { chord: ['X9'], previous: [60], duration: 1, beats: 2, pulsesPerBeat: 2 })).toEqual({ notes: [], voicing: [60] });
    });
});
