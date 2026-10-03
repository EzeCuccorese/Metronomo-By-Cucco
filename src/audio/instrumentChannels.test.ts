import { describe, it, expect } from 'vitest';
import { CHANNEL_IDS, INSTRUMENT_CHANNEL, getChannelForInstrument } from './instrumentChannels';
import { PRESET_PATTERNS } from '../rhythms/RhythmPatterns';

describe('instrumentChannels', () => {
    it('maps every instrument to an existing mixer channel', () => {
        Object.values(INSTRUMENT_CHANNEL).forEach(channel => expect(CHANNEL_IDS).toContain(channel));
    });

    it('covers every instrument used by the presets', () => {
        PRESET_PATTERNS.forEach(p => p.instruments.forEach(i => expect(INSTRUMENT_CHANNEL[i]).toBeDefined()));
    });

    it('falls back to the synth channel for unknown names', () => {
        expect(getChannelForInstrument('candombe_chico')).toBe('snare');
        expect(getChannelForInstrument('theremin')).toBe('synth');
    });
});
