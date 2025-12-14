/**
 * Defines the types and data structures for Rhythm Patterns.
 * Includes presets for EMPA curriculum rhythms.
 *
 * (ES) Define los tipos y estructuras de datos para Patrones Rítmicos.
 * Incluye preajustes para ritmos del currículo de la EMPA.
 */

export type InstrumentType = 'kick' | 'snare' | 'hihat_closed' | 'hihat_open' | 'bombo_parche' | 'bombo_aro' | 'click';

export interface RhythmStep {
    step: number; // 1-indexed step in the grid (e.g., 1 to 16)
    instrument: InstrumentType;
    velocity: number; // 0.0 to 1.0
}

export interface RhythmPattern {
    id: string;
    name: string;
    description: string;
    timeSignature: [number, number]; // [numerator, denominator] e.g., [4, 4] or [6, 8]
    subdivision: number; // How many steps per measure? (e.g., 16 for 4/4 sixteenths, 12 for 6/8 eighths)
    instruments: InstrumentType[]; // List of available instruments for this pattern
    steps: RhythmStep[];
}

export const PRESET_PATTERNS: RhythmPattern[] = [
    {
        id: 'rock_basic',
        name: 'Rock Basic',
        description: 'Basic 4/4 Rock beat. (ES) Ritmo básico de Rock.',
        timeSignature: [4, 4],
        subdivision: 16,
        instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open'],
        steps: [
            { step: 1, instrument: 'kick', velocity: 1.0 },       // Accent
            { step: 1, instrument: 'hihat_closed', velocity: 0.7 },
            { step: 3, instrument: 'hihat_closed', velocity: 0.5 },
            { step: 5, instrument: 'snare', velocity: 0.9 },      // Backbeat
            { step: 5, instrument: 'hihat_closed', velocity: 0.7 },
            { step: 7, instrument: 'hihat_closed', velocity: 0.5 },
            { step: 9, instrument: 'kick', velocity: 0.9 },
            { step: 9, instrument: 'hihat_closed', velocity: 0.7 },
            { step: 11, instrument: 'hihat_closed', velocity: 0.5 },
            { step: 13, instrument: 'snare', velocity: 0.9 },
            { step: 13, instrument: 'hihat_closed', velocity: 0.7 },
            { step: 15, instrument: 'hihat_closed', velocity: 0.5 },
        ]
    },
    {
        id: 'chacarera',
        name: 'Chacarera (Folk)',
        description: 'Traditional Argentine rhythm. (ES) Ritmo tradicional argentino (6/8 polyrhythm).',
        timeSignature: [3, 4], // Notation 3/4 but felt 6/8
        subdivision: 6, // 6 steps (eighth notes) for 6/8 feel
        instruments: ['bombo_parche', 'bombo_aro'],
        steps: [
            // "Chas-chas-PUM-chas-PUM"
            { step: 1, instrument: 'bombo_aro', velocity: 1.0 },
            { step: 3, instrument: 'bombo_parche', velocity: 1.0 },
            { step: 4, instrument: 'bombo_aro', velocity: 0.7 },
            { step: 5, instrument: 'bombo_parche', velocity: 1.0 },
        ]
    },
    {
        id: 'blues_shuffle',
        name: 'Blues Shuffle (12/8)',
        description: 'Classic Shuffle feel using triplets. (ES) Shuffle clásico en tresillos.',
        timeSignature: [4, 4],
        subdivision: 12, // Triplets
        instruments: ['kick', 'snare', 'hihat_closed'],
        steps: [
            // Kick on 1
            { step: 1, instrument: 'kick', velocity: 0.9 },
            { step: 1, instrument: 'hihat_closed', velocity: 0.8 },
            { step: 3, instrument: 'hihat_closed', velocity: 0.5 }, // Shuffle skip
            // Snare on 2 (Step 4 in 12-grid)
            { step: 4, instrument: 'snare', velocity: 0.9 },
            { step: 4, instrument: 'hihat_closed', velocity: 0.8 },
            { step: 6, instrument: 'hihat_closed', velocity: 0.5 },
            // Kick on 3 (Step 7)
            { step: 7, instrument: 'kick', velocity: 0.9 },
            { step: 7, instrument: 'hihat_closed', velocity: 0.8 },
            { step: 9, instrument: 'hihat_closed', velocity: 0.5 },
            // Snare on 4 (Step 10)
            { step: 10, instrument: 'snare', velocity: 0.9 },
            { step: 10, instrument: 'hihat_closed', velocity: 0.8 },
            { step: 12, instrument: 'hihat_closed', velocity: 0.5 },
        ]
    },
    {
        id: 'jazz_swing',
        name: 'Jazz Swing',
        description: 'Spang-a-lang ride pattern. (ES) Patrón de Swing clásico.',
        timeSignature: [4, 4],
        subdivision: 12, // Triplets
        instruments: ['hihat_open', 'hihat_closed'],
        steps: [
            // Beat 1: Ride (1), HiHat Foot on 2 and 4?
            // "Spang-a-lang" = 1, 2-a, 3, 4-a
            // Steps: 1, 3(skip), 4, 6, 7, 9(skip), 10, 12

            // Beat 1
            { step: 1, instrument: 'hihat_open', velocity: 0.8 }, // Ride sim (using open HH for now)
            // Beat 2
            { step: 4, instrument: 'hihat_open', velocity: 0.8 },
            { step: 4, instrument: 'hihat_closed', velocity: 0.6 }, // Foot HiHat on 2 (Chick)
            { step: 6, instrument: 'hihat_open', velocity: 0.6 }, // The "Lang"
            // Beat 3
            { step: 7, instrument: 'hihat_open', velocity: 0.8 },
            // Beat 4
            { step: 10, instrument: 'hihat_open', velocity: 0.8 },
            { step: 10, instrument: 'hihat_closed', velocity: 0.6 }, // Foot HiHat on 4
            { step: 12, instrument: 'hihat_open', velocity: 0.6 },
        ]
    },
    {
        id: 'metronome_4_4',
        name: 'Metronome (4/4)',
        description: 'Standard Click. (ES) Click estándar.',
        timeSignature: [4, 4],
        subdivision: 4, // Quarter notes
        instruments: ['click'],
        steps: [
            { step: 1, instrument: 'click', velocity: 1.0 }, // Accent
            { step: 2, instrument: 'click', velocity: 0.5 },
            { step: 3, instrument: 'click', velocity: 0.5 },
            { step: 4, instrument: 'click', velocity: 0.5 },
        ]
    }
];


