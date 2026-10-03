/**
 * Defines the types and data structures for Rhythm Patterns.
 * Includes presets for EMPA curriculum rhythms.
 *
 * (ES) Define los tipos y estructuras de datos para Patrones Rítmicos.
 * Incluye preajustes para ritmos del currículo de la EMPA.
 */

export type InstrumentType =
    'kick' | 'snare' | 'hihat' | 'ride' |
    'tom_high' | 'tom_low' | 'tom_floor' |
    'crash' |
    'bombo_leguero' |
    'click' | 'shaker' | 'clave' | 'rim' | 'surdo' | 'hihat_foot' |
    'caja' | 'cajon' | 'palmas' | 'candombe_chico' | 'candombe_repique' | 'candombe_piano';

export interface RhythmStep {
    step: number; // 1-indexed step in the grid
    instrument: InstrumentType;
    velocity: number; // 0.0 to 1.0
    modifier?: 'open' | 'closed' | 'aro' | 'parche' | 'snares_off';
}

export interface RhythmPattern {
    id: string;
    name: string;
    description: string;
    timeSignature: [number, number];
    subdivision: number;
    instruments: InstrumentType[];
    steps: RhythmStep[];

    // --- NEW FIELDS ---
    swingBase?: number; // 0.0 to 1.0
    grooveType?: 'straight' | 'swing_triplet' | 'samba_carioca' | 'chacarera_poliritmica' | 'zamba_tradicional' | 'chamame_saltadito' | 'salsa_tumbao' | 'cumbia_colombiana';
    countingMode: 'numbers' | '1e&a' | '1&2&' | 'triplet_1la2la' | 'mnemonics_chacarera';
    recommendedTempo?: number;
    coverImage?: string;
}
