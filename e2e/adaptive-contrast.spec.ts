import AxeBuilder from '@axe-core/playwright';
import { test, expect, openApp } from './fixtures';

/** Contrast and legibility with every panel open (the default layout hides most of them), on every viewport. */
const openEverything = JSON.stringify({
    preset: 'todo',
    panels: { pulse: 'open', instruments: 'open', sequencer: 'open', mixer: 'open', practice: 'open', harmony: 'open', study: 'open', piano: 'open' },
});

test.describe('contrast', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript((layout) => {
            if (!sessionStorage.getItem('__e2e_cleared')) {
                localStorage.clear();
                localStorage.setItem('metronomo:v1:ui.layout.v1', layout);
                sessionStorage.setItem('__e2e_cleared', '1');
            }
        }, openEverything);
        await openApp(page, { keepStorage: true });
        await page.getByRole('switch', { name: 'Mostrar todos' }).click();
    });

    test('axe: no color-contrast violations with every panel open', async ({ page }) => {
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        const bad = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
        expect(bad.map(v => `${v.id}: ${v.nodes.slice(0, 4).map(n => `${n.target.join(' ')} ${n.any[0]?.data?.fgColor}/${n.any[0]?.data?.bgColor}`).join(' | ')}`)).toEqual([]);
    });

    // axe cannot judge text over gradients, so the mixer's small print is checked directly against its dark strip.
    test('mixer labels, scales and readouts are at least 11 px and 4.5:1', async ({ page }) => {
        const rows = await page.evaluate(() => {
            const luminance = (rgb: number[]) => {
                const [r, g, b] = rgb.map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            const parse = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
            const BG = [11, 9, 8]; // the strip background (#0b0908)
            const selectors = ['.channel-param-label', '.pan-value-display', '.fader-scale > span', '.mixer-row__db', '.mixer-row__name', '.channel-label-screen .vfd-text'];
            const out: string[] = [];
            for (const selector of selectors) {
                for (const el of document.querySelectorAll<HTMLElement>(selector)) {
                    if (!el.offsetParent) continue;
                    const style = getComputedStyle(el);
                    const fg = parse(style.color);
                    const l1 = luminance(fg), l2 = luminance(BG);
                    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
                    const size = parseFloat(style.fontSize);
                    if (size < 10.99 || ratio < 4.5) out.push(`${selector} ${size}px ${ratio.toFixed(2)}:1`);
                }
            }
            return [...new Set(out)];
        });
        expect(rows).toEqual([]);
    });
});
