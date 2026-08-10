# jsongrid lib

Reusable, platform-free React components for the JSON grid. Nothing in this
directory may import Tauri, Node, or any desktop API — it must work in any
React 19 app.

## Usage in another React project

Copy `src/lib/` into the project (or add this repo as a git submodule / publish
as a package later) and install the peer dependencies:

```
pnpm add @monaco-editor/react monaco-editor @tanstack/react-table \
  @tanstack/react-virtual allotment json5 lucide-react
```

Then render the whole dual-pane workspace:

```tsx
import { JsonGridWorkspace } from './lib'

function MyPage() {
  const [text, setText] = useState('{}')
  return <JsonGridWorkspace value={text} onChange={setText} />
}
```

Or compose the pieces individually (`GridView`, `EditorMonaco`, `GridProvider`,
`deriveGridData`) — see `index.ts` for the full export surface.

File open/save, window title, and keyboard shortcuts are deliberately NOT in
here — they live in the app shell (`src/App.tsx` + `src/platform/fileHost.ts`).
