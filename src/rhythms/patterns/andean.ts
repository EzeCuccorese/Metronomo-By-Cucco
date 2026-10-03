import type { RhythmPattern } from '../types';

/** Andean and Peruvian rhythms. */
export const ANDEAN_PATTERNS: RhythmPattern[] = [
    {
        id: 'vidala',
        name: 'Vidala',
        description: 'Folklore del Noroeste. 3/4 lento con caja coplera real.',
        coverImage: '/genres/genre_milonga.webp',
        timeSignature: [3, 4],
        subdivision: 6,
        instruments: ['caja', 'bombo_leguero'],
        grooveType: 'straight',
        countingMode: 'numbers',
        recommendedTempo: 75,
        steps: [
            // CAJA PARCHE: pulso grave con resonancia profunda
            { step: 1, instrument: 'caja', velocity: 0.95 },
            { step: 5, instrument: 'caja', velocity: 0.9 },

            // CAJA ARO / APU: agudo de borde
            { step: 3, instrument: 'caja', velocity: 0.7, modifier: 'open' },
            { step: 6, instrument: 'caja', velocity: 0.6, modifier: 'open' },

            // BOMBO LEGUERO: acento de tierra de fondo
            { step: 1, instrument: 'bombo_leguero', velocity: 0.6, modifier: 'parche' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'parche' }
        ]
    },
    {
        id: 'chaya',
        name: 'Chaya',
        description: 'La Rioja. Ritmo festivo en 3/4 con el galope característico en bombo y caja.',
        coverImage: '/genres/genre_chacarera.webp',
        timeSignature: [3, 4],
        subdivision: 12,
        instruments: ['bombo_leguero', 'caja'],
        grooveType: 'chacarera_poliritmica',
        countingMode: 'numbers',
        recommendedTempo: 105,
        steps: [
            // BOMBO PARCHE: marcación profunda
            { step: 1, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'parche' },
            { step: 9, instrument: 'bombo_leguero', velocity: 0.95, modifier: 'parche' },

            // CAJA COPLERA: galope alegre riojano (chayerito) simétrico
            { step: 1, instrument: 'caja', velocity: 0.9, modifier: 'parche' },
            { step: 3, instrument: 'caja', velocity: 0.65, modifier: 'open' },
            { step: 4, instrument: 'caja', velocity: 0.75, modifier: 'open' },
            { step: 5, instrument: 'caja', velocity: 0.85, modifier: 'parche' },
            { step: 7, instrument: 'caja', velocity: 0.65, modifier: 'open' },
            { step: 8, instrument: 'caja', velocity: 0.75, modifier: 'open' },
            { step: 9, instrument: 'caja', velocity: 0.9, modifier: 'parche' },
            { step: 11, instrument: 'caja', velocity: 0.65, modifier: 'open' },
            { step: 12, instrument: 'caja', velocity: 0.8, modifier: 'open' }
        ]
    },
    {
        id: 'huayno',
        name: 'Huayno',
        description: 'Folklore Andino. 2/4 rápido con el galope saltado (salta-salta) tradicional.',
        coverImage: '/genres/genre_chacarera.webp',
        timeSignature: [2, 4],
        subdivision: 8,
        instruments: ['bombo_leguero', 'shaker', 'surdo'],
        grooveType: 'straight',
        countingMode: '1&2&',
        recommendedTempo: 80,
        steps: [
            // BOMBO: marcación en el parche del galope
            { step: 1, instrument: 'bombo_leguero', velocity: 0.95, modifier: 'parche' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'parche' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' },
            { step: 8, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'parche' },

            // SHAKER / CAXIXIS: el chasquido agudo del galope
            { step: 3, instrument: 'shaker', velocity: 0.85 },
            { step: 4, instrument: 'shaker', velocity: 0.65 },
            { step: 7, instrument: 'shaker', velocity: 0.85 },
            { step: 8, instrument: 'shaker', velocity: 0.65 },

            // TAMBOR / SURDO: golpe de apoyo en graves
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
