import { PRESET_PATTERNS } from './RhythmPatterns';
import type { InstrumentType, RhythmPattern, RhythmStep } from './RhythmPatterns';
import { INSTRUMENT_CHANNEL } from '../audio/instrumentChannels';
import { isPlainObject } from '../state/storage';
import { MAX_BPM, MIN_BPM } from './meter';

export const METRONOME_PATTERN_ID = 'metronome_4_4';
export const CUSTOM_PATTERN_ID = 'custom';
export const DEFAULT_PATTERN_ID = 'rock_basic';

/** Aliases used by the preset selector. */
const PATTERN_ALIASES: Record<string, string> = { metronome: METRONOME_PATTERN_ID };

export const DEFAULT_CUSTOM_PATTERN: RhythmPattern = {
    id: CUSTOM_PATTERN_ID,
    name: 'Patrón Personalizado',
    description: 'Tu propio patrón creado en el editor.',
    timeSignature: [4, 4],
    subdivision: 16,
    instruments: ['kick', 'snare', 'hihat', 'click'],
    countingMode: 'numbers',
    steps: []
};

export const normalizePatternId = (id: string): string => PATTERN_ALIASES[id] ?? id;

export const getBasePattern = (id: string): RhythmPattern | undefined => {
    const normalized = normalizePatternId(id);
    if (normalized === CUSTOM_PATTERN_ID) return DEFAULT_CUSTOM_PATTERN;
    return PRESET_PATTERNS.find(p => p.id === normalized);
};

/** User edits (overrides) win over the built-in preset with the same id. */
export const resolvePattern = (id: string, overrides: Record<string, RhythmPattern>): RhythmPattern => {
    const normalized = normalizePatternId(id);
    return overrides[normalized] ?? getBasePattern(normalized) ?? PRESET_PATTERNS[0];
};

/** True for patterns whose only voice is the guide click. */
export const isMetronomePattern = (pattern: RhythmPattern): boolean =>
    pattern.instruments.length > 0 && pattern.instruments.every(i => i === 'click');

const KNOWN_INSTRUMENTS = new Set(Object.keys(INSTRUMENT_CHANNEL));

const GROOVE_TYPES: ReadonlySet<string> = new Set<NonNullable<RhythmPattern['grooveType']>>([
    'straight', 'swing_triplet', 'samba_carioca', 'chacarera_poliritmica', 'zamba_tradicional',
    'chamame_saltadito', 'salsa_tumbao', 'cumbia_colombiana',
]);
const COUNTING_MODES: ReadonlySet<string> = new Set<RhythmPattern['countingMode']>([
    'numbers', '1e&a', '1&2&', 'triplet_1la2la', 'mnemonics_chacarera',
]);

const isOptionalNumberIn = (v: unknown, min: number, max: number) =>
    v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max);

const isValidStep = (v: unknown, subdivision: number): v is RhythmStep =>
    isPlainObject(v) &&
    Number.isInteger(v.step) && (v.step as number) >= 1 && (v.step as number) <= subdivision &&
    typeof v.instrument === 'string' && KNOWN_INSTRUMENTS.has(v.instrument) &&
    typeof v.velocity === 'number' && v.velocity >= 0 && v.velocity <= 1.5;

/** Structural validation for patterns coming from storage. */
export const isValidPattern = (v: unknown): v is RhythmPattern => {
    if (!isPlainObject(v)) return false;
    const { id, name, timeSignature, subdivision, instruments, steps } = v;
    return typeof id === 'string' && typeof name === 'string' &&
        Array.isArray(timeSignature) && timeSignature.length === 2 &&
        timeSignature.every(n => Number.isInteger(n) && n > 0 && n <= 32) &&
        Number.isInteger(subdivision) && (subdivision as number) > 0 && (subdivision as number) <= 96 &&
        Array.isArray(instruments) && instruments.every(i => typeof i === 'string' && KNOWN_INSTRUMENTS.has(i)) &&
        Array.isArray(steps) && steps.every(s => isValidStep(s, subdivision as number)) &&
        // Optional fields reach the audio engine too (e.g. recommendedTempo becomes the tempo).
        isOptionalNumberIn(v.recommendedTempo, MIN_BPM, MAX_BPM) &&
        isOptionalNumberIn(v.swingBase, 0, 1) &&
        (v.grooveType === undefined || (typeof v.grooveType === 'string' && GROOVE_TYPES.has(v.grooveType))) &&
        typeof v.countingMode === 'string' && COUNTING_MODES.has(v.countingMode);
};

export const isValidOverrides = (v: unknown): v is Record<string, RhythmPattern> =>
    isPlainObject(v) && Object.entries(v).every(([key, p]) => isValidPattern(p) && p.id === key);

/**
 * Keeps every stored pattern edit that is still valid and drops only the broken ones,
 * so a single incompatible entry (e.g. after an instrument is renamed) can't wipe the rest.
 */
export const sanitizeOverrides = (v: unknown): Record<string, RhythmPattern> | undefined => {
    if (!isPlainObject(v)) return undefined;
    const result: Record<string, RhythmPattern> = {};
    Object.entries(v).forEach(([key, p]) => {
        if (isValidPattern(p) && p.id === key) result[key] = p;
        else console.warn(`[metronomo] Ignoring an invalid saved edit for pattern "${key}".`);
    });
    return result;
};

/** Keeps `instruments` in sync with the instruments actually used by the steps. */
export const withUsedInstruments = (pattern: RhythmPattern): RhythmPattern => {
    const used = new Set<InstrumentType>(pattern.instruments);
    pattern.steps.forEach(s => used.add(s.instrument));
    return used.size === pattern.instruments.length ? pattern : { ...pattern, instruments: [...used] };
};
