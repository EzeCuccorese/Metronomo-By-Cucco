import { describe, it, expect } from 'vitest';
import { INSTRUMENT_IMAGES, getInstrumentImage } from './instrumentAssets';

describe('instrumentAssets', () => {
    it('should return correct image path for valid instrument', () => {
        expect(getInstrumentImage('bombo_leguero')).toBe('/instruments/bombo_leguero.webp');
        expect(getInstrumentImage('kick')).toBe('/instruments/kick.webp');
    });

    it('should return fallback click image for unknown instrument', () => {
        expect(getInstrumentImage('non_existent_instrument')).toBe('/instruments/click.webp');
    });

    it('should contain mapped images in INSTRUMENT_IMAGES object', () => {
        expect(INSTRUMENT_IMAGES.snare).toBe('/instruments/snare.webp');
    });
});
