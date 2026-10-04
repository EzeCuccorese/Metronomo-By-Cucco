import type { InstrumentType } from '../rhythms/RhythmPatterns';

/**
 * Mixer channels exposed by the DrumSynthesizer.
 * (ES) Canales del mixer expuestos por el DrumSynthesizer.
 */
export const CHANNEL_IDS = ['bombo', 'clave', 'shaker', 'kick', 'snare', 'hihat', 'click', 'synth', 'piano'] as const;

export type ChannelId = typeof CHANNEL_IDS[number];

/**
 * Single source of truth for instrument -> mixer channel routing.
 * Used by the audio engine (where sound is sent) and the mixer UI (which meter lights up).
 *
 * (ES) Fuente única de verdad para el ruteo instrumento -> canal del mixer.
 */
export const INSTRUMENT_CHANNEL: Record<InstrumentType, ChannelId> = {
    bombo_leguero: 'bombo',
    rim: 'bombo',
    surdo: 'bombo',
    cajon: 'bombo',
    candombe_piano: 'bombo',
    clave: 'clave',
    shaker: 'shaker',
    kick: 'kick',
    tom_low: 'kick',
    tom_floor: 'kick',
    snare: 'snare',
    tom_high: 'snare',
    caja: 'snare',
    palmas: 'snare',
    candombe_chico: 'snare',
    candombe_repique: 'snare',
    hihat: 'hihat',
    hihat_foot: 'hihat',
    crash: 'hihat',
    ride: 'hihat',
    click: 'click',
};

export const getChannelForInstrument = (instrument: string): ChannelId =>
    INSTRUMENT_CHANNEL[instrument as InstrumentType] ?? 'synth';
