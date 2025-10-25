import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // Added a path alias for cleaner imports (e.g., import Component from '@/components/...')
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    // Updated to the modern, array-based configuration for vite-plugin-electron
    electron([
      {
        // Main process entry file
        entry: 'electron/main/main.ts',
        onstart(options) {
          // This will start the Electron app once the main process is built
          options.startup()
        },
        vite: {
          build: {
            sourcemap: true,
            outDir: 'dist-electron/main',
          },
        },
      },
      {
        // Preload script entry file.
        // The path is now absolute to avoid ambiguity.
        entry: path.join(__dirname, 'electron/preload/preload.ts'),
        onstart(options) {
          // This will reload the renderer process whenever the preload script is changed,
          // instead of restarting the entire Electron app.
          options.reload()
        },
        vite: {
          build: {
            sourcemap: true,
            outDir: 'dist-electron/preload',
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    // This enables sourcemaps for the renderer process build
    sourcemap: true
  },
})