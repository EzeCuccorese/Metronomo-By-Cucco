import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // audio timing assertions are more reliable without CPU contention
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: ['--autoplay-policy=no-user-gesture-required'],
          // Optional: reuse a locally installed Chromium instead of the one bundled with this Playwright version.
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
        },
      },
    },
    {
      // UI and PWA smoke tests on WebKit (the engine behind Safari). Playwright's WebKit is not iOS Safari and
      // its audio output can't be probed the way Chromium's can, so the real-audio specs stay Chromium-only;
      // audio on iOS is verified by hand on a device.
      name: 'desktop-webkit',
      testIgnore: ['**/audio.spec.ts', '**/piano.spec.ts'],
      // These walk the transport by audio time (count-in bars, tempo steps): too timing-sensitive on a loaded CI box.
      grepInvert: /folk forms walk|speed trainer raises/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // The production bundle is what users get; `vite preview` serves it with the nginx security headers.
    command: `pnpm build && pnpm exec vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
