import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { test, expect, openApp, play, stop, setBpm, AUDIBLE } from './fixtures';

/**
 * Real service worker (this project is the only one that does not block them): offline use and the
 * "new version" prompt. A tiny proxy in front of `vite preview` lets the test publish a "new build"
 * by changing the bytes of /sw.js, which is exactly what the browser compares to detect an update.
 */
const UPSTREAM = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4173)}`;
const PROXY_PORT = Number(process.env.E2E_PORT ?? 4173) + 1000;

let server: Server;
let newVersion = false;

test.use({ baseURL: `http://127.0.0.1:${PROXY_PORT}` });

test.beforeAll(async () => {
    // oxlint-disable-next-line typescript/no-misused-promises -- every failure is handled by the try/catch below
    server = createServer(async (req, res) => {
        try {
            const upstream = await fetch(UPSTREAM + req.url, { headers: { accept: String(req.headers.accept ?? '*/*') } });
            let body = Buffer.from(await upstream.arrayBuffer());
            if (newVersion && req.url?.startsWith('/sw.js')) body = Buffer.concat([body, Buffer.from('\n// new version\n')]);
            const headers: Record<string, string> = {};
            upstream.headers.forEach((value, key) => {
                if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key)) headers[key] = value;
            });
            res.writeHead(upstream.status, { ...headers, 'content-length': String(body.length) });
            res.end(body);
        } catch (error) {
            res.writeHead(502);
            res.end(String(error));
        }
    });
    await new Promise<void>(resolve => server.listen(PROXY_PORT, '127.0.0.1', resolve));
});

test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

test.beforeEach(() => { newVersion = false; });

/** Loads the app, waits for the service worker to take control of the page (precache finished). */
async function openControlled(page: import('@playwright/test').Page) {
    await openApp(page, { keepStorage: true });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await expect(page.getByTestId('play-toggle')).toBeVisible();
}

async function checkForUpdate(page: import('@playwright/test').Page) {
    newVersion = true;
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update(); });
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
}

test.describe('offline', () => {
    test('loads, sounds and keeps its settings without a connection', async ({ page, context, probe }) => {
        await openControlled(page);
        await setBpm(page, 90);

        await context.setOffline(true);
        await page.reload();
        await expect(page.getByTestId('play-toggle')).toBeVisible();
        await expect(page.getByTestId('bpm-input')).toHaveValue('90');

        await play(page);
        expect(await probe.listen(1.5), 'the precached samples sound offline').toBeGreaterThan(AUDIBLE);
        await stop(page);
    });
});

test.describe('update prompt', () => {
    test('offers the new version when stopped and reloads only when asked', async ({ page }) => {
        await openControlled(page);
        await page.evaluate(() => { (window as unknown as { __marker: number }).__marker = 1; });
        await checkForUpdate(page);

        const prompt = page.getByTestId('update-prompt');
        await expect(prompt).toBeVisible();
        await expect(prompt).toContainText('Hay una versión nueva');
        // Nothing reloads by itself.
        expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);

        await page.getByTestId('update-now').click();
        await page.waitForFunction(() => (window as unknown as { __marker?: number }).__marker === undefined);
        await expect(page.getByTestId('play-toggle')).toBeVisible();
    });

    test('never interrupts playback: waits until the metronome stops', async ({ page }) => {
        await openControlled(page);
        await play(page);
        await checkForUpdate(page);

        // Give the prompt every chance to appear while playing.
        await page.waitForTimeout(1000);
        await expect(page.getByTestId('update-prompt')).toHaveCount(0);
        await expect(page.getByTestId('play-toggle')).toHaveText(/DETENER/);

        await stop(page);
        await expect(page.getByTestId('update-prompt')).toBeVisible();
    });

    test('"Luego" dismisses it', async ({ page }) => {
        await openControlled(page);
        await checkForUpdate(page);
        await page.getByRole('button', { name: 'Luego' }).click();
        await expect(page.getByTestId('update-prompt')).toHaveCount(0);
    });
});
