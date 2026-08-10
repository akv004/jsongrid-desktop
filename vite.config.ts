import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
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
  plugins: [react()],
  // Tauri expects a fixed dev-server port and handles its own reload cycle
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    sourcemap: true,
  },
})
