import { test, expect, openApp } from './fixtures';

test.describe('first-use tips', () => {
    test('Space tip after the first Play with the mouse (mouse devices only), shown once', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Touch screens have no Space bar');
        await openApp(page, { tips: true });
        await page.getByTestId('play-toggle').click();
        const tip = page.getByTestId('first-use-tip');
        await expect(tip).toContainText('barra Espacio');
        await page.getByRole('button', { name: 'Entendido' }).click();
        await expect(tip).toHaveCount(0);
        await page.getByTestId('play-toggle').click();
        await page.reload();
        await page.getByTestId('play-toggle').click();
        await expect(page.getByTestId('first-use-tip')).toHaveCount(0);
    });

    test('piano tip on hover (mouse devices only)', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Touch screens have no hover');
        await openApp(page, { tips: true });
        await page.locator('[data-panel="piano"]').scrollIntoViewIfNeeded();
        await page.locator('[data-panel="piano"]').hover();
        await expect(page.getByTestId('first-use-tip')).toContainText('teclado de la computadora');
    });

    test('Vista tip after three long scrolls, above the phone bottom bar', async ({ page }) => {
        await openApp(page, { tips: true });
        const height = page.viewportSize()!.height;
        const tip = page.getByTestId('first-use-tip');
        // Long scrolls back and forth until the tip shows (engines differ a little in when they deliver scroll events).
        for (let i = 0; i < 10 && (await tip.count()) === 0; i++) {
            await page.evaluate((y) => window.scrollTo(0, y), i % 2 === 0 ? height * 1.5 : 0);
            await page.waitForTimeout(700);
        }
        await expect(tip).toContainText('"Vista"');
        const phonePortrait = await page.evaluate(() => matchMedia('(max-width: 599.98px) and (orientation: portrait)').matches);
        if (phonePortrait) {
            const bar = (await page.locator('.transport-bar').boundingBox())!;
            const box = (await tip.boundingBox())!;
            expect(box.y + box.height).toBeLessThanOrEqual(bar.y + 1);
        }
    });
});
