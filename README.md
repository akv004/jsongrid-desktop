# JSONGrid Desktop (Tauri 2 + React 19)

A desktop app to **view/edit JSON** on the left (Monaco editor) and explore it as a **grid**
on the right (TanStack Table + Virtual). The grid auto-detects the best array of records
anywhere in the JSON (tolerant parsing: JSON5 and JSONL supported).

Built with **Tauri 2** (Rust shell, ~10 MB installer) — migrated from Electron; the last
Electron state is tagged `v0.1.2-electron-final`.

---

## Features

- Monaco JSON editor with format / minify / validate / clear
- Auto-derived grid: best array selection, column inference, path display (`$[0].tags`)
- Virtualized rows (handles large arrays), sorting, global search, column resize
- **Nested objects/arrays**: cells show a compact `Object {n}` / `Array [n]` chip; clicking
  opens a **full-width detail panel beneath the row** — readable at any column width,
  sticky-left while scrolling horizontally, nested tables expand inline inside it
- **Inline editing**: click any primitive value (in cells or detail panels); edits are
  written back to the exact JSON path in the editor
- Expand All / Collapse All, CSV export
- File open/save via native dialogs, Ctrl/Cmd+O and Ctrl/Cmd+S, window title tracks file

---

## Project layout

```
src-tauri/                     # Rust shell (Tauri 2) — no custom commands, plugins only
  tauri.conf.json              # window, bundle, dev/build commands
  capabilities/default.json    # dialog + fs + set-title permissions
src/
  lib/                         # ★ Reusable, platform-free React components
    JsonGridWorkspace.tsx      #   Editor + grid dual pane (drop into any React app)
    components/                #   GridView, NestedGrid, EditorMonaco
    context/GridContext.tsx    #   Expand/collapse tokens + edit dispatch
    utils/deriveGridData.ts    #   JSON → grid derivation (tolerant parsing)
    index.ts                   #   Barrel export — see src/lib/README.md for reuse docs
  platform/fileHost.ts         # FileHost interface: Tauri impl + browser fallback
  App.tsx                      # Thin shell: header, open/save, shortcuts, title
```

Everything under `src/lib/` must stay free of Tauri/Node imports — it is designed to be
reused in other React projects (see `src/lib/README.md` for peer deps and usage).

---

## Dev scripts

```bash
pnpm install
pnpm dev        # tauri dev: Vite + Rust shell + native window
pnpm dev:web    # Vite only — runs in a browser with file-input/download fallback
pnpm build      # tauri build: production bundles (deb/rpm/AppImage on Linux)
pnpm typecheck
pnpm lint
```

Linux build deps: Rust toolchain + `libwebkit2gtk-4.1-dev` (standard Tauri 2 prerequisites).

---

## Architecture notes

- **File access**: `src/platform/fileHost.ts` wraps `@tauri-apps/plugin-dialog` +
  `@tauri-apps/plugin-fs`. In a plain browser (`pnpm dev:web`) it falls back to an
  `<input type=file>` / blob-download implementation, so the whole app also works as a
  web app. Detection via `__TAURI_INTERNALS__`.
- **WebKitGTK gotcha**: virtualized tables must use the `display: grid`/`flex` table
  pattern. Absolutely-positioned `<tr>` inside a real `<table>` renders fine in Chromium
  but collapses column layout in WebKitGTK (Tauri's Linux webview). See `GridView.tsx`.
- **Nested detail panels**: expansion state lives in `GridView` (`Set<"rowId::colKey">`),
  panels render as full-width cells in the same measured virtual row, so dynamic row
  heights stay correct.
- **Edit paths**: cell editors receive base path `[rowIndex, columnKey]`; `NestedGrid`
  appends keys/indices recursively; `JsonGridWorkspace` applies the edit immutably and
  re-serializes.

---

## Grid not showing?

The grid renders when the parsed JSON contains an **array of records**. Try:

```json
[
  { "id": 1, "name": "Alice", "active": true },
  { "id": 2, "name": "Bob",   "active": false }
]
```

Nested arrays work too — the best candidate array is auto-selected and its path shown
in the grid info bar.
