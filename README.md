# React + TypeScript + Vite





# JSONGrid Desktop (Electron + Vite + React)

A small desktop app to **view/edit JSON** on the left (Monaco editor) and show a **Grid** on the right (TanStack Table) by auto‑detecting the best array in your JSON.
 
---

## Why this README matters
Some Electron setups silently break when the **preload** script is emitted as ESM. This README documents the **correct CommonJS preload** and points to the exact places to edit if you see errors like:

```
SyntaxError: Cannot use import statement outside a module
Unable to load preload script: .../dist-electron/preload/preload.js
```

---

## Project layout (key files)

```
electron/
  main/main.ts                 # Electron main process (window, IPC)
  preload/preload.cjs          # ✅ CommonJS preload (contextBridge -> window.api)
  typings/ipc.ts               # Global TS types for window.api (optional)
src/
  components/EditorMonaco.tsx  # Monaco JSON editor
  components/GridView.tsx      # Grid (TanStack Table + react-virtual)
  App.tsx                      # UI wiring (Open/Save/Format + Grid)
vite.config.ts                 # Vite + vite-plugin-electron config
package.json                   # scripts, electron-builder targets
```

---

## Dev scripts

```bash
pnpm install
pnpm dev      # starts Vite + Electron (via vite-plugin-electron)
pnpm build    # builds renderer + electron bundles; then electron-builder
```

---

## Preload: the **only** correct pattern (CommonJS)

**Do not** use `import`/ESM in preload. Electron loads the file by path and expects CJS.

**electron/preload/preload.cjs**
```js
/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
console.log('[JSONGRID] ✅ preload.cjs loaded');

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (data) => ipcRenderer.invoke('file:save', data),
});
```

**electron/main/main.ts** (point to **.cjs**)
```ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'node:path'

// ...
const win = new BrowserWindow({
  webPreferences: {
    preload: join(__dirname, '../preload/preload.cjs'), // ✅ CJS file
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
})
console.log('[JSONGRID] preload path:', join(__dirname, '../preload/preload.cjs'))
```

> You may keep a `preload.ts` for type‑hinting, but **Electron must load** the `.cjs` file at runtime.

---

## Vite config (keep it simple)

We do **not** need to force ESM for preload. Either let `vite-plugin-electron` emit CJS or simply **not build preload for dev** and load `preload.cjs` directly as above.

**vite.config.ts** (excerpt)
```ts
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
// ...
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: { entry: 'electron/main/main.ts', onstart(o){ o.startup() } },
      // Preload may be omitted in dev (we load preload.cjs directly).
      // If you keep it, ensure it emits CJS and uses a stable filename:
      preload: {
        input: { preload: path.join(__dirname, 'electron/preload/preload.ts') },
        vite: {
          build: {
            sourcemap: true,
            outDir: 'dist-electron/preload',
            lib: {
              entry: path.join(__dirname, 'electron/preload/preload.ts'),
              formats: ['cjs'],
              name: 'preload',
            },
            rollupOptions: {
              output: { format: 'cjs', entryFileNames: 'preload.cjs' },
            },
          },
        },
      },
    }),
    renderer(),
  ],
})
```

---

## Troubleshooting checklist

1) **Buttons disabled?**  
   In DevTools Console run:  
   ```js
   typeof window.api         // should be "object"
   ```  
   If `undefined`, your preload isn’t running. Ensure `preload.cjs` exists and `main.ts` points to it.

2) **“Cannot use import statement outside a module”**  
   You are loading an ESM preload. Replace it with `preload.cjs` above and point main to it.

3) **Still looking for `preload.js`?**  
   Something in your config still references `preload.js`. Search the repo and replace with `preload.cjs`.

4) **Start from a clean build**  
   ```bash
   rm -rf dist-electron
   pnpm dev
   ```

---

## Grid not showing?

The grid only renders when the parsed JSON contains an **array of records**. Try one of these samples in the left editor:

```json
[
  { "id": 1, "name": "Alice", "active": true },
  { "id": 2, "name": "Bob",   "active": false }
]
```

```json
{
  "user": "Hartman Tyler",
  "friends": [
    { "id": 0, "name": "Anastasia Mclean" },
    { "id": 1, "name": "Douglas Marshall" },
    { "id": 2, "name": "Chris Stone" }
  ]
}
```

---

## Notes for AI tools (Copilot / IDE assistants)
- This project intentionally mixes **CJS (preload)** and **ESM/TS (renderer)** for Electron compatibility.
- The public interface exposed to the renderer is `window.api.{openFile, saveFile}`; maintain that contract.
- Do not suggest converting `require()` in `preload.cjs` to `import`.
- Security: keep `contextIsolation: true`, `nodeIntegration: false`, and avoid adding new Node globals to the renderer.