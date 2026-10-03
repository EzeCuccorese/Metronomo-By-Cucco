import type { RhythmPattern } from '../types';

/** Rock and blues grooves. */
export const ROCK_PATTERNS: RhythmPattern[] = [
    {
        id: 'rock_basic',
        name: 'Rock Estándar',
        description: 'Basic 4/4 Rock beat. Straight groove.',
        coverImage: '/genres/genre_rock.webp',
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
        coverImage: '/genres/genre_blues.webp',
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
    }
];
