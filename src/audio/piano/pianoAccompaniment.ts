/**
 * Piano accompaniment patterns for one harmonic segment (half bar or whole bar).
 * Pure: returns the notes to schedule, the Scheduler sends them to the PianoSampler.
 *
 * (ES) Patrones de acompañamiento de piano para un segmento armónico.
 */
import { noteToMidi, voiceLead } from './notes';
import type { ScheduledNote } from './melody';

export const PIANO_STYLES = ['piano', 'piano_arpeggio'] as const;
export type PianoStyle = typeof PIANO_STYLES[number];

export const isPianoStyle = (style: string): style is PianoStyle =>
    (PIANO_STYLES as readonly string[]).includes(style);

export interface PianoSegment {
    /** Chord as note names, e.g. ["C4", "E4", "G4"]. */
    chord: readonly string[];
    /** Upper voices of the previous segment (MIDI), for voice leading. */
    previous: readonly number[];
    /** Segment length in seconds. */
    duration: number;
    /** Counted beats in the segment (2 in a 4/4 half bar, 3 in a 3/4 bar, 1 in a 6/8 half bar). */
    beats: number;
    /** Pulses per beat: 2 in simple meters (eighths), 3 in compound meters (eighths of a dotted quarter). */
    pulsesPerBeat: number;
}

export interface PianoSegmentResult {
    notes: ScheduledNote[];
    /** Voicing used for the upper voices, to pass as `previous` next time. */
    voicing: number[];
}

/**
 * 'piano': left hand plays the root an octave down on the downbeat, right hand plays the
 * voice-led chord on every beat (downbeat accented).
 * 'piano_arpeggio': bass on the downbeat, then the chord tones rise and fall on every pulse,
 * left ringing (sustain pedal feel) until the end of the segment.
 */
export function buildPianoSegment(style: PianoStyle, segment: PianoSegment): PianoSegmentResult {
    const midis = segment.chord.map(noteToMidi).filter((m): m is number => m !== null);
    if (midis.length === 0) return { notes: [], voicing: [...segment.previous] };

    const voicing = voiceLead(midis, segment.previous);
    const rootMidi = midis[0];
    // Bass: the chord root in the octave below middle C's neighbourhood (C2..B2/C3 range).
    let bass = rootMidi;
    while (bass >= 48) bass -= 12;
    while (bass < 36) bass += 12;

    const beats = Math.max(1, Math.round(segment.beats));
    const beat = segment.duration / beats;
    const notes: ScheduledNote[] = [{ midi: bass, offset: 0, duration: segment.duration * 0.95, velocity: 0.72 }];

    if (style === 'piano') {
        for (let b = 0; b < beats; b++) {
            const velocity = b === 0 ? 0.62 : 0.48;
            voicing.forEach(midi => notes.push({ midi, offset: b * beat, duration: beat * 0.9, velocity }));
        }
    } else {
        const pulses = beats * Math.max(1, Math.round(segment.pulsesPerBeat));
        const pulse = segment.duration / pulses;
        // Up and down the chord: 1-3-5-8-5-3-...
        const top = voicing[0] + 12;
        const cycle = voicing.length > 1 ? [...voicing, top, ...voicing.slice(1).reverse()] : [voicing[0], top];
        for (let p = 1; p < pulses; p++) {
            const midi = cycle[(p - 1) % cycle.length];
            notes.push({ midi, offset: p * pulse, duration: segment.duration - p * pulse, velocity: p % 2 === 0 ? 0.5 : 0.42 });
        }
        if (pulses === 1) {
            voicing.forEach(midi => notes.push({ midi, offset: 0, duration: segment.duration * 0.95, velocity: 0.5 }));
        }
    }
    return { notes, voicing };
}
