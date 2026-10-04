import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);

/**
 * Device projects run on Chromium with the device's touch/pointer emulation (iOS Safari itself is
 * checked by hand on the phone). Viewports are the ones the layouts are designed for.
 */
const chromiumDevice = (descriptor: keyof typeof devices, viewport: { width: number; height: number }) => ({
  ...devices[descriptor],
  defaultBrowserType: 'chromium' as const,
  viewport,
});

// Only the adaptive specs run on every viewport; the audio/controls specs stay on desktop.
const ADAPTIVE = /adaptive.*\.spec\.ts/;
const SERVICE_WORKER = /pwa-sw.*\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // audio timing assertions are more reliable without CPU contention
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 7_000, toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.02 } },
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    // The visual baselines and layout checks must not depend on the OS animation setting.
    reducedMotion: 'reduce',
    launchOptions: {
      args: [
        '--autoplay-policy=no-user-gesture-required',
        // The audio probe reads the Web Audio graph (AnalyserNode), not the speakers:
        // mute the device output so local runs don't play the metronome out loud.
        '--mute-audio',
      ],
      // Optional: reuse a locally installed Chromium instead of the one bundled with this Playwright version.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: [SERVICE_WORKER],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    // Phone (iPhone 15 emulation) portrait and landscape, plus the Pro Max-sized landscape.
    { name: 'iphone-portrait', testMatch: ADAPTIVE, use: chromiumDevice('iPhone 15', { width: 390, height: 844 }) },
    { name: 'iphone-landscape', testMatch: ADAPTIVE, use: chromiumDevice('iPhone 15 landscape', { width: 844, height: 390 }) },
    { name: 'iphone-max-landscape', testMatch: ADAPTIVE, use: chromiumDevice('iPhone 15 Pro Max landscape', { width: 932, height: 430 }) },
    // Tablet (iPad gen 11 emulation) in both orientations.
    { name: 'ipad-portrait', testMatch: ADAPTIVE, use: chromiumDevice('iPad (gen 11)', { width: 820, height: 1180 }) },
    { name: 'ipad-landscape', testMatch: ADAPTIVE, use: chromiumDevice('iPad (gen 11) landscape', { width: 1180, height: 820 }) },
    // Android phone on Chrome.
    { name: 'pixel-7', testMatch: ADAPTIVE, use: { ...devices['Pixel 7'] } },
    // The only project with real service workers: offline use and the update prompt.
    {
      name: 'pwa-service-worker',
      testMatch: SERVICE_WORKER,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, serviceWorkers: 'allow' },
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
