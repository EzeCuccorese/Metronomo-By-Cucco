import { test, expect, openApp } from './fixtures';

/**
 * Visual regression of the first screen on the key viewports. Baselines are rendered on Linux (the CI
 * runner); font rasterisation differs on macOS, so the comparison only runs there. Regenerate with
 * `npx playwright test adaptive-visual --update-snapshots` inside the Playwright Linux image.
 */
test.describe('visual regression: first screen', () => {
    test.skip(process.platform !== 'linux', 'Baselines are Linux-rendered');
    test.beforeEach(({ page: _page }, testInfo) => {
        test.skip(['pixel-7', 'iphone-max-landscape'].includes(testInfo.project.name), 'Covered by the other phone viewports');
    });

    test('first screen', async ({ page }) => {
        // Fixed time: nothing on the first screen should depend on the clock, but pin it anyway.
        await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
        await openApp(page);
        await page.evaluate(() => document.fonts.ready);
        // Let the instrument photos decode and the layout settle.
        await page.waitForFunction(() => [...document.images].every(img => img.complete));
        await page.waitForTimeout(300);
        await expect(page).toHaveScreenshot('first-screen.png');
    });
});
