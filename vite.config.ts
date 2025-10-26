import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    electron([
      {
        // Main-process entry file of the Electron App.
        entry: 'electron/main/main.ts',
        async onstart(options) {
          await options.startup()
        },
        vite: {
          build: {
            sourcemap: true,
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                format: 'cjs',
                // ✅ FIX: This line is the crucial change.
                // It instructs Vite/Rollup to create the output file at `main/main.js`
                // inside the `outDir`, which matches the "main" entry in your package.json.
                entryFileNames: 'main/main.js',
              },
            },
          },
        },
      },
      {
        // Preload-script entry file.
        entry: path.join(__dirname, 'electron/preload/preload.ts'),
        onstart(options) {
          // Reload the renderer process whenever the preload script is changed,
          // instead of restarting the entire Electron app.
          options.reload()
        },
        vite: {
          build: {
            sourcemap: 'inline',
            outDir: 'dist-electron',
            lib: {
              entry: path.join(__dirname, 'electron/preload/preload.ts'),
              formats: ['cjs'],
            },
            rollupOptions: {
              output: {
                entryFileNames: 'preload.cjs',
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    sourcemap: true,
  },
})