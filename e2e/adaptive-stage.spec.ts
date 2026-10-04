import { test, expect, openApp } from './fixtures';

test.describe('stage mode', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
        await page.getByTestId('view-menu-button').click();
        await page.getByTestId('stage-menu-item').click();
    });

    test('fills the screen with a huge tempo, the pulse and the controls, without scrolling', async ({ page }) => {
        const stage = page.getByRole('dialog', { name: 'Modo escenario' });
        await expect(stage).toBeVisible();
        const viewport = page.viewportSize()!;
        const size = await page.getByTestId('stage-bpm').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
        expect(size).toBeGreaterThanOrEqual(80);
        for (const id of ['stage-play-toggle', 'stage-bpm-up', 'stage-bpm-down', 'stage-close', 'stage-beats']) {
            await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
        }
        const play = (await page.getByTestId('stage-play-toggle').boundingBox())!;
        expect(play.y + play.height).toBeLessThanOrEqual(viewport.height);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });

    test('plays, changes the tempo and leaves with Esc or the close button', async ({ page }) => {
        await page.getByTestId('stage-play-toggle').click();
        await expect(page.getByTestId('stage-play-toggle')).toHaveText(/DETENER/);
        const before = Number(await page.getByTestId('stage-bpm').textContent());
        await page.getByTestId('stage-bpm-up').click();
        await expect(page.getByTestId('stage-bpm')).toHaveText(String(before + 1));
        await page.getByTestId('stage-play-toggle').click();
        await page.keyboard.press('Escape');
        // Where fullscreen is on, the browser spends the first Esc leaving it; the second one closes the stage.
        if (await page.getByTestId('stage-mode').count() > 0) await page.keyboard.press('Escape');
        await expect(page.getByTestId('stage-mode')).toHaveCount(0);
        await page.getByTestId('view-menu-button').click();
        await page.getByTestId('stage-menu-item').click();
        await page.getByTestId('stage-close').click();
        await expect(page.getByTestId('stage-mode')).toHaveCount(0);
    });

    test('offers fullscreen only where the device can do it (never on iPhone)', async ({ page }, testInfo) => {
        const button = page.getByRole('button', { name: /pantalla completa/i });
        if (testInfo.project.name.startsWith('iphone')) {
            await expect(button).toHaveCount(0);
        } else {
            const supported = await page.evaluate(() => document.fullscreenEnabled);
            await expect(button).toHaveCount(supported ? 1 : 0);
        }
    });
});
