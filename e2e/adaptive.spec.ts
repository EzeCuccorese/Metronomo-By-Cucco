import AxeBuilder from '@axe-core/playwright';
import { test, expect, openApp } from './fixtures';

/**
 * Runs in every device project (phone portrait/landscape, tablet portrait/landscape, Pixel, desktop):
 * the layout rules that must hold on all of them.
 */

const MIN_TARGET = 44;

test.describe('adaptive layout', () => {
    test.beforeEach(async ({ page }) => { await openApp(page); });

    test('no horizontal scroll', async ({ page }) => {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });

    test('tempo, play and TAP are reachable without scrolling', async ({ page }) => {
        const viewport = page.viewportSize()!;
        for (const locator of [page.getByTestId('play-toggle'), page.getByTestId('bpm-input'), page.getByRole('button', { name: /Tap tempo/ })]) {
            await expect(locator).toBeInViewport({ ratio: 1 });
            const box = (await locator.boundingBox())!;
            expect(box.y + box.height, 'fits the viewport height').toBeLessThanOrEqual(viewport.height);
        }
    });

    test('the page does not scroll away from the transport (still visible after scrolling down)', async ({ page }) => {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const phonePortrait = await page.evaluate(() => matchMedia('(max-width: 599.98px) and (orientation: portrait)').matches);
        if (phonePortrait) await expect(page.getByTestId('play-toggle')).toBeInViewport({ ratio: 1 });
    });

    test('touch targets are at least 44 px on touch screens', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Only coarse pointers need 44 px targets');
        const small = await page.evaluate((min) => {
            const selector = 'button, [role="button"], [role="combobox"], .MuiSlider-root, [role="checkbox"], [role="switch"], [role="tab"], a[href], input:not([type="hidden"]):not([type="range"])';
            const found: string[] = [];
            for (const el of document.querySelectorAll<HTMLElement>(selector)) {
                // Black piano keys sit between the white ones and are intentionally narrower.
                if (el.classList.contains('piano-key--black')) continue;
                // Screen-reader-only controls (visually hidden until focused) are not touch targets.
                if (el.closest('.visually-hidden-focusable')) continue;
                // Native inputs behind a MUI Select/TextField/Switch are not the touch target: their wrapper is.
                if (el.matches('.MuiSelect-nativeInput')) continue;
                const target = (el.matches('input, [role="combobox"]') && (el.closest('label.MuiFormControlLabel-root') ?? el.closest('.MuiInputBase-root'))) || el;
                const style = getComputedStyle(el);
                if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') continue;
                const rect = target.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) continue;
                // Slider tracks only need the cross-axis hit area.
                const slider = el.classList.contains('MuiSlider-root');
                const tooSmall = slider ? rect.height < min && rect.width < min : rect.width < min - 0.5 || rect.height < min - 0.5;
                if (tooSmall) {
                    const label = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 20) || el.className.toString().slice(0, 40);
                    found.push(`${el.tagName.toLowerCase()}[${label}] ${Math.round(rect.width)}x${Math.round(rect.height)}`);
                }
            }
            return found;
        }, MIN_TARGET);
        expect(small).toEqual([]);
    });

    test('safe areas: nothing sits under the notch, Dynamic Island or home indicator', async ({ page }) => {
        // Chromium does not emulate env(safe-area-inset-*); the layout reads them through these variables.
        const inset = { top: 59, right: 47, bottom: 34, left: 47 };
        await page.evaluate((i) => {
            const root = document.documentElement.style;
            root.setProperty('--safe-top', `${i.top}px`);
            root.setProperty('--safe-right', `${i.right}px`);
            root.setProperty('--safe-bottom', `${i.bottom}px`);
            root.setProperty('--safe-left', `${i.left}px`);
        }, inset);
        // The shell's padding transitions when the variables change: measure the settled layout.
        await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
        const viewport = page.viewportSize()!;
        const header = (await page.locator('header.app-header').boundingBox())!;
        expect(header.y).toBeGreaterThanOrEqual(inset.top);
        expect(header.x).toBeGreaterThanOrEqual(inset.left);
        // The chassis keeps clear of both sides (it spans the whole width on phones).
        const chassis = (await page.locator('.studio-chassis').boundingBox())!;
        expect(chassis.x).toBeGreaterThanOrEqual(inset.left);
        expect(chassis.x + chassis.width).toBeLessThanOrEqual(viewport.width - inset.right);
        // Fixed transport bar (portrait phones): its buttons sit above the home indicator.
        const bar = page.locator('.transport-bar');
        if ((await bar.evaluate(el => getComputedStyle(el).position)) === 'fixed') {
            const play = (await page.getByTestId('play-toggle').boundingBox())!;
            expect(play.y + play.height).toBeLessThanOrEqual(viewport.height - inset.bottom);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });

    test('axe: no serious or critical violations in this orientation', async ({ page }) => {
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .disableRules(['color-contrast']) // the vintage console palette is a deliberate design choice
            .analyze();
        const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
        expect(serious.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
});

test.describe('phone landscape', () => {
    test('the pulse visual and the transport share the first screen', async ({ page }) => {
        const { width, height } = page.viewportSize()!;
        test.skip(!(width > height && height <= 500), 'Compact landscape layout only');
        await openApp(page);
        const pulse = page.getByRole('region', { name: 'Pulso' });
        await expect(pulse).toBeInViewport({ ratio: 1 });
        await expect(page.getByTestId('play-toggle')).toBeInViewport({ ratio: 1 });
        // The BPM numerals are large enough to read from a music stand (about 1.5 m).
        const bpm = await page.getByTestId('bpm-input').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
        expect(bpm).toBeGreaterThanOrEqual(36);
    });
});
