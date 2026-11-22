import type { RhythmPattern } from '../types';

/** Andean and Peruvian rhythms. */
export const ANDEAN_PATTERNS: RhythmPattern[] = [
    {
        id: 'vidala',
        name: 'Vidala',
        description: 'Folklore del Noroeste. 3/4 lento con respiración tradicional de caja coplera.',
        coverImage: '/genres/genre_milonga.webp',
        timeSignature: [3, 4],
        subdivision: 6,
        instruments: ['caja', 'bombo_leguero'],
        grooveType: 'straight',
        countingMode: 'numbers',
        recommendedTempo: 72,
        steps: [
            // CAJA COPLERA: respiración pausada en tiempos 1, 2 y 3
            { step: 1, instrument: 'caja', velocity: 0.95 },
            { step: 3, instrument: 'caja', velocity: 0.68, modifier: 'open' },
            { step: 5, instrument: 'caja', velocity: 0.9 },

            // BOMBO LEGÜERO: apoyo grave de tierra
            { step: 1, instrument: 'bombo_leguero', velocity: 0.6, modifier: 'parche' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'parche' }
        ]
    },
    {
        id: 'chaya',
        name: 'Chaya',
        description: 'La Rioja. Ritmo festivo en 3/4 con galope chayero claro en bombo y caja.',
        coverImage: '/genres/genre_chacarera.webp',
        timeSignature: [3, 4],
        subdivision: 12,
        instruments: ['bombo_leguero', 'caja'],
        grooveType: 'chacarera_poliritmica',
        countingMode: 'numbers',
        recommendedTempo: 108,
        steps: [
            // BOMBO PARCHE: pulso firme en los 3 tiempos
            { step: 1, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'parche' },
            { step: 9, instrument: 'bombo_leguero', velocity: 0.95, modifier: 'parche' },

            // CAJA COPLERA: galope chayero definido (tierra + aro en última semicorchea)
            { step: 1, instrument: 'caja', velocity: 0.9, modifier: 'parche' },
            { step: 4, instrument: 'caja', velocity: 0.72, modifier: 'open' },
            { step: 5, instrument: 'caja', velocity: 0.85, modifier: 'parche' },
            { step: 8, instrument: 'caja', velocity: 0.72, modifier: 'open' },
            { step: 9, instrument: 'caja', velocity: 0.92, modifier: 'parche' },
            { step: 12, instrument: 'caja', velocity: 0.78, modifier: 'open' }
        ]
    },
    {
        id: 'huayno',
        name: 'Huayno',
        description: 'Folklore Andino. 2/4 con el galope característico (corchea y dos semicorcheas).',
        coverImage: '/genres/genre_chacarera.webp',
        timeSignature: [2, 4],
        subdivision: 8,
        instruments: ['bombo_leguero', 'shaker', 'surdo'],
        grooveType: 'straight',
        countingMode: '1&2&',
        recommendedTempo: 96,
        steps: [
            // BOMBO: galope clásico (negra-corchea-semi / ♪ ♬)
            { step: 1, instrument: 'bombo_leguero', velocity: 0.95, modifier: 'parche' },
            { step: 3, instrument: 'bombo_leguero', velocity: 0.62, modifier: 'parche' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.75, modifier: 'parche' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.92, modifier: 'parche' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.62, modifier: 'parche' },
            { step: 8, instrument: 'bombo_leguero', velocity: 0.75, modifier: 'parche' },

            // SHAKER: chasquido del galope
            { step: 3, instrument: 'shaker', velocity: 0.82 },
            { step: 4, instrument: 'shaker', velocity: 0.62 },
            { step: 7, instrument: 'shaker', velocity: 0.82 },
            { step: 8, instrument: 'shaker', velocity: 0.62 },

            // SURDO: apoyo grave en los tiempos fuertes
            { step: 1, instrument: 'surdo', velocity: 0.8 },
            { step: 5, instrument: 'surdo', velocity: 0.85 }
        ]
    },
    {
        id: 'tresDosTres',
        name: '3-3-2',
        description: 'Clave rítmica 3-3-2 moderna sobre cajón peruano y shaker real.',
        coverImage: '/genres/genre_milonga.webp',
        timeSignature: [4, 4],
        subdivision: 16,
        instruments: ['cajon', 'shaker'],
        grooveType: 'straight',
        countingMode: '1e&a',
        recommendedTempo: 140,
        steps: [
            // CAJON: acentos 3-3-2 auténticos (graves en 1, 7, 9, 15 y slaps/aros en 4, 12)
            { step: 1, instrument: 'cajon', velocity: 1.0, modifier: 'parche' },
            { step: 4, instrument: 'cajon', velocity: 0.9, modifier: 'aro' }, // Slap
            { step: 7, instrument: 'cajon', velocity: 0.85, modifier: 'parche' },
            { step: 9, instrument: 'cajon', velocity: 0.95, modifier: 'parche' },
            { step: 12, instrument: 'cajon', velocity: 0.9, modifier: 'aro' }, // Slap
            { step: 15, instrument: 'cajon', velocity: 0.85, modifier: 'parche' },

            // SHAKER: Semicorcheas constantes fluidas
            { step: 1, instrument: 'shaker', velocity: 0.5 },
            { step: 2, instrument: 'shaker', velocity: 0.4 },
            { step: 3, instrument: 'shaker', velocity: 0.5 },
            { step: 4, instrument: 'shaker', velocity: 0.4 },
            { step: 5, instrument: 'shaker', velocity: 0.5 },
            { step: 6, instrument: 'shaker', velocity: 0.4 },
            { step: 7, instrument: 'shaker', velocity: 0.5 },
            { step: 8, instrument: 'shaker', velocity: 0.4 },
            { step: 9, instrument: 'shaker', velocity: 0.5 },
            { step: 10, instrument: 'shaker', velocity: 0.4 },
            { step: 11, instrument: 'shaker', velocity: 0.5 },
            { step: 12, instrument: 'shaker', velocity: 0.4 },
            { step: 13, instrument: 'shaker', velocity: 0.5 },
            { step: 14, instrument: 'shaker', velocity: 0.4 },
            { step: 15, instrument: 'shaker', velocity: 0.5 },
            { step: 16, instrument: 'shaker', velocity: 0.4 }
        ]
    }
];
