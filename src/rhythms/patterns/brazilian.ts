import type { RhythmPattern } from '../types';

/** Brazilian grooves. */
export const BRAZILIAN_PATTERNS: RhythmPattern[] = [
    {
        id: 'samba',
        name: 'Samba Brasilera',
        description: 'Batucada style. Fast 2/4.',
        coverImage: '/genres/genre_samba.webp',
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
        id: 'bossa_nova',
        name: 'Bossa Nova',
        description: 'Ritmo Brasilero. Clave de Bossa en Aro, síncopa de Surdo y base de Hi-Hat.',
        coverImage: '/genres/genre_bossa.webp',
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
    }
];
