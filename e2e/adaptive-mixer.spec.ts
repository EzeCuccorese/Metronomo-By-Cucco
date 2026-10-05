import { test, expect, openApp } from './fixtures';

test.describe('mixer', () => {
    test.beforeEach(async ({ page }) => { await openApp(page); });

    test('shows only the channels in use, "Mostrar todos" reveals the rest', async ({ page }) => {
        const strips = page.locator('[data-testid^="mixer-channel-"]');
        const used = await strips.count();
        expect(used).toBeLessThan(9);
        expect(used).toBeGreaterThanOrEqual(2);
        await page.getByRole('switch', { name: 'Mostrar todos' }).click();
        await expect(strips).toHaveCount(9);
        await page.reload();
        await expect(strips).toHaveCount(9);
    });

    test('phones get horizontal rows with big sliders, desktop keeps the console', async ({ page, isMobile }) => {
        const rows = page.locator('.mixer-row');
        if (isMobile && (page.viewportSize()!.width < 600)) {
            await expect(rows.first()).toBeVisible();
            const slider = (await page.locator('.mixer-row .MuiSlider-root').first().boundingBox())!;
            expect(slider.width).toBeGreaterThan(120);
            const solo = (await page.getByTestId('solo-click').boundingBox())!;
            expect(solo.height).toBeGreaterThanOrEqual(44);
            expect(solo.width).toBeGreaterThanOrEqual(40);
        } else {
            await expect(page.locator('.mixer-channels-container')).toBeVisible();
            await page.getByRole('button', { name: 'Compacta' }).click();
            await expect(rows.first()).toBeVisible();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });

    test('solo toggles and is reflected in the card summary when folded', async ({ page }) => {
        await page.getByTestId('solo-click').click();
        await expect(page.getByTestId('solo-click')).toHaveAttribute('aria-pressed', 'true');
        await page.getByTestId('panel-toggle-mixer').click();
        await expect(page.getByTestId('panel-toggle-mixer')).toContainText('Solo Click');
    });
});
