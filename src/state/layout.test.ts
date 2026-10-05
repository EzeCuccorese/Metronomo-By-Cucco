import { describe, it, expect } from 'vitest';
import { DEFAULT_PANELS, PANEL_IDS, PRESET_IDS, PRESET_PANELS, detectPreset, sanitizeLayout } from './layout';

describe('sanitizeLayout', () => {
    it('keeps valid entries and fills in the missing panels', () => {
        const result = sanitizeLayout({ panels: { mixer: 'hidden', piano: 'collapsed' } });
        expect(result?.panels.mixer).toBe('hidden');
        expect(result?.panels.piano).toBe('collapsed');
        expect(result?.panels.pulse).toBe(DEFAULT_PANELS.pulse);
        expect(Object.keys(result!.panels).sort()).toEqual([...PANEL_IDS].sort());
    });

    it('drops invalid states and unknown panels', () => {
        const result = sanitizeLayout({ panels: { mixer: 'gone', ghost: 'hidden', study: 3 } });
        expect(result?.panels.mixer).toBe(DEFAULT_PANELS.mixer);
        expect(result?.panels.study).toBe(DEFAULT_PANELS.study);
        expect(result?.panels).not.toHaveProperty('ghost');
    });

    it.each([[null], ['x'], [[]], [{}], [{ panels: 'x' }]])('rejects %j', (value) => {
        expect(sanitizeLayout(value)).toBeUndefined();
    });
});

describe('presets', () => {
    it('detectPreset recognises each preset and falls back to personalizado', () => {
        for (const id of PRESET_IDS) expect(detectPreset(PRESET_PANELS[id])).toBe(id);
        expect(detectPreset({ ...PRESET_PANELS.todo, piano: 'hidden' })).toBe('personalizado');
    });

    it('sanitizeLayout infers the preset for a layout saved without one', () => {
        expect(sanitizeLayout({ panels: PRESET_PANELS.solo })?.preset).toBe('solo');
        expect(sanitizeLayout({ preset: 'bogus', panels: { piano: 'hidden' } })?.preset).toBe('personalizado');
    });

    it('keeps a stored custom arrangement, defaulting it to the current panels', () => {
        const withCustom = sanitizeLayout({ preset: 'solo', panels: PRESET_PANELS.solo, custom: { piano: 'hidden' } });
        expect(withCustom?.custom.piano).toBe('hidden');
        expect(sanitizeLayout({ preset: 'solo', panels: PRESET_PANELS.solo })?.custom).toEqual(PRESET_PANELS.solo);
    });

    it('the "Armonía y piano" preset shows the harmony and the piano but not the sequencer', () => {
        expect(PRESET_PANELS.armonia.harmony).toBe('open');
        expect(PRESET_PANELS.armonia.piano).toBe('open');
        expect(PRESET_PANELS.armonia.sequencer).toBe('hidden');
        expect(PRESET_PANELS.armonia.mixer).toBe('collapsed');
    });
});
