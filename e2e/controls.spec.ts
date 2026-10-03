import { test, expect, openApp, play, stop, selectPreset, setBpm } from './fixtures';

test.describe('controls', () => {
    test('loads cleanly: Spanish document, title, no console errors or CSP violations', async ({ page, consoleErrors }) => {
        await openApp(page);
        await expect(page).toHaveTitle(/Metrónomo by Cucco/);
        await expect(page.locator('html')).toHaveAttribute('lang', 'es');
        await play(page);
        await page.waitForTimeout(500);
        await stop(page);
        expect(consoleErrors).toEqual([]);
    });

    test('tap tempo measures the tapped tempo', async ({ page }) => {
        await openApp(page);
        // Taps are fired from inside the page so test-runner latency doesn't skew the intervals.
        await page.evaluate(async () => {
            const tap = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.startsWith('Tap tempo'))!;
            for (let i = 0; i < 6; i++) {
                tap.click();
                await new Promise(r => setTimeout(r, 500));
            }
        });
        const bpm = Number(await page.getByTestId('bpm-input').inputValue());
        expect(bpm).toBeGreaterThanOrEqual(117);
        expect(bpm).toBeLessThanOrEqual(121);
    });

    test('keyboard: Space plays/stops, arrows change the tempo, focused buttons are not double-triggered', async ({ page }) => {
        await openApp(page);
        await setBpm(page, 100);
        await page.locator('body').click({ position: { x: 5, y: 5 } });
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Shift+ArrowUp');
        await expect(page.getByTestId('bpm-input')).toHaveValue('106');

        await page.keyboard.press('Space');
        await expect(page.getByTestId('play-toggle')).toHaveText(/DETENER/);

        // Space on the focused play button must toggle exactly once.
        await page.getByTestId('play-toggle').focus();
        await page.keyboard.press('Space');
        await expect(page.getByTestId('play-toggle')).toHaveText(/INICIAR/);
    });

    test('Space plays/stops even right after painting a grid cell with the mouse', async ({ page }) => {
        await openApp(page);
        await selectPreset(page, 'Patrón Personalizado (Editor)');
        const cell = page.getByTestId('cell-kick-1');
        await cell.click();
        await expect(cell).toHaveAttribute('aria-pressed', 'true');
        await cell.focus(); // focus stays on the cell button, as after a real click

        await page.keyboard.press('Space');
        await expect(page.getByTestId('play-toggle')).toHaveText(/DETENER/);
        await expect(cell).toHaveAttribute('aria-pressed', 'true'); // not toggled off by Space
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Space');
        await expect(page.getByTestId('play-toggle')).toHaveText(/INICIAR/);
        await expect(cell).toHaveAttribute('aria-pressed', 'true');
    });

    test('settings survive a reload', async ({ page }) => {
        await openApp(page);
        await selectPreset(page, 'Zamba');
        await setBpm(page, 97);
        await page.getByTestId('mute-shaker').click();
        await page.getByTestId('cell-palmas-2').dispatchEvent('pointerdown', { button: 0 });

        await page.reload();
        await expect(page.getByTestId('bpm-input')).toHaveValue('97');
        await expect(page.getByRole('combobox', { name: 'Ritmo Predefinido' })).toContainText('Zamba');
        await expect(page.getByTestId('mute-shaker')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('cell-palmas-2')).toHaveAttribute('aria-pressed', 'true');

        await page.getByRole('button', { name: 'Restaurar ritmo original' }).click();
        await expect(page.getByTestId('cell-palmas-2')).toHaveAttribute('aria-pressed', 'false');
    });

    test('compound meters show the dotted-quarter tempo', async ({ page }) => {
        await openApp(page);
        await selectPreset(page, 'Chacarera');
        await expect(page.getByTestId('bpm-unit')).toContainText('♩.=');
        await expect(page.getByRole('combobox', { name: 'Compás' })).toContainText('6/8');
    });

    test('the rhythm library is keyboard operable', async ({ page }) => {
        await openApp(page);
        await page.getByRole('button', { name: 'Biblioteca de Ritmos' }).click();
        const card = page.getByTestId('genre-card-malambo');
        await card.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page.getByRole('combobox', { name: 'Ritmo Predefinido' })).toContainText('Malambo');
    });
});

test.describe('practice modes', () => {
    test('speed trainer raises the tempo by itself', async ({ page }) => {
        await openApp(page);
        await selectPreset(page, 'Metronome (4/4)');
        await page.getByText('Modos de práctica').click();
        await page.getByLabel('BPM inicial').fill('240');
        await page.getByLabel('BPM objetivo').fill('250');
        await page.getByLabel('Cada (compases)').fill('1');
        await page.getByLabel('Paso (BPM)').fill('5');
        await page.getByLabel('Entrenador de velocidad').check();
        await expect(page.getByTestId('bpm-input')).toHaveValue('240');

        await play(page);
        await expect(page.getByTestId('bpm-input')).toBeDisabled();
        await expect(page.getByTestId('bpm-input')).toHaveValue('250', { timeout: 6000 });
        await stop(page);
    });

    test('folk forms walk through the sections', async ({ page }) => {
        await openApp(page);
        await selectPreset(page, 'Zamba');
        await setBpm(page, 300);
        await page.getByText('Modos de práctica').click();
        await page.getByLabel('Formas folclóricas').check();
        await page.getByRole('combobox', { name: 'Forma' }).click();
        await page.getByRole('option', { name: 'Zamba' }).click();
        await play(page);
        await expect(page.getByTestId('form-status')).toContainText('PRECUENTA (1ra)');
        await expect(page.getByTestId('form-status')).toContainText('INTRODUCCIÓN (1ra)', { timeout: 5000 });
        await stop(page);
    });
});
