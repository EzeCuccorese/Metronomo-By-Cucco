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
        await page.getByRole('button', { name: 'Mostrar secuenciador' }).click();
        await expect(page.getByRole('region', { name: 'Secuenciador' })).toBeVisible();
    });

    test('with the mixer folded the mute set earlier is still applied (state lives outside the card)', async ({ page }) => {
        await page.getByTestId('mute-kick').click();
        await page.getByTestId('panel-toggle-mixer').click();
        await page.getByTestId('panel-toggle-mixer').click();
        await expect(page.getByTestId('mute-kick')).toHaveAttribute('aria-pressed', 'true');
    });
});
