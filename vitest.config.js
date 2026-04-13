import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}', 'scripts/**/*.mjs'],
      exclude: [
        'src/test/**',
        'src/main.jsx',
        'src/components/MapView.jsx', // Leaflet requires browser — covered by e2e + mapHelpers
      ],
      thresholds: {
        'src/utils/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
        'src/components/**': { statements: 80, branches: 60, functions: 70, lines: 80 },
      },
    },
  },
})
