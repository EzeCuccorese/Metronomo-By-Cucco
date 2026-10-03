import { describe, it, expect } from 'vitest';
import { PRESET_PATTERNS } from '../RhythmPatterns';
import { PRESET_PATTERN_ORDER } from './index';
import { ROCK_PATTERNS } from './rock';
import { BRAZILIAN_PATTERNS } from './brazilian';
import { ARGENTINE_FOLKLORE_PATTERNS } from './argentineFolklore';
import { ANDEAN_PATTERNS } from './andean';
import { LATIN_CARIBBEAN_PATTERNS } from './latinCaribbean';
import { METRONOME_PATTERNS } from './metronome';

const EXPECTED_IDS = [
    'rock_basic', 'blues_shuffle', 'samba', 'chacarera', 'chacarera_trunca', 'zamba', 'gato',
    'chamame', 'salsa_clave_3_2', 'cumbia', 'salsa_clave_2_3', 'milonga_pampeana', 'bossa_nova',
    'malambo', 'vidala', 'chaya', 'candombe', 'huayno', 'tresDosTres', 'metronome_4_4',
];

describe('preset pattern aggregation', () => {
    it('exposes the presets in the established UI order', () => {
        expect(PRESET_PATTERNS).toHaveLength(20);
        expect(PRESET_PATTERNS.map((p) => p.id)).toEqual(EXPECTED_IDS);
        expect([...PRESET_PATTERN_ORDER]).toEqual(EXPECTED_IDS);
    });

    it('is built from every genre file exactly once', () => {
        const genres = [
            ROCK_PATTERNS, BRAZILIAN_PATTERNS, ARGENTINE_FOLKLORE_PATTERNS,
            ANDEAN_PATTERNS, LATIN_CARIBBEAN_PATTERNS, METRONOME_PATTERNS,
        ];
        const ids = genres.flat().map((p) => p.id);
        expect(ids).toHaveLength(EXPECTED_IDS.length);
        expect([...ids].sort()).toEqual([...EXPECTED_IDS].sort());
    });
});
