import { describe, it, expect } from 'vitest';
import {
    CUSTOM_PATTERN_ID, DEFAULT_CUSTOM_PATTERN, METRONOME_PATTERN_ID, getBasePattern, isMetronomePattern,
    isValidOverrides, isValidPattern, normalizePatternId, resolvePattern, withUsedInstruments
} from './patternLibrary';
import { PRESET_PATTERNS } from './RhythmPatterns';

describe('patternLibrary', () => {
    it('resolves aliases, presets, the custom pattern and unknown ids', () => {
        expect(normalizePatternId('metronome')).toBe(METRONOME_PATTERN_ID);
        expect(getBasePattern('metronome')?.id).toBe(METRONOME_PATTERN_ID);
        expect(getBasePattern(CUSTOM_PATTERN_ID)).toBe(DEFAULT_CUSTOM_PATTERN);
        expect(getBasePattern('nope')).toBeUndefined();
        expect(resolvePattern('nope', {})).toBe(PRESET_PATTERNS[0]);
    });

    it('prefers user overrides over the built-in preset', () => {
        const edited = { ...PRESET_PATTERNS[0], steps: [] };
        expect(resolvePattern(PRESET_PATTERNS[0].id, { [edited.id]: edited })).toBe(edited);
    });

    it('recognises the metronome preset (C1 regression: it used to be compared against a wrong id)', () => {
        const metronome = PRESET_PATTERNS.find(p => p.id === METRONOME_PATTERN_ID)!;
        expect(isMetronomePattern(metronome)).toBe(true);
        expect(isMetronomePattern(PRESET_PATTERNS.find(p => p.id === 'rock_basic')!)).toBe(false);
    });

    it('accepts every preset as a valid stored pattern', () => {
        PRESET_PATTERNS.forEach(p => expect(isValidPattern(p), p.id).toBe(true));
        expect(isValidPattern(DEFAULT_CUSTOM_PATTERN)).toBe(true);
    });

    it('rejects corrupted stored patterns', () => {
        const base = PRESET_PATTERNS[0];
        expect(isValidPattern(null)).toBe(false);
        expect(isValidPattern({ ...base, timeSignature: [4] })).toBe(false);
        expect(isValidPattern({ ...base, subdivision: 0 })).toBe(false);
        expect(isValidPattern({ ...base, instruments: ['theremin'] })).toBe(false);
        expect(isValidPattern({ ...base, steps: [{ step: 99, instrument: 'kick', velocity: 1 }] })).toBe(false);
        expect(isValidPattern({ ...base, steps: [{ step: 1, instrument: 'kick', velocity: 9 }] })).toBe(false);
        expect(isValidOverrides({ rock_basic: base })).toBe(true);
        expect(isValidOverrides({ wrong_key: base })).toBe(false);
        expect(isValidOverrides([])).toBe(false);
    });

    it('adds instruments used by steps to the instrument list', () => {
        const p = { ...DEFAULT_CUSTOM_PATTERN, steps: [{ step: 1, instrument: 'cajon' as const, velocity: 1 }] };
        expect(withUsedInstruments(p).instruments).toContain('cajon');
        expect(withUsedInstruments(DEFAULT_CUSTOM_PATTERN)).toBe(DEFAULT_CUSTOM_PATTERN);
    });
});
