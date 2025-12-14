
/**
 * Defines the types and data structures for Rhythm Patterns.
 * Includes presets for EMPA curriculum rhythms.
 *
 * (ES) Define los tipos y estructuras de datos para Patrones Rítmicos.
 * Incluye preajustes para ritmos del currículo de la EMPA.
 */

import { Drum, CircleDot, Triangle, Music, Zap, Hexagon, Circle, Disc } from 'lucide-react';

export type InstrumentType =
    'kick' | 'snare' | 'hihat' | 'ride' |
    'tom_high' | 'tom_low' | 'tom_floor' |
    'crash' |
    'bombo_leguero' |
    'click' | 'shaker' | 'clave' | 'rim' | 'surdo';

// Map of Icons
export const InstrumentIcons: Record<InstrumentType, any> = {
    kick: CircleDot,
    snare: Drum,
    hihat: Triangle,
    ride: Disc,
    tom_high: Circle,
    tom_low: Circle,
    tom_floor: Circle,
    crash: Hexagon,
    bombo_leguero: Drum,
    click: Circle,
    shaker: Zap,
    clave: Music,
    rim: CircleDot,
    surdo: CircleDot
};

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
    grooveType?: 'straight' | 'swing_triplet' | 'samba_carioca' | 'chacarera_poliritmica';
    countingMode: 'numbers' | '1e&a' | '1&2&' | 'triplet_1la2la' | 'mnemonics_chacarera';
    recommendedTempo?: number;
}

export const PRESET_PATTERNS: RhythmPattern[] = [
    {
        id: 'rock_basic',
        name: 'Rock Estándar',
        description: 'Basic 4/4 Rock beat. Straight groove.',
        timeSignature: [4, 4],
        subdivision: 8,
        instruments: ['kick', 'snare', 'hihat'],
        grooveType: 'straight',
        countingMode: '1&2&',
        steps: [
            { step: 1, instrument: 'kick', velocity: 1.0 },
            { step: 1, instrument: 'hihat', velocity: 0.7, modifier: 'closed' },
            { step: 2, instrument: 'hihat', velocity: 0.7, modifier: 'closed' },
            { step: 3, instrument: 'snare', velocity: 1.0 },
            { step: 3, instrument: 'hihat', velocity: 0.7, modifier: 'closed' },
            { step: 4, instrument: 'hihat', velocity: 0.7, modifier: 'closed' },
            { step: 5, instrument: 'kick', velocity: 0.9 },
            { step: 5, instrument: 'hihat', velocity: 0.7, modifier: 'closed' },
            { step: 6, instrument: 'hihat', velocity: 0.7, modifier: 'closed' },
            { step: 7, instrument: 'snare', velocity: 1.0 },
            { step: 7, instrument: 'hihat', velocity: 0.7, modifier: 'closed' },
            { step: 8, instrument: 'hihat', velocity: 0.7, modifier: 'closed' },
        ]
    },
    {
        id: 'blues_shuffle',
        name: 'Blues Shuffle',
        description: 'Classic shuffle feel. Triplets.',
        timeSignature: [4, 4],
        subdivision: 12, // Triplets
        instruments: ['kick', 'snare', 'ride', 'hihat'],
        grooveType: 'straight', // Grid is already triplet
        countingMode: 'triplet_1la2la',
        steps: [
            // Beat 1
            { step: 1, instrument: 'kick', velocity: 1.0 },
            { step: 1, instrument: 'ride', velocity: 0.8 },
            { step: 3, instrument: 'ride', velocity: 0.6 },
            { step: 3, instrument: 'hihat', velocity: 0.4, modifier: 'closed' }, // Pedal

            // Beat 2
            { step: 4, instrument: 'ride', velocity: 0.8 },
            { step: 4, instrument: 'snare', velocity: 0.9 },
            { step: 6, instrument: 'ride', velocity: 0.6 },

            // Beat 3
            { step: 7, instrument: 'kick', velocity: 0.9 },
            { step: 7, instrument: 'ride', velocity: 0.8 },
            { step: 9, instrument: 'ride', velocity: 0.6 },
            { step: 9, instrument: 'hihat', velocity: 0.4, modifier: 'closed' },

            // Beat 4
            { step: 10, instrument: 'ride', velocity: 0.8 },
            { step: 10, instrument: 'snare', velocity: 1.0 },
            { step: 11, instrument: 'kick', velocity: 0.6 }, // Ghost kick
            { step: 12, instrument: 'ride', velocity: 0.6 },
        ]
    },
    {
        id: 'samba',
        name: 'Samba Brasilera',
        description: 'Batucada style. Fast 2/4.',
        timeSignature: [2, 4],
        subdivision: 8, // 16ths in 2/4 = 8 steps
        instruments: ['surdo', 'snare', 'shaker'],
        grooveType: 'samba_carioca',
        countingMode: '1e&a',
        steps: [
            // Beat 1
            { step: 1, instrument: 'surdo', velocity: 1.0 }, // Surdo 1
            { step: 1, instrument: 'shaker', velocity: 0.6 },
            { step: 2, instrument: 'shaker', velocity: 0.4 },
            { step: 3, instrument: 'shaker', velocity: 0.6 },
            { step: 4, instrument: 'shaker', velocity: 0.4 },
            { step: 4, instrument: 'snare', velocity: 0.5 }, // Ghost

            // Beat 2
            { step: 5, instrument: 'surdo', velocity: 0.8 }, // Surdo 2 (Light)
            { step: 5, instrument: 'shaker', velocity: 0.6 },
            { step: 6, instrument: 'shaker', velocity: 0.4 },
            { step: 7, instrument: 'surdo', velocity: 1.0 }, // Surdo 1 (Accent)
            { step: 7, instrument: 'shaker', velocity: 0.6 },
            { step: 8, instrument: 'shaker', velocity: 0.4 },
            { step: 8, instrument: 'snare', velocity: 0.9 }, // Caixa accent
        ]
    },
    {
        id: 'chacarera',
        name: 'Chacarera',
        description: 'Folklore Argentino. 6/8 Polirítmico.',
        timeSignature: [3, 4], // Viewed as 3/4 or 6/8
        subdivision: 6, // 8ths
        instruments: ['bombo_leguero', 'rim'],
        grooveType: 'chacarera_poliritmica',
        countingMode: 'mnemonics_chacarera',
        steps: [
            // "MA - de - RA" (3/4) vs "UN - dos - TRES" (6/8)
            // 1 (Parche), 2 (Aro), 3 (Parche), 4 (Aro), 5 (Parche), 6 (Aro) - Basic
            // Chacarera: Clasic 3/4 feel on 6/8

            // 1: Accent (Parche)
            { step: 1, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' },

            // 2: (Aro)
            { step: 2, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },

            // 3: (Parche - Low)
            { step: 3, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' },

            // 4: (Aro)
            { step: 4, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },

            // 5: (Parche - Low)
            { step: 5, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' },

            // 6: (Aro)
            { step: 6, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
        ]
    },
    {
        id: 'metronome_4_4',
        name: 'Metronome (4/4)',
        description: 'Standard Click.',
        timeSignature: [4, 4],
        subdivision: 4,
        instruments: ['click'],
        grooveType: 'straight',
        countingMode: 'numbers',
        steps: [
            { step: 1, instrument: 'click', velocity: 1.0 },
            { step: 2, instrument: 'click', velocity: 0.5 },
            { step: 3, instrument: 'click', velocity: 0.5 },
            { step: 4, instrument: 'click', velocity: 0.5 },
        ]
    }
];


