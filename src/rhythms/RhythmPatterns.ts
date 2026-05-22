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
    grooveType?: 'straight' | 'swing_triplet' | 'samba_carioca' | 'chacarera_poliritmica' | 'zamba_tradicional' | 'chamame_saltadito' | 'salsa_tumbao' | 'cumbia_colombiana';
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
        recommendedTempo: 120,
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
        grooveType: 'straight',
        countingMode: 'triplet_1la2la',
        recommendedTempo: 90,
        steps: [
            // Beat 1
            { step: 1, instrument: 'kick', velocity: 1.0 },
            { step: 1, instrument: 'ride', velocity: 0.8 },
            { step: 3, instrument: 'ride', velocity: 0.6 },
            { step: 3, instrument: 'hihat', velocity: 0.4, modifier: 'closed' },

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
            { step: 11, instrument: 'kick', velocity: 0.6 },
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
        recommendedTempo: 115,
        steps: [
            // SURDO: Pulso fuerte asentado en el tiempo 2 (Paso 5)
            { step: 1, instrument: 'surdo', velocity: 0.6, modifier: 'parche' }, // Amortiguado
            { step: 4, instrument: 'surdo', velocity: 0.4, modifier: 'parche' }, // Anticipación rápida
            { step: 5, instrument: 'surdo', velocity: 1.0, modifier: 'parche' }, // Abierto fuerte
            { step: 8, instrument: 'surdo', velocity: 0.5, modifier: 'parche' }, // Relleno suave

            // SHAKER: Bouncing shuffle brasilero con acentos en el contratiempo
            { step: 1, instrument: 'shaker', velocity: 0.5 },
            { step: 2, instrument: 'shaker', velocity: 0.8 },
            { step: 3, instrument: 'shaker', velocity: 0.5 },
            { step: 4, instrument: 'shaker', velocity: 0.8 },
            { step: 5, instrument: 'shaker', velocity: 0.5 },
            { step: 6, instrument: 'shaker', velocity: 0.8 },
            { step: 7, instrument: 'shaker', velocity: 0.5 },
            { step: 8, instrument: 'shaker', velocity: 0.8 },

            // TAMBORIM / CAIXA: Telecoteco clásico sincopado en 2/4
            { step: 2, instrument: 'snare', velocity: 0.7 },
            { step: 3, instrument: 'snare', velocity: 0.8 },
            { step: 5, instrument: 'snare', velocity: 0.9 }, // Acento de tiempo 2
            { step: 6, instrument: 'snare', velocity: 0.7 },
            { step: 8, instrument: 'snare', velocity: 0.9 }
        ]
    },
    {
        id: 'chacarera',
        name: 'Chacarera',
        description: 'Folklore Argentino. 6/8 Polirítmico (Hemiola).',
        timeSignature: [6, 8],
        subdivision: 12, // 16ths in 6/8 to allow for fills
        instruments: ['bombo_leguero', 'rim'],
        grooveType: 'chacarera_poliritmica',
        countingMode: 'mnemonics_chacarera',
        recommendedTempo: 140,
        steps: [
            // PARCHE (modifier: 'parche'): Tierra tradicional en 5, 9 (hemiola)
            { step: 5, instrument: 'bombo_leguero', velocity: 0.95, modifier: 'parche' },
            { step: 9, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' }, // Acento fuerte

            // ARO (modifier: 'aro'): Comienza estrictamente en Aro en paso 1
            { step: 1, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'aro' },
            { step: 3, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'aro' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
            { step: 10, instrument: 'bombo_leguero', velocity: 0.75, modifier: 'aro' },
            { step: 12, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'aro' }
        ]
    },
    {
        id: 'chacarera_trunca',
        name: 'Chacarera Trunca',
        description: 'Folklore de Santiago del Estero. Primer tiempo libre, resolviendo con acento en el paso 11.',
        timeSignature: [6, 8],
        subdivision: 12,
        instruments: ['bombo_leguero', 'rim'],
        grooveType: 'chacarera_poliritmica',
        countingMode: 'mnemonics_chacarera',
        recommendedTempo: 135,
        steps: [
            // PARCHE (modifier: 'parche'): Primer tiempo libre, síncopa trunca en el 11
            { step: 5, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'parche' },
            { step: 11, instrument: 'bombo_leguero', velocity: 1.1, modifier: 'parche' }, // Heavy Trunca Accent!

            // ARO (modifier: 'aro'): Comienza estrictamente en Aro en paso 1
            { step: 1, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'aro' },
            { step: 3, instrument: 'bombo_leguero', velocity: 0.75, modifier: 'aro' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.75, modifier: 'aro' },
            { step: 8, instrument: 'bombo_leguero', velocity: 0.55, modifier: 'aro' },
            { step: 10, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
            { step: 12, instrument: 'bombo_leguero', velocity: 0.65, modifier: 'aro' }
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
        recommendedTempo: 65,
        steps: [
            // PARCHE (modifier: 'parche'): Tierra en 1 y la cadencia majestuosa "dum-dum" en 9 y 11
            { step: 1, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'parche' },
            { step: 9, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' }, // El gran "PÁM"
            { step: 11, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'parche' },

            // ARO (modifier: 'aro'): Estructura madera suave de acompañamiento
            { step: 5, instrument: 'bombo_leguero', velocity: 0.6, modifier: 'aro' },
            { step: 6, instrument: 'bombo_leguero', velocity: 0.55, modifier: 'aro' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.6, modifier: 'aro' }
        ]
    },
    {
        id: 'chamame',
        name: 'Chamamé',
        description: 'Folklore del Litoral. 6/8 saltadito con acento corrido.',
        timeSignature: [6, 8],
        subdivision: 12,
        instruments: ['bombo_leguero', 'rim'],
        grooveType: 'chamame_saltadito',
        countingMode: 'numbers',
        recommendedTempo: 120,
        steps: [
            // PARCHE (modifier: 'parche'): Galope chamamesero de tierra y acentos corridos
            { step: 1, instrument: 'bombo_leguero', velocity: 0.75, modifier: 'parche' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' }, // Acentuado
            { step: 7, instrument: 'bombo_leguero', velocity: 0.65, modifier: 'parche' },
            { step: 11, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' }, // Acentuado fuerte

            // ARO (modifier: 'aro'): Apoyaturas ("saltadito") suaves y balanceadas
            { step: 3, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'aro' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.45, modifier: 'aro' }, // Apoyatura suave
            { step: 9, instrument: 'bombo_leguero', velocity: 0.75, modifier: 'aro' },
            { step: 10, instrument: 'bombo_leguero', velocity: 0.45, modifier: 'aro' }  // Apoyatura suave
        ]
    },
    {
        id: 'salsa_clave_3_2',
        name: 'Salsa Clave 3-2',
        description: 'Ritmo Latino. Clave de Son 3-2, Cascara y base de Congas.',
        timeSignature: [4, 4],
        subdivision: 16,
        instruments: ['clave', 'ride', 'snare', 'tom_high', 'tom_low'],
        grooveType: 'salsa_tumbao',
        countingMode: '1e&a',
        recommendedTempo: 180,
        steps: [
            // CLAVE DE SON 3-2
            { step: 1, instrument: 'clave', velocity: 1.0 },
            { step: 4, instrument: 'clave', velocity: 0.9 },
            { step: 7, instrument: 'clave', velocity: 0.9 },
            { step: 11, instrument: 'clave', velocity: 0.9 },
            { step: 13, instrument: 'clave', velocity: 1.0 },

            // CASCARA / SHAKER (Base de campana en el Ride)
            { step: 1, instrument: 'ride', velocity: 0.65 },
            { step: 3, instrument: 'ride', velocity: 0.5 },
            { step: 5, instrument: 'ride', velocity: 0.65 },
            { step: 7, instrument: 'ride', velocity: 0.5 },
            { step: 9, instrument: 'ride', velocity: 0.65 },
            { step: 11, instrument: 'ride', velocity: 0.5 },
            { step: 13, instrument: 'ride', velocity: 0.65 },
            { step: 15, instrument: 'ride', velocity: 0.5 },

            // CONGAS: Tumbao académico estricto (slaps en 2 y 4 [pasos 5 y 13], open tones en 7, 8, 15, 16)
            { step: 5, instrument: 'snare', velocity: 0.85, modifier: 'snares_off' }, // Slap 1 (Tiempo 2)
            { step: 7, instrument: 'tom_high', velocity: 0.8 },                      // Open High 1
            { step: 8, instrument: 'tom_high', velocity: 0.8 },                      // Open High 2
            { step: 13, instrument: 'snare', velocity: 0.85, modifier: 'snares_off' }, // Slap 2 (Tiempo 4)
            { step: 15, instrument: 'tom_low', velocity: 0.85 },                     // Open Low 1
            { step: 16, instrument: 'tom_low', velocity: 0.85 },                     // Open Low 2
        ]
    },
    {
        id: 'cumbia',
        name: 'Cumbia',
        description: 'Base Colombiana. Shaker saltado, Llamador y Tambora profunda.',
        timeSignature: [4, 4],
        subdivision: 16,
        instruments: ['shaker', 'surdo', 'snare', 'rim'],
        grooveType: 'cumbia_colombiana',
        countingMode: '1e&a',
        recommendedTempo: 96,
        steps: [
            // GUACHE / SHAKER: Bouncing shuffle feel con acento a contratiempo
            { step: 1, instrument: 'shaker', velocity: 0.5 },
            { step: 2, instrument: 'shaker', velocity: 0.8 },
            { step: 3, instrument: 'shaker', velocity: 0.5 },
            { step: 4, instrument: 'shaker', velocity: 0.8 },
            { step: 5, instrument: 'shaker', velocity: 0.5 },
            { step: 6, instrument: 'shaker', velocity: 0.8 },
            { step: 7, instrument: 'shaker', velocity: 0.5 },
            { step: 8, instrument: 'shaker', velocity: 0.8 },
            { step: 9, instrument: 'shaker', velocity: 0.5 },
            { step: 10, instrument: 'shaker', velocity: 0.8 },
            { step: 11, instrument: 'shaker', velocity: 0.5 },
            { step: 12, instrument: 'shaker', velocity: 0.8 },
            { step: 13, instrument: 'shaker', velocity: 0.5 },
            { step: 14, instrument: 'shaker', velocity: 0.8 },
            { step: 15, instrument: 'shaker', velocity: 0.5 },
            { step: 16, instrument: 'shaker', velocity: 0.8 },

            // LLAMADOR: strictly on beats 2 and 4 (contratiempo de la cumbia)
            { step: 5, instrument: 'snare', velocity: 0.95, modifier: 'snares_off' }, // Seco y apagado
            { step: 13, instrument: 'snare', velocity: 0.95, modifier: 'snares_off' },

            // TAMBORA: Golpe de parche profundo (Surdo)
            { step: 1, instrument: 'surdo', velocity: 1.0 },
            { step: 7, instrument: 'surdo', velocity: 0.7 },
            { step: 9, instrument: 'surdo', velocity: 0.9 },
            { step: 15, instrument: 'surdo', velocity: 0.7 },

            // ALEGRE / ARO: Madera repicadora
            { step: 3, instrument: 'rim', velocity: 0.75 },
            { step: 4, instrument: 'rim', velocity: 0.6 },
            { step: 8, instrument: 'rim', velocity: 0.65 },
            { step: 11, instrument: 'rim', velocity: 0.75 },
            { step: 12, instrument: 'rim', velocity: 0.6 },
            { step: 16, instrument: 'rim', velocity: 0.85 },
        ]
    },
    {
        id: 'salsa_clave_2_3',
        name: 'Salsa Clave 2-3',
        description: 'Ritmo Latino. Clave de Son 2-3, Cascara y base de Congas.',
        timeSignature: [4, 4],
        subdivision: 16,
        instruments: ['clave', 'ride', 'snare', 'tom_high', 'tom_low'],
        grooveType: 'salsa_tumbao',
        countingMode: '1e&a',
        recommendedTempo: 180,
        steps: [
            // CLAVE DE SON 2-3
            { step: 3, instrument: 'clave', velocity: 0.9 },
            { step: 5, instrument: 'clave', velocity: 1.0 },
            { step: 9, instrument: 'clave', velocity: 0.9 },
            { step: 12, instrument: 'clave', velocity: 0.9 },
            { step: 15, instrument: 'clave', velocity: 1.0 },

            // CASCARA / SHAKER
            { step: 1, instrument: 'ride', velocity: 0.65 },
            { step: 3, instrument: 'ride', velocity: 0.5 },
            { step: 5, instrument: 'ride', velocity: 0.65 },
            { step: 7, instrument: 'ride', velocity: 0.5 },
            { step: 9, instrument: 'ride', velocity: 0.65 },
            { step: 11, instrument: 'ride', velocity: 0.5 },
            { step: 13, instrument: 'ride', velocity: 0.65 },
            { step: 15, instrument: 'ride', velocity: 0.5 },

            // CONGAS: Tumbao académico estricto
            { step: 5, instrument: 'snare', velocity: 0.85, modifier: 'snares_off' }, // Slap 1
            { step: 7, instrument: 'tom_high', velocity: 0.8 },                      // Open High 1
            { step: 8, instrument: 'tom_high', velocity: 0.8 },                      // Open High 2
            { step: 13, instrument: 'snare', velocity: 0.85, modifier: 'snares_off' }, // Slap 2
            { step: 15, instrument: 'tom_low', velocity: 0.85 },                     // Open Low 1
            { step: 16, instrument: 'tom_low', velocity: 0.85 },                     // Open Low 2
        ]
    },
    {
        id: 'milonga_pampeana',
        name: 'Milonga Pampeana',
        description: 'Folklore Rioplatense. Síncopa campera tradicional 3-3-2 en bombo legüero.',
        timeSignature: [2, 4],
        subdivision: 8,
        instruments: ['bombo_leguero', 'rim'],
        grooveType: 'straight',
        countingMode: '1e&a',
        recommendedTempo: 90,
        steps: [
            // PARCHE: Golpes a tierra y acento de balanceo
            { step: 1, instrument: 'bombo_leguero', velocity: 0.95, modifier: 'parche' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'parche' },

            // ARO: Síncopas agudas
            { step: 4, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' }
        ]
    },
    {
        id: 'bossa_nova',
        name: 'Bossa Nova',
        description: 'Ritmo Brasilero. Clave de Bossa en Aro, síncopa de Surdo y base de Hi-Hat.',
        timeSignature: [4, 4],
        subdivision: 16,
        instruments: ['kick', 'rim', 'hihat'],
        grooveType: 'swing_triplet',
        swingBase: 0.08,
        countingMode: '1e&a',
        recommendedTempo: 130,
        steps: [
            // HI-HAT: 8vos continuos y fluidos
            { step: 1, instrument: 'hihat', velocity: 0.5, modifier: 'closed' },
            { step: 3, instrument: 'hihat', velocity: 0.35, modifier: 'closed' },
            { step: 5, instrument: 'hihat', velocity: 0.5, modifier: 'closed' },
            { step: 7, instrument: 'hihat', velocity: 0.35, modifier: 'closed' },
            { step: 9, instrument: 'hihat', velocity: 0.5, modifier: 'closed' },
            { step: 11, instrument: 'hihat', velocity: 0.35, modifier: 'closed' },
            { step: 13, instrument: 'hihat', velocity: 0.5, modifier: 'closed' },
            { step: 15, instrument: 'hihat', velocity: 0.35, modifier: 'closed' },

            // RIM / CLAVE DE BOSSA (aro suave de madera)
            { step: 1, instrument: 'rim', velocity: 0.85 },
            { step: 4, instrument: 'rim', velocity: 0.8 },
            { step: 7, instrument: 'rim', velocity: 0.8 },
            { step: 11, instrument: 'rim', velocity: 0.85 },
            { step: 14, instrument: 'rim', velocity: 0.8 },

            // SURDO / KICK (pulso sincopado)
            { step: 1, instrument: 'kick', velocity: 0.8 },
            { step: 8, instrument: 'kick', velocity: 0.6 },
            { step: 9, instrument: 'kick', velocity: 0.8 },
            { step: 16, instrument: 'kick', velocity: 0.6 }
        ]
    },
    {
        id: 'malambo',
        name: 'Malambo',
        description: 'Folklore Argentino. Mudanza de zapateo hiper-veloz y virtuosa en 6/8.',
        timeSignature: [6, 8],
        subdivision: 12,
        instruments: ['bombo_leguero', 'rim'],
        grooveType: 'chacarera_poliritmica',
        countingMode: 'numbers',
        recommendedTempo: 165,
        steps: [
            // PARCHE: golpes del galope y zapateo
            { step: 1, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.75, modifier: 'parche' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'parche' },
            { step: 9, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' },
            { step: 12, instrument: 'bombo_leguero', velocity: 0.75, modifier: 'parche' },

            // ARO: marcaciones agudas y dinámicas
            { step: 3, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
            { step: 10, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' }
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
        recommendedTempo: 120,
        steps: [
            { step: 1, instrument: 'click', velocity: 1.0 },
            { step: 2, instrument: 'click', velocity: 0.5 },
            { step: 3, instrument: 'click', velocity: 0.5 },
            { step: 4, instrument: 'click', velocity: 0.5 },
        ]
    }
];

