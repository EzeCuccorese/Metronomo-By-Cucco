import { test, expect, openApp } from './fixtures';

/** Foldable and hideable panels, on every viewport (phone portrait/landscape, tablet, desktop). */
test.describe('panels', () => {
    test.beforeEach(async ({ page }) => { await openApp(page); });

    test('fold keeps the summary, survives a reload and unfolds again', async ({ page }) => {
        const toggle = page.getByTestId('panel-toggle-sequencer');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByTestId('cell-snare-2')).toBeHidden();
        await page.reload();
        await expect(page.getByTestId('panel-toggle-sequencer')).toHaveAttribute('aria-expanded', 'false');
        await page.getByTestId('panel-toggle-sequencer').click();
        await expect(page.getByTestId('cell-snare-2')).toBeVisible();
    });

    test('hide removes the panel, the page does not overflow, and it can be shown again', async ({ page }) => {
        await page.getByRole('button', { name: 'Opciones de Secuenciador' }).click();
        await page.getByRole('menuitem', { name: 'Ocultar panel' }).click();
        await expect(page.getByRole('region', { name: 'Secuenciador' })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await page.reload();
        await expect(page.getByRole('region', { name: 'Secuenciador' })).toHaveCount(0);
        await page.getByTestId('view-menu-button').click();
        await page.getByRole('menuitemcheckbox', { name: 'Secuenciador' }).click();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('region', { name: 'Secuenciador' })).toBeVisible();
    });

    test('with the mixer folded the mute set earlier is still applied (state lives outside the card)', async ({ page }) => {
        await page.getByTestId('mute-kick').click();
        await page.getByTestId('panel-toggle-mixer').click();
        await page.getByTestId('panel-toggle-mixer').click();
        await expect(page.getByTestId('mute-kick')).toHaveAttribute('aria-pressed', 'true');
    });
});

test.describe('view presets', () => {
    test('a new user starts on "Ritmos" and can switch to "Todo" and back', async ({ page }) => {
        await openApp(page, { newUser: true });
        await expect(page.getByRole('region', { name: 'Piano' })).toHaveCount(0);
        await expect(page.getByRole('region', { name: 'Secuenciador' })).toBeVisible();
        await page.getByTestId('view-menu-button').click();
        await expect(page.getByRole('menuitemradio', { name: 'Ritmos' })).toHaveAttribute('aria-checked', 'true');
        await page.getByRole('menuitemradio', { name: 'Todo' }).click();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('region', { name: 'Piano' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await page.reload();
        await expect(page.getByRole('region', { name: 'Piano' })).toBeVisible();
    });

    test('the Vista control is reachable and 44 px tall on touch screens', async ({ page, isMobile }) => {
        await openApp(page);
        const button = page.getByTestId('view-menu-button');
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeVisible();
        if (isMobile) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    });
});
