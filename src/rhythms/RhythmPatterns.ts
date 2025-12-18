
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
    'click' | 'shaker' | 'clave' | 'rim' | 'surdo' | 'hihat_foot';

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
    surdo: CircleDot,
    hihat_foot: Triangle
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
    grooveType?: 'straight' | 'swing_triplet' | 'samba_carioca' | 'chacarera_poliritmica' | 'zamba_tradicional';
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
        timeSignature: [6, 8],
        subdivision: 12, // 16ths in 6/8 to allow for fills
        instruments: ['bombo_leguero', 'rim'],
        grooveType: 'chacarera_poliritmica',
        countingMode: 'mnemonics_chacarera',
        steps: [
            // PARCHE (KICK): Beats 1 and "3" of the 3/4 feel (which is step 9 in 6/8)
            { step: 1, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' },
            { step: 9, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' },
            { step: 11, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'parche' }, // Driving ghost

            // ARO (RIM): "CHA-ca-cha-CA-ca-cha"
            // (1), 3, 4, 6, 7, (9), 10, 12
            { step: 3, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'aro' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'aro' }, // Accent
            { step: 6, instrument: 'bombo_leguero', velocity: 0.6, modifier: 'aro' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
            { step: 10, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'aro' }, // Accent
            { step: 12, instrument: 'bombo_leguero', velocity: 0.6, modifier: 'aro' }
        ]
    },
    {
        id: 'zamba',
        name: 'Zamba',
        description: 'Romántico y pausado. 3/4 con aire de 6/8.',
        timeSignature: [3, 4],
        subdivision: 12,
        instruments: ['bombo_leguero', 'rim'],
        grooveType: 'zamba_tradicional',
        countingMode: 'numbers',
        steps: [
            // STEP 1: TIERRA (Deep Parche)
            { step: 1, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'parche' },

            // REPIQUE "ba-da-pám" (Semicorcheas antes del 3)
            // Steps 7, 8 (Aro) -> 9 (Parche fuerte)
            { step: 7, instrument: 'bombo_leguero', velocity: 0.5, modifier: 'aro' }, // ba
            { step: 8, instrument: 'bombo_leguero', velocity: 0.6, modifier: 'aro' }, // da

            // STEP 3 (Step 9 in 12-grid): The "PÁM" (Strong Parche)
            { step: 9, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' },

            // ARO DE RELLENO
            { step: 5, instrument: 'bombo_leguero', velocity: 0.4, modifier: 'aro' },
            { step: 11, instrument: 'bombo_leguero', velocity: 0.4, modifier: 'aro' },
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


