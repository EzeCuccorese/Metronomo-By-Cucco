/**
 * Defines the types and data structures for Rhythm Patterns.
 * Includes presets for EMPA curriculum rhythms.
 *
 * (ES) Define los tipos y estructuras de datos para Patrones Rítmicos.
 * Incluye preajustes para ritmos del currículo de la EMPA.
 */

import React from 'react';
import { Drum, CircleDot, Triangle, Music, Zap, Hexagon, Circle, Disc } from 'lucide-react';

export type InstrumentType =
    'kick' | 'snare' | 'hihat' | 'ride' |
    'tom_high' | 'tom_low' | 'tom_floor' |
    'crash' |
    'bombo_leguero' |
    'click' | 'shaker' | 'clave' | 'rim' | 'surdo' | 'hihat_foot' |
    'caja' | 'cajon' | 'palmas' | 'candombe_chico' | 'candombe_repique' | 'candombe_piano';

// Map of Icons
export const InstrumentIcons: Record<InstrumentType, React.ComponentType<{ className?: string; size?: number; strokeWidth?: number; color?: string }>> = {
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
    hihat_foot: Triangle,
    caja: Drum,
    cajon: Hexagon,
    palmas: CircleDot,
    candombe_chico: Drum,
    candombe_repique: Drum,
    candombe_piano: Drum
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
        description: 'Folklore Argentino. 6/8 Polirítmico (Hemiola) con Palmas.',
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
        id: 'vidala',
        name: 'Vidala',
        description: 'Folklore del Noroeste. 3/4 lento con caja coplera real.',
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
        id: 'candombe',
        name: 'Candombe',
        description: 'Folklore Rioplatense. Ensamble de Tambores: Clave, Chico, Repique y Piano.',
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
    },
    {
        id: 'huayno',
        name: 'Huayno',
        description: 'Folklore Andino. 2/4 rápido con el galope saltado (salta-salta) tradicional.',
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

