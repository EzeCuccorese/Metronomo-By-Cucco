import type { Page } from '@playwright/test';
import { test, expect, openApp, play, selectPreset, setBpm, setMuted, AUDIBLE, SILENT } from './fixtures';

/** Hovering the panel downloads the samples; waits until the real piano is decoded. */
async function waitForPianoSamples(page: Page) {
    const panel = page.getByTestId('piano-panel');
    await panel.scrollIntoViewIfNeeded();
    await panel.hover();
    await expect(page.getByTestId('piano-status')).toHaveAttribute('data-status', 'ready', { timeout: 15_000 });
}

async function choose(page: Page, combobox: string, option: string) {
    await page.getByRole('combobox', { name: combobox }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
}

test.describe('piano', () => {
    test('pressing a key plays a sampled piano note, and releasing it lets it fade', async ({ page, probe, consoleErrors }) => {
        await openApp(page);
        await waitForPianoSamples(page);

        const key = page.getByTestId('piano-key-60'); // Do 4
        await expect(key).toHaveAccessibleName(/Do 4/);
        const box = (await key.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.85);
        await page.mouse.down();
        await expect(key).toHaveAttribute('aria-pressed', 'true');
        expect(await probe.listen(0.4)).toBeGreaterThan(AUDIBLE);

        await page.mouse.up();
        await expect(key).toHaveAttribute('aria-pressed', 'false');
        const releasedAt = await probe.now();
        await probe.listen(1.2);
        expect(await probe.peakBetween(releasedAt + 0.9, releasedAt + 1.2)).toBeLessThan(SILENT);
        expect(consoleErrors).toEqual([]);
    });

    test('the computer keyboard plays notes only while the panel has focus (or "Teclado PC" is on)', async ({ page, probe }) => {
        await openApp(page);
        await waitForPianoSamples(page);

        // Focus elsewhere: "A" is not a note.
        await page.getByTestId('bpm-input').focus();
        await page.getByTestId('bpm-input').blur();
        await page.keyboard.down('KeyA');
        expect(await probe.listen(0.3)).toBeLessThan(SILENT);
        await page.keyboard.up('KeyA');

        await page.getByRole('button', { name: 'Teclado PC' }).click();
        await page.keyboard.down('KeyA');
        await expect(page.getByTestId('piano-key-48')).toHaveAttribute('aria-pressed', 'true');
        expect(await probe.listen(0.3)).toBeGreaterThan(AUDIBLE);
        await page.keyboard.up('KeyA');
        await expect(page.getByTestId('piano-key-48')).toHaveAttribute('aria-pressed', 'false');
    });

    test('the "Piano" accompaniment plays the progression on the PIANO mixer channel', async ({ page, probe }) => {
        await openApp(page);
        await selectPreset(page, 'Metronome (4/4)'); // no drums: only the piano is heard
        await page.getByText('I', { exact: true }).click();
        await page.getByText('V', { exact: true }).click();
        await choose(page, 'Estilo', 'Piano (bajo + acordes)');
        await waitForPianoSamples(page);
        await setMuted(page, 'click', true);

        await play(page);
        expect(await probe.listen(1.5)).toBeGreaterThan(AUDIBLE);
        // The sounding chord is highlighted on the keyboard.
        await expect(page.locator('.piano-key.is-root').first()).toBeVisible();

        await setMuted(page, 'piano', true);
        await probe.listen(0.4); // let the ringing notes decay through the muted strip
        expect(await probe.listen(1.2)).toBeLessThan(SILENT);
    });

    test('a recorded melody loops in time with the metronome', async ({ page, probe }) => {
        await openApp(page);
        await selectPreset(page, 'Metronome (4/4)');
        await setBpm(page, 240); // 1 s per 4/4 bar
        await waitForPianoSamples(page);
        await choose(page, 'Largo', '1 compás');
        await setMuted(page, 'click', true);

        await page.getByRole('button', { name: 'Grabar' }).click();
        const status = page.getByTestId('melody-status');
        await expect(status).toContainText('Grabando', { timeout: 5_000 });
        await page.getByTestId('piano-key-64').dispatchEvent('pointerdown', { button: 0, pointerId: 7, pointerType: 'mouse' });
        await page.waitForTimeout(150);
        await page.getByTestId('piano-key-64').dispatchEvent('pointerup', { button: 0, pointerId: 7, pointerType: 'mouse' });

        await expect(status).toContainText('1 nota · 1 compás', { timeout: 5_000 });
        await expect(page.getByRole('button', { name: 'Loop' })).toHaveAttribute('aria-pressed', 'true');

        // Nobody touches the keys now: what we hear is the loop.
        const t0 = await probe.now();
        await probe.listen(2.2);
        const onsets = await probe.onsetsAbove(AUDIBLE, t0, t0 + 2.2);
        expect(onsets.length).toBeGreaterThanOrEqual(2);
        const gaps = onsets.slice(1).map((t, i) => t - onsets[i]);
        gaps.forEach(g => expect(Math.abs(g - 1)).toBeLessThan(0.08)); // once per 1 s bar
    });
});
