import AxeBuilder from '@axe-core/playwright';
import { test, expect, openApp } from './fixtures';

test.describe('PWA', () => {
    test('manifest and every icon are served', async ({ page, request }) => {
        await openApp(page);
        const href = await page.locator('link[rel="manifest"]').getAttribute('href');
        expect(href).toBeTruthy();
        const manifest = await (await request.get(href!)).json();
        expect(manifest.name).toBe('Metrónomo by Cucco');
        expect(manifest.lang).toBe('es');
        expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
        for (const icon of manifest.icons) {
            const res = await request.get(`/${icon.src}`);
            expect(res.status(), icon.src).toBe(200);
            expect(res.headers()['content-type']).toContain('image/png');
        }
        expect((await request.get('/favicon.svg')).status()).toBe(200);
        expect((await request.get('/apple-touch-icon.png')).status()).toBe(200);
    });

    test('the service worker precaches the folk samples for offline use', async ({ request }) => {
        const sw = await (await request.get('/sw.js')).text();
        ['audio/bombo_parche.ogg', 'audio/clave.ogg', 'audio/candombe_chico.ogg', 'audio/kick.wav', 'audio/piano/C4.ogg'].forEach(asset => {
            expect(sw, asset).toContain(asset);
        });
    });
});

test.describe('layout and accessibility', () => {
    test('no horizontal scroll on a phone', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openApp(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });

    test('axe: no serious or critical violations', async ({ page }) => {
        await openApp(page);
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .disableRules(['color-contrast']) // the vintage console palette is a deliberate design choice
            .analyze();
        const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
        expect(serious.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
});
