import { describe, it, expect } from 'vitest';
import { SHORTCUTS, groupedShortcuts, matchesEvent, shadowNote, shadowedBy, shortcutById, withShortcut } from './registry';

describe('shortcut registry', () => {
    it('has unique ids', () => {
        expect(new Set(SHORTCUTS.map(s => s.id)).size).toBe(SHORTCUTS.length);
    });

    it('derives tooltip text from the declaration', () => {
        expect(withShortcut('Iniciar', 'transport.play')).toBe('Iniciar (Espacio)');
        expect(withShortcut('Tap tempo', 'transport.tap')).toBe('Tap tempo (T)');
    });

    it('exposes the T conflict between tap tempo and the piano', () => {
        const tap = shortcutById('transport.tap');
        expect(shadowedBy(tap).map(s => s.id)).toEqual(['piano.notes']);
        expect(shadowNote(tap)).toBe('Fa♯');
        expect(shadowedBy(shortcutById('transport.play'))).toEqual([]);
    });

    it('never lets a piano key shadow Space or the tempo arrows', () => {
        for (const id of ['transport.play', 'transport.bpm-up', 'transport.bpm-down', 'transport.next-rhythm'] as const) {
            expect(shadowedBy(shortcutById(id))).toEqual([]);
        }
    });

    it('matches by physical code or character and ignores Ctrl/Alt/Meta', () => {
        const base = { code: '', key: '', altKey: false, ctrlKey: false, metaKey: false };
        expect(matchesEvent(shortcutById('transport.play'), { ...base, code: 'Space' })).toBe(true);
        expect(matchesEvent(shortcutById('transport.play'), { ...base, code: 'Space', ctrlKey: true })).toBe(false);
        const palette = shortcutById('palette.open');
        expect(matchesEvent(palette, { ...base, code: 'KeyK', metaKey: true })).toBe(true);
        expect(matchesEvent(palette, { ...base, code: 'KeyK', ctrlKey: true })).toBe(true);
        expect(matchesEvent(palette, { ...base, code: 'KeyK' })).toBe(false);
        expect(matchesEvent(palette, { ...base, code: 'KeyK', ctrlKey: true, altKey: true })).toBe(false);
        expect(matchesEvent(shortcutById('help.shortcuts'), { ...base, code: 'Minus', key: '?' })).toBe(true);
    });

    it('groups every shortcut for the cheat sheet', () => {
        expect(groupedShortcuts().flatMap(g => g.items)).toHaveLength(SHORTCUTS.length);
    });
});
