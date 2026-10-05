import { test, expect, openApp } from './fixtures';

const phonePortrait = (page: import('@playwright/test').Page) => page.evaluate(() => matchMedia('(max-width: 599.98px) and (orientation: portrait)').matches);

test.describe('sticky transport', () => {
    test.beforeEach(async ({ page }) => { await openApp(page); });

    test('the slim bar appears once the header scrolls away and stops/starts the metronome', async ({ page }) => {
        test.skip(await phonePortrait(page), 'Portrait phones keep the bottom bar instead');
        await expect(page.getByTestId('compact-transport')).toHaveCount(0);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const bar = page.getByTestId('compact-transport');
        await expect(bar).toBeVisible();
        const box = (await bar.boundingBox())!;
        expect(box.y).toBeLessThanOrEqual(0.5);
        expect(box.height).toBeLessThanOrEqual(64);
        const viewport = page.viewportSize()!;
        expect(box.width).toBeLessThanOrEqual(viewport.width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

        await page.getByTestId('compact-play-toggle').click();
        await expect(page.getByTestId('compact-play-toggle')).toHaveText(/DETENER/);
        await page.getByTestId('compact-play-toggle').click();
        await expect(page.getByTestId('compact-play-toggle')).toHaveText(/INICIAR/);

        const before = Number(await page.getByTestId('compact-bpm').textContent());
        await page.getByRole('button', { name: 'Subir tempo' }).click();
        await expect(page.getByTestId('compact-bpm')).toHaveText(String(before + 1));

        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(bar).toHaveCount(0);
    });

    test('portrait phone pocket mode: big − / + and play, hold repeats', async ({ page }) => {
        test.skip(!(await phonePortrait(page)), 'Portrait phones only');
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expect(page.getByTestId('compact-transport')).toBeHidden(); // the bottom bar plays that role here
        for (const id of ['bpm-down', 'bpm-up', 'play-toggle']) {
            await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
            const box = (await page.getByTestId(id).boundingBox())!;
            expect(box.height, id).toBeGreaterThanOrEqual(56);
        }
        await expect(page.locator('.transport-bar .transport-leds')).toBeVisible();
        const input = page.getByTestId('bpm-input');
        const start = Number(await input.inputValue());
        await page.getByTestId('bpm-up').click();
        await expect(input).toHaveValue(String(start + 1));
        // Holding the button repeats.
        const up = (await page.getByTestId('bpm-up').boundingBox())!;
        await page.mouse.move(up.x + up.width / 2, up.y + up.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(1100);
        await page.mouse.up();
        expect(Number(await input.inputValue())).toBeGreaterThan(start + 3);
    });

    test('the bottom bar keeps the content clear of it', async ({ page }) => {
        test.skip(!(await phonePortrait(page)), 'Portrait phones only');
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const bar = (await page.locator('.transport-bar').boundingBox())!;
        const last = (await page.locator('section[data-panel]').last().boundingBox())!;
        expect(last.y + last.height).toBeLessThanOrEqual(bar.y + 1);
    });
});
