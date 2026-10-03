import { describe, expect, it } from 'vitest';
import { HIGHLIGHT_MS, isHighlighted, markHighlight } from './highlight';

describe('highlight windows', () => {
    it('is highlighted until the expiry', () => {
        const m = {};
        markHighlight(m, 'kick', 1000);
        expect(isHighlighted(m, 'kick', 1000)).toBe(true);
        expect(isHighlighted(m, 'kick', 1000 + HIGHLIGHT_MS - 1)).toBe(true);
        expect(isHighlighted(m, 'kick', 1000 + HIGHLIGHT_MS)).toBe(false);
        expect(isHighlighted(m, 'snare', 1000)).toBe(false);
    });

    it('a second rapid hit is not cleared by the first one expiring', () => {
        const m = {};
        markHighlight(m, 'kick', 1000);
        markHighlight(m, 'kick', 1150);
        expect(isHighlighted(m, 'kick', 1250)).toBe(true); // first window ended at 1200
        expect(isHighlighted(m, 'kick', 1350)).toBe(false);
    });

    it('never shortens an existing window', () => {
        const m = {};
        markHighlight(m, 'kick', 1000, 500);
        markHighlight(m, 'kick', 1010, 50);
        expect(isHighlighted(m, 'kick', 1400)).toBe(true);
    });
});
