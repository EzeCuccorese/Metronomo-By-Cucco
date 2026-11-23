import type { RhythmPattern } from '../types';

/** Argentine folklore and rioplatense rhythms. */
export const ARGENTINE_FOLKLORE_PATTERNS: RhythmPattern[] = [
    {
        id: 'chacarera',
        name: 'Chacarera',
        description: 'Folklore Argentino. 6/8 Polirítmico (Hemiola) con Bombo Legüero y Palmas.',
        coverImage: '/genres/genre_chacarera.webp',
        timeSignature: [6, 8],
        subdivision: 12,
        instruments: ['bombo_leguero', 'palmas'],
        grooveType: 'chacarera_poliritmica',
        countingMode: 'mnemonics_chacarera',
        recommendedTempo: 138,
        steps: [
            // BOMBO LEGUERO: base santiagueña clásica en hemiola 6/8 + 3/4
            { step: 1, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.72, modifier: 'aro' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.92, modifier: 'parche' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
            { step: 9, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' },
            { step: 11, instrument: 'bombo_leguero', velocity: 0.65, modifier: 'aro' },

            // PALMAS: acompañamiento liviano en hemiola
            { step: 1, instrument: 'palmas', velocity: 0.45 },
            { step: 5, instrument: 'palmas', velocity: 0.45 },
            { step: 7, instrument: 'palmas', velocity: 0.45 },
            { step: 9, instrument: 'palmas', velocity: 0.55 },
        ]
    },
    {
        id: 'chacarera_trunca',
        name: 'Chacarera Trunca',
        description: 'Folklore de Santiago del Estero. Síncopa trunca resolviendo con acento en la 6ª corchea (paso 11).',
        coverImage: '/genres/genre_chacarera.webp',
        timeSignature: [6, 8],
        subdivision: 12,
        instruments: ['bombo_leguero', 'palmas'],
        grooveType: 'chacarera_trunca',
        countingMode: 'mnemonics_chacarera',
        recommendedTempo: 132,
        steps: [
            // BOMBO LEGUERO: cierre trunco fuerte en paso 11
            { step: 1, instrument: 'bombo_leguero', velocity: 0.82, modifier: 'aro' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'aro' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.88, modifier: 'parche' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.78, modifier: 'aro' },
            { step: 9, instrument: 'bombo_leguero', velocity: 0.72, modifier: 'aro' },
            { step: 11, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' },

            // PALMAS: acompañando la resolución trunca
            { step: 1, instrument: 'palmas', velocity: 0.42 },
            { step: 5, instrument: 'palmas', velocity: 0.42 },
            { step: 7, instrument: 'palmas', velocity: 0.42 },
            { step: 11, instrument: 'palmas', velocity: 0.58 },
        ]
    },
    {
        id: 'zamba',
        name: 'Zamba',
        description: 'Folklore Argentino. 3/4 pausado con hemiola de 6/8 en bombo legüero.',
        coverImage: '/genres/genre_zamba.webp',
        timeSignature: [3, 4],
        subdivision: 12,
        instruments: ['bombo_leguero'],
        grooveType: 'zamba_tradicional',
        countingMode: 'numbers',
        recommendedTempo: 90,
        steps: [
            // BOMBO LEGUERO: hemiola clásica de zamba (ta - túm - tác - PÁM - dum)
            { step: 1, instrument: 'bombo_leguero', velocity: 0.72, modifier: 'aro' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.65, modifier: 'aro' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.78, modifier: 'aro' },
            { step: 9, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' },
            { step: 11, instrument: 'bombo_leguero', velocity: 0.72, modifier: 'parche' },
        ]
    },
    {
        id: 'gato',
        name: 'Gato Norteño',
        description: 'Folklore Argentino. Danza alegre y ágil en 6/8 con base saltada.',
        coverImage: '/genres/genre_chacarera.webp',
        timeSignature: [6, 8],
        subdivision: 12,
        instruments: ['bombo_leguero', 'palmas'],
        grooveType: 'chacarera_poliritmica',
        countingMode: 'mnemonics_chacarera',
        recommendedTempo: 148,
        steps: [
            // BOMBO LEGUERO: base viva y ágil
            { step: 1, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
            { step: 3, instrument: 'bombo_leguero', velocity: 0.65, modifier: 'aro' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
            { step: 9, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' },
            { step: 11, instrument: 'bombo_leguero', velocity: 0.72, modifier: 'aro' },

            // PALMAS: marcación picaresca
            { step: 1, instrument: 'palmas', velocity: 0.45 },
            { step: 5, instrument: 'palmas', velocity: 0.42 },
            { step: 7, instrument: 'palmas', velocity: 0.45 },
            { step: 9, instrument: 'palmas', velocity: 0.52 },
        ]
    },
    {
        id: 'chamame',
        name: 'Chamamé',
        description: 'Folklore del Litoral. 6/8 con balanceo saltadito y shaker en corcheas.',
        coverImage: '/genres/genre_chamame.webp',
        timeSignature: [6, 8],
        subdivision: 12,
        instruments: ['cajon', 'shaker'],
        grooveType: 'chamame_saltadito',
        countingMode: 'numbers',
        recommendedTempo: 112,
        steps: [
            // CAJÓN: balanceo litoraleño claro
            { step: 1, instrument: 'cajon', velocity: 0.78, modifier: 'parche' },
            { step: 3, instrument: 'cajon', velocity: 0.72, modifier: 'aro' },
            { step: 5, instrument: 'cajon', velocity: 0.95, modifier: 'parche' },
            { step: 7, instrument: 'cajon', velocity: 0.75, modifier: 'aro' },
            { step: 9, instrument: 'cajon', velocity: 0.78, modifier: 'aro' },
            { step: 11, instrument: 'cajon', velocity: 1.0, modifier: 'parche' },

            // SHAKER: corcheas continuas con pulso compuesto
            { step: 1, instrument: 'shaker', velocity: 0.52 },
            { step: 3, instrument: 'shaker', velocity: 0.36 },
            { step: 5, instrument: 'shaker', velocity: 0.4 },
            { step: 7, instrument: 'shaker', velocity: 0.5 },
            { step: 9, instrument: 'shaker', velocity: 0.36 },
            { step: 11, instrument: 'shaker', velocity: 0.42 },
        ]
    },
    {
        id: 'milonga_pampeana',
        name: 'Milonga Pampeana',
        description: 'Folklore Rioplatense. Síncopa campera 3-3-2 en 2/4 con bombo legüero.',
        coverImage: '/genres/genre_milonga.webp',
        timeSignature: [2, 4],
        subdivision: 8,
        instruments: ['bombo_leguero'],
        grooveType: 'straight',
        countingMode: '1e&a',
        recommendedTempo: 92,
        steps: [
            // Síncopa 3-3-2 limpia (tierra, aro contratiempo, apoyo suave, aro)
            { step: 1, instrument: 'bombo_leguero', velocity: 0.95, modifier: 'parche' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.6, modifier: 'parche' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
        ]
    },
    {
        id: 'malambo',
        name: 'Malambo',
        description: 'Folklore Argentino. Mudanza de zapateo veloz y articulada en 6/8.',
        coverImage: '/genres/genre_malambo.webp',
        timeSignature: [6, 8],
        subdivision: 12,
        instruments: ['bombo_leguero'],
        grooveType: 'chacarera_poliritmica',
        countingMode: 'numbers',
        recommendedTempo: 162,
        steps: [
            // Galope de zapateo y repique articulado
            { step: 1, instrument: 'bombo_leguero', velocity: 0.95, modifier: 'parche' },
            { step: 3, instrument: 'bombo_leguero', velocity: 0.78, modifier: 'aro' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.72, modifier: 'parche' },
            { step: 5, instrument: 'bombo_leguero', velocity: 0.88, modifier: 'parche' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.82, modifier: 'aro' },
            { step: 9, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' },
            { step: 11, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
        ]
    }
];
