import type { RhythmPattern } from '../types';

/** Afro-Caribbean and Afro-Uruguayan rhythms. */
export const LATIN_CARIBBEAN_PATTERNS: RhythmPattern[] = [
    {
        id: 'salsa_clave_3_2',
        name: 'Salsa Clave 3-2',
        description: 'Ritmo Latino. Clave de Son 3-2, Cascara y base de Congas.',
        coverImage: '/genres/genre_salsa.webp',
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
        id: 'salsa_clave_2_3',
        name: 'Salsa Clave 2-3',
        description: 'Ritmo Latino. Clave de Son 2-3, Cascara y base de Congas.',
        coverImage: '/genres/genre_salsa.webp',
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
        id: 'cumbia',
        name: 'Cumbia',
        description: 'Base Colombiana. Shaker saltado, Llamador y Tambora profunda.',
        coverImage: '/genres/genre_cumbia.webp',
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
        id: 'candombe',
        name: 'Candombe',
        description: 'Folklore Rioplatense. Ensamble de Tambores: Clave, Chico, Repique y Piano.',
        coverImage: '/genres/genre_samba.webp',
        timeSignature: [4, 4],
        subdivision: 16,
        instruments: ['clave', 'candombe_chico', 'candombe_repique', 'candombe_piano'],
        grooveType: 'straight',
        countingMode: '1e&a',
        recommendedTempo: 110,
        steps: [
            // CLAVE: madera conductora (clave candombera 3-2)
            { step: 1, instrument: 'clave', velocity: 0.95 },
            { step: 4, instrument: 'clave', velocity: 0.9 },
            { step: 7, instrument: 'clave', velocity: 0.9 },
            { step: 11, instrument: 'clave', velocity: 0.9 },
            { step: 13, instrument: 'clave', velocity: 0.95 },

            // CHICO: base constante y metronómica
            { step: 2, instrument: 'candombe_chico', velocity: 0.8 },
            { step: 4, instrument: 'candombe_chico', velocity: 0.7 },
            { step: 6, instrument: 'candombe_chico', velocity: 0.8 },
            { step: 8, instrument: 'candombe_chico', velocity: 0.7 },
            { step: 10, instrument: 'candombe_chico', velocity: 0.8 },
            { step: 12, instrument: 'candombe_chico', velocity: 0.7 },
            { step: 14, instrument: 'candombe_chico', velocity: 0.8 },
            { step: 16, instrument: 'candombe_chico', velocity: 0.7 },

            // PIANO: el grave profundo sincopado
            { step: 1, instrument: 'candombe_piano', velocity: 0.95 },
            { step: 8, instrument: 'candombe_piano', velocity: 0.75 },
            { step: 9, instrument: 'candombe_piano', velocity: 0.9 },
            { step: 14, instrument: 'candombe_piano', velocity: 0.85 },

            // REPIQUE: repiqueteos y llamadas dinámicas
            { step: 1, instrument: 'candombe_repique', velocity: 0.7 },
            { step: 3, instrument: 'candombe_repique', velocity: 0.9 },
            { step: 5, instrument: 'candombe_repique', velocity: 0.7 },
            { step: 7, instrument: 'candombe_repique', velocity: 0.85 },
            { step: 9, instrument: 'candombe_repique', velocity: 0.7 },
            { step: 11, instrument: 'candombe_repique', velocity: 0.85 },
            { step: 13, instrument: 'candombe_repique', velocity: 0.7 },
            { step: 15, instrument: 'candombe_repique', velocity: 0.9 }
        ]
    }
];
