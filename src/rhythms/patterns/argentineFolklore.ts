import type { RhythmPattern } from '../types';

/** Argentine folklore and rioplatense rhythms. */
export const ARGENTINE_FOLKLORE_PATTERNS: RhythmPattern[] = [
    {
        id: 'chacarera',
        name: 'Chacarera',
        description: 'Folklore Argentino. 6/8 Polirítmico (Hemiola) con Palmas.',
        coverImage: '/genres/genre_chacarera.webp',
        timeSignature: [6, 8],
        subdivision: 12, // 16ths in 6/8 to allow for fills
        instruments: ['bombo_leguero', 'rim', 'palmas'],
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
            { step: 11, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
            { step: 12, instrument: 'bombo_leguero', velocity: 0.6, modifier: 'aro' },

            // PALMAS: Handclaps accompanying the groove
            { step: 1, instrument: 'palmas', velocity: 0.5 },
            { step: 3, instrument: 'palmas', velocity: 0.4 },
            { step: 4, instrument: 'palmas', velocity: 0.5 },
            { step: 7, instrument: 'palmas', velocity: 0.5 },
            { step: 9, instrument: 'palmas', velocity: 0.6 },
            { step: 11, instrument: 'palmas', velocity: 0.4 }
        ]
    },
    {
        id: 'chacarera_trunca',
        name: 'Chacarera Trunca',
        description: 'Folklore de Santiago del Estero. Primer tiempo libre, resolviendo con acento en el paso 11.',
        coverImage: '/genres/genre_chacarera.webp',
        timeSignature: [6, 8],
        subdivision: 12,
        instruments: ['bombo_leguero', 'rim', 'palmas'],
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
            { step: 12, instrument: 'bombo_leguero', velocity: 0.65, modifier: 'aro' },

            // PALMAS: palmeo acompañando la síncopa trunca
            { step: 1, instrument: 'palmas', velocity: 0.45 },
            { step: 3, instrument: 'palmas', velocity: 0.35 },
            { step: 4, instrument: 'palmas', velocity: 0.4 },
            { step: 7, instrument: 'palmas', velocity: 0.45 },
            { step: 11, instrument: 'palmas', velocity: 0.6 }
        ]
    },
    {
        id: 'zamba',
        name: 'Zamba',
        description: 'Romántico y pausado. 3/4 con aire de 6/8.',
        coverImage: '/genres/genre_zamba.webp',
        timeSignature: [3, 4],
        subdivision: 12,
        instruments: ['bombo_leguero', 'rim', 'palmas'],
        grooveType: 'zamba_tradicional',
        countingMode: 'numbers',
        recommendedTempo: 65,
        steps: [
            // PARCHE (modifier: 'parche'): Tierra en beat 2 (5) y la gran cadencia "dum-dum" en 9 y 11
            { step: 5, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' },
            { step: 9, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' }, // El gran "PÁM"
            { step: 11, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' },

            // ARO (modifier: 'aro'): Estructura madera suave y repiques
            { step: 3, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'aro' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'aro' },
            { step: 8, instrument: 'bombo_leguero', velocity: 0.65, modifier: 'aro' },
            { step: 12, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' }, // Resolución correcta en aro agudo

            // PALMAS: Acompañamiento tradicional suave
            { step: 1, instrument: 'palmas', velocity: 0.4 },
            { step: 5, instrument: 'palmas', velocity: 0.3 },
            { step: 7, instrument: 'palmas', velocity: 0.3 },
            { step: 9, instrument: 'palmas', velocity: 0.4 },
            { step: 11, instrument: 'palmas', velocity: 0.3 }
        ]
    },
    {
        id: 'gato',
        name: 'Gato Norteño',
        description: 'Folklore Argentino. Danza alegre y picaresca en 6/8 rápido.',
        coverImage: '/genres/genre_chacarera.webp',
        timeSignature: [6, 8],
        subdivision: 12,
        instruments: ['bombo_leguero', 'rim', 'palmas'],
        grooveType: 'chacarera_poliritmica',
        countingMode: 'mnemonics_chacarera',
        recommendedTempo: 145,
        steps: [
            // PARCHE: acentos de tierra
            { step: 5, instrument: 'bombo_leguero', velocity: 0.9, modifier: 'parche' },
            { step: 9, instrument: 'bombo_leguero', velocity: 1.0, modifier: 'parche' },

            // ARO: marcación galopada en aro
            { step: 1, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
            { step: 3, instrument: 'bombo_leguero', velocity: 0.7, modifier: 'aro' },
            { step: 4, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
            { step: 7, instrument: 'bombo_leguero', velocity: 0.8, modifier: 'aro' },
            { step: 11, instrument: 'bombo_leguero', velocity: 0.85, modifier: 'aro' },
            { step: 12, instrument: 'bombo_leguero', velocity: 0.6, modifier: 'aro' },

            // PALMAS: palmeo acompañando el baile
            { step: 1, instrument: 'palmas', velocity: 0.45 },
            { step: 3, instrument: 'palmas', velocity: 0.35 },
            { step: 4, instrument: 'palmas', velocity: 0.4 },
            { step: 7, instrument: 'palmas', velocity: 0.45 },
            { step: 9, instrument: 'palmas', velocity: 0.5 },
            { step: 11, instrument: 'palmas', velocity: 0.4 }
        ]
    },
    {
        id: 'chamame',
        name: 'Chamamé',
        description: 'Folklore del Litoral. Cajón y Shaker con acento saltadito corrido.',
        coverImage: '/genres/genre_chamame.webp',
        timeSignature: [6, 8],
        subdivision: 12,
        instruments: ['cajon', 'shaker'],
        grooveType: 'chamame_saltadito',
        countingMode: 'numbers',
        recommendedTempo: 100,
        steps: [
            // CAJON PARCHE: Graves litoraleños (a contratiempo)
            { step: 1, instrument: 'cajon', velocity: 0.8, modifier: 'parche' },
            { step: 5, instrument: 'cajon', velocity: 0.95, modifier: 'parche' },
            { step: 7, instrument: 'cajon', velocity: 0.7, modifier: 'parche' },
            { step: 11, instrument: 'cajon', velocity: 1.0, modifier: 'parche' },

            // CAJON ARO: Agudos repicados (saltadito con el nuevo modificador slap)
            { step: 3, instrument: 'cajon', velocity: 0.75, modifier: 'aro' },
            { step: 4, instrument: 'cajon', velocity: 0.5, modifier: 'aro' },
            { step: 9, instrument: 'cajon', velocity: 0.8, modifier: 'aro' },
            { step: 10, instrument: 'cajon', velocity: 0.5, modifier: 'aro' },

            // SHAKER: Semicorcheas continuas fluidas
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
            { step: 12, instrument: 'shaker', velocity: 0.4 }
        ]
    },
    {
        id: 'milonga_pampeana',
        name: 'Milonga Pampeana',
        description: 'Folklore Rioplatense. Síncopa campera tradicional 3-3-2 en bombo legüero.',
        coverImage: '/genres/genre_milonga.webp',
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
        id: 'malambo',
        name: 'Malambo',
        description: 'Folklore Argentino. Mudanza de zapateo hiper-veloz y virtuosa en 6/8.',
        coverImage: '/genres/genre_malambo.webp',
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
    }
];
