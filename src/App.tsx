import { useEffect, useState, useCallback, useMemo } from 'react'
import EditorMonaco from './components/EditorMonaco'
import GridView from './components/GridView'
import { deriveGridData } from './utils/deriveGridData'
import { useDebounce } from '@/hooks/useDebounce'

const initialJson = `[
  { "id": 1, "name": "Alice", "active": true, "email": "alice@example.com" },
  { "id": 2, "name": "Bob",   "active": false, "email": "bob@example.com" },
  { "id": 3, "name": "Charlie", "active": true, "email": "charlie@example.com" }
]`

/**
 * @name App
 * @description The root component of the application, orchestrating the editor, grid view, and file operations.
 */
function App() {
  // This state updates immediately on every keystroke, keeping the editor responsive.
  const [text, setText] = useState(initialJson)
  const [filePath, setFilePath] = useState<string>()
  // ✅ FIX: Renamed state to be specific to file operation errors.
  const [fileError, setFileError] = useState<string | null>(null)
  const api = window.api

  // This debounced value will only update 300ms after the user stops typing.
  const debouncedText = useDebounce(text, 300)

  /**
   * ✅ FIX: Use useMemo to efficiently derive grid data and capture parsing errors.
   * This computation now only runs when the debounced text changes,
   * and it provides crucial feedback to the user if the JSON is invalid.
   */
  const { data: gridData, error: gridError } = useMemo(() => {
    return deriveGridData(debouncedText)
  }, [debouncedText])

  const openFile = useCallback(async (): Promise<void> => {
    try {
      setFileError(null)
      const res = await api?.openFile()
      if (res?.text) {
        setText(res.text)
        setFilePath(res.filePath)
      }
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e))
    }
  }, [api])

  const saveFile = useCallback(async (): Promise<void> => {
    try {
      setFileError(null)
      // When saving, always use the most up-to-date text, not the debounced version.
      const res = await api?.saveFile({ filePath, text })
      if (res?.filePath) setFilePath(res.filePath)
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e))
    }
  }, [api, filePath, text])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        void openFile()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveFile()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openFile, saveFile])

  useEffect(() => {
    if (api?.setTitle) {
      api.setTitle(filePath)
    }
  }, [api, filePath])

  return (
      <div style={{ padding: 16, height: '100vh', boxSizing: 'border-box' }}>
        <h1 style={{ marginTop: 0 }}>JSONGrid Desktop</h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <button onClick={openFile} disabled={!api}>
            Open (⌘/Ctrl+O)
          </button>
          <button onClick={saveFile} disabled={!api}>
            Save (⌘/Ctrl+S)
          </button>
          <span style={{ marginLeft: 16, color: '#555', fontFamily: 'monospace' }}>
          {filePath ? filePath : '(untitled)'}
        </span>
          {/* ✅ FIX: Display file operation errors or grid parsing errors in the header. */}
          {(fileError || gridError) && (
              <span
                  title={fileError || gridError || ''}
                  style={{ marginLeft: 16, color: '#b00020', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}
              >
            {fileError || gridError}
          </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, height: 'calc(100% - 110px)' }}>
          {/* Left: Monaco code editor. It uses the immediate `text` state for responsiveness. */}
          <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
            <EditorMonaco value={text} onChange={setText} />
          </div>

          {/* Right: Grid view panel */}
          <div style={{ width: '38%', border: '1px solid #ddd', borderRadius: 6, padding: 12, overflow: 'auto' }}>
            {/* ✅ FIX: Conditionally render the GridView or show the parsing error prominently. */}
            {gridError ? (
                <div style={{ color: '#b00020', fontFamily: 'monospace' }}>
                  <strong style={{ display: 'block', marginBottom: '8px' }}>Error Parsing Input</strong>
                  <div>{gridError}</div>
                </div>
            ) : (
                <GridView data={gridData} />
            )}
          </div>
        </div>
      </div>
  )
}

export default App