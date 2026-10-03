import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
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
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Audio samples (wav + ogg + m4a) are precached: the folk instruments must sound offline too.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,wav,ogg,m4a,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      manifest: {
        name: 'Metrónomo by Cucco',
        short_name: 'Metrónomo',
        description: 'Metrónomo profesional y entrenador rítmico con ritmos folclóricos.',
        lang: 'es',
        theme_color: '#13110f',
        background_color: '#070605',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['music', 'education'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
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
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Full-app integration tests render the whole MUI tree; coverage instrumentation makes them slow.
    testTimeout: 20000,
    include: ['src/**/*.test.{ts,tsx}'],
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

