import { describe, it, expect } from 'vitest';
import { DEFAULT_PANELS, PANEL_IDS, sanitizeLayout } from './layout';

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
