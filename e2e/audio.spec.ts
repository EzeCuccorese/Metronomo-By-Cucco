import { test, expect, openApp, play, stop, selectPreset, setBpm, setMuted, AUDIBLE, SILENT } from './fixtures';

/**
 * These tests listen to the real Web Audio output of the production bundle.
 * Each one maps to a bug found in the audit (see docs/plans/auditoria-critica-y-plan-de-mejoras.plan.md).
 */
test.describe('audio output', () => {
    test('C1 · the Metronome preset clicks on every beat', async ({ page, probe }) => {
        await openApp(page);
        await selectPreset(page, 'Metronome (4/4)');
        await setBpm(page, 120);
        await expect(page.getByTestId('mute-click')).toHaveAttribute('aria-pressed', 'false');

        await play(page);
        const t0 = await probe.now();
        await probe.listen(2.2);
        // Every beat is heard...
        const onsets = await probe.onsetsAbove(AUDIBLE, t0, t0 + 2.2);
        expect(onsets.length).toBeGreaterThanOrEqual(4);
        // ...and scheduled exactly on the grid: beats at ♩=120 are 0.5 s apart. The timing is
        // checked on the scheduled start times because the peak sampler only resolves onsets
        // to ~±20 ms (5 ms polling of a 512-sample analyser window), which made a tight
        // window on measured onsets flaky in CI.
        const beats = await probe.startTimes('OscillatorNode', t0, t0 + 2.2);
        expect(beats.length).toBeGreaterThanOrEqual(4);
        beats.slice(1).forEach((t, i) => expect(t - beats[i]).toBeCloseTo(0.5, 3));
    });

    test('C4 · Candombe drums are audible even with the clave muted', async ({ page, probe }) => {
        await openApp(page);
        await selectPreset(page, 'Candombe');
        await setMuted(page, 'clave', true);
        await setMuted(page, 'click', true);
        await play(page);
        expect(await probe.listen(2)).toBeGreaterThan(AUDIBLE);
    });

    test('C2/C3 · editing the grid while playing is heard, and stays', async ({ page, probe }) => {
        await openApp(page);
        await selectPreset(page, 'Patrón Personalizado (Editor)');
        await setBpm(page, 120);
        await setMuted(page, 'click', true);
        await play(page);
        expect(await probe.listen(1.2)).toBeLessThan(SILENT);

        await page.getByTestId('cell-kick-1').dispatchEvent('pointerdown', { button: 0 });
        await page.getByTestId('cell-kick-9').dispatchEvent('pointerdown', { button: 0 });
        await expect(page.getByTestId('cell-kick-1')).toHaveAttribute('aria-pressed', 'true');

        // One 4/4 bar lasts 2 s: the new notes must sound within it…
        expect(await probe.listen(2.2)).toBeGreaterThan(AUDIBLE);
        // …and the edit must not be reverted by the playback loop.
        await expect(page.getByTestId('cell-kick-1')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('cell-kick-9')).toHaveAttribute('aria-pressed', 'true');
    });

    test('A1 · stop cuts drums and sustained harmony immediately', async ({ page, probe }) => {
        await openApp(page);
        await page.getByText('I', { exact: true }).click(); // pad chord: 1 bar long
        await page.getByText('IV', { exact: true }).click();
        await play(page);
        expect(await probe.listen(1.5)).toBeGreaterThan(AUDIBLE);

        await stop(page);
        const stoppedAt = await probe.now();
        await probe.listen(0.6);
        expect(await probe.peakBetween(stoppedAt + 0.08, stoppedAt + 0.6)).toBeLessThan(SILENT);
    });

    test('a queued rhythm starts exactly on the next bar line', async ({ page }) => {
        await openApp(page);
        await play(page);
        await selectPreset(page, 'Samba Brasilera');
        await expect(page.getByTestId('queued-pattern')).toContainText('SAMBA');
        // The switch happens at the bar line, then the recommended tempo is adopted.
        await expect(page.getByTestId('queued-pattern')).toBeHidden({ timeout: 5000 });
        await expect(page.getByTestId('bpm-input')).toHaveValue('115');
        await expect(page.getByRole('combobox', { name: 'Ritmo Predefinido' })).toContainText('Samba Brasilera');
    });

    test('C6 · practiced bars are counted without any harmony', async ({ page, probe }) => {
        await openApp(page);
        await setBpm(page, 240); // 1 s per 4/4 bar
        await play(page);
        await probe.listen(3.3);
        const bars = Number(await page.getByTestId('bars-practiced').textContent());
        expect(bars).toBeGreaterThanOrEqual(2);
    });
});
