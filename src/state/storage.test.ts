import { describe, it, expect, vi, afterEach } from 'vitest';
import { STORAGE_PREFIX, isNumber, readStored, writeStored } from './storage';

describe('storage', () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('round-trips JSON values under a versioned key', () => {
        writeStored('bpm', 133);
        expect(localStorage.getItem(`${STORAGE_PREFIX}bpm`)).toBe('133');
        expect(readStored('bpm', 120, isNumber)).toBe(133);
    });

    it('falls back on missing, invalid or corrupted values', () => {
        expect(readStored('missing', 1)).toBe(1);
        localStorage.setItem(`${STORAGE_PREFIX}bad`, '{not json');
        expect(readStored('bad', 2)).toBe(2);
        localStorage.setItem(`${STORAGE_PREFIX}wrong`, '"text"');
        expect(readStored('wrong', 3, isNumber)).toBe(3);
    });

    it('never throws when storage is unavailable', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
        expect(() => writeStored('x', 1)).not.toThrow();
        expect(readStored('x', 5)).toBe(5);
    });
});
