import type { RhythmPattern } from '../types';
import { ROCK_PATTERNS } from './rock';
import { BRAZILIAN_PATTERNS } from './brazilian';
import { ARGENTINE_FOLKLORE_PATTERNS } from './argentineFolklore';
import { ANDEAN_PATTERNS } from './andean';
import { LATIN_CARIBBEAN_PATTERNS } from './latinCaribbean';
import { METRONOME_PATTERNS } from './metronome';

/**
 * Display order of the presets. The UI lists presets in this order, which interleaves genres,
 * so it is declared explicitly instead of following the per-genre files.
 */
export const PRESET_PATTERN_ORDER = [
    'rock_basic',
    'blues_shuffle',
    'samba',
    'chacarera',
    'chacarera_trunca',
    'zamba',
    'gato',
    'chamame',
    'salsa_clave_3_2',
    'cumbia',
    'salsa_clave_2_3',
    'milonga_pampeana',
    'bossa_nova',
    'malambo',
    'vidala',
    'chaya',
    'candombe',
    'huayno',
    'tresDosTres',
    'metronome_4_4',
] as const;

const BY_ID = new Map<string, RhythmPattern>(
    [
        ...ROCK_PATTERNS,
        ...BRAZILIAN_PATTERNS,
        ...ARGENTINE_FOLKLORE_PATTERNS,
        ...ANDEAN_PATTERNS,
        ...LATIN_CARIBBEAN_PATTERNS,
        ...METRONOME_PATTERNS
    ].map((p) => [p.id, p]),
);

export const PRESET_PATTERNS: RhythmPattern[] = PRESET_PATTERN_ORDER.map((id) => {
    const pattern = BY_ID.get(id);
    if (!pattern) throw new Error(`Missing preset pattern data for "${id}"`);
    return pattern;
});
