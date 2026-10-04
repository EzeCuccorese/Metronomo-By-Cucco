import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Reuses the production nginx security headers for `vite preview`, so the E2E suite
 * runs under the exact same Content-Security-Policy users get.
 */
function productionSecurityHeaders(): Record<string, string> {
  const conf = readFileSync(new URL('./deploy/security-headers.conf', import.meta.url), 'utf8')
  const headers: Record<string, string> = {}
  for (const match of conf.matchAll(/^add_header\s+(\S+)\s+"([^"]*)"/gm)) {
    headers[match[1]] = match[2]
  }
  return headers
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Both sample formats are precached (a few hundred KB each) so every instrument sounds
        // offline right after install, whichever format the browser ends up picking.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ogg,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      manifest: {
        id: '/',
        name: 'Metrónomo by Cucco',
        short_name: 'Metrónomo',
        description: 'Metrónomo profesional y entrenador rítmico con ritmos folclóricos.',
        lang: 'es',
        theme_color: '#13110f',
        background_color: '#070605',
        display: 'standalone',
        display_override: ['standalone'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['music', 'education'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        screenshots: [
          { src: 'screenshots/narrow-390x844.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Metrónomo en el teléfono: tempo, play y pulso' },
          { src: 'screenshots/wide-1440x900.png', sizes: '1440x900', type: 'image/png', form_factor: 'wide', label: 'Estudio rítmico completo en escritorio' }
        ]
      }
    })
  ],
  preview: {
    headers: productionSecurityHeaders()
  },
  build: {
    // Only the latest Safari (iOS/macOS) and Chrome are supported: no transpilation or polyfills.
    target: 'esnext',
    // Vite 8 bundles with Rolldown: vendor splitting is declared as code-splitting groups.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'mui', test: /node_modules[\\/](@mui|@emotion)[\\/]/ }
          ]
        }
      }
    }
  },
  test: {
    globals: true,
    // Full-app integration tests render the whole MUI tree; coverage instrumentation makes them slow.
    testTimeout: 20000,
    projects: [
      {
        // Hooks, UI and pure logic against jsdom with mocked Web Audio.
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.browser.test.{ts,tsx}']
        }
      },
      {
        // Real Web Audio in Chromium: renders audio with OfflineAudioContext and measures it.
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,tsx}'],
          browser: {
            enabled: true,
            headless: true,
            // Offline rendering makes no sound; --mute-audio keeps the headless browser silent on a dev machine anyway.
            provider: playwright({ launchOptions: { args: ['--mute-audio'] } }),
            instances: [{ browser: 'chromium' }]
          }
        }
      }
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.worker.ts',
        '**/*.d.ts',
        'src/main.tsx',
        'src/test/**'
      ],
      // Core logic is held to a high bar; canvas-heavy UI is covered by the Playwright suite (e2e/).
      thresholds: {
        lines: 60,
        functions: 55,
        branches: 55,
        statements: 60,
        'src/{audio,hooks,state,rhythms}/**': {
          lines: 95,
          functions: 95,
          branches: 85,
          statements: 95
        }
      }
    }
  }
})

