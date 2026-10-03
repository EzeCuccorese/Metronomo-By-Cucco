import type { RhythmPattern } from '../types';

/** Plain metronome click. */
export const METRONOME_PATTERNS: RhythmPattern[] = [
    {
        id: 'metronome_4_4',
        name: 'Metronome (4/4)',
        description: 'Standard Click.',
        coverImage: '/instruments/click.webp',
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
