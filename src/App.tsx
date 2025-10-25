import { useEffect, useState, useCallback } from 'react'
import EditorMonaco from './components/EditorMonaco'

function App() {
  const [text, setText] = useState('{\n  "hello": "world"\n}')
  const [filePath, setFilePath] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const api = window.api

  const openFile = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      const res = await api?.openFile()
      if (res?.text) { setText(res.text); setFilePath(res.filePath) }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [api])

  const saveFile = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      const res = await api?.saveFile({ filePath, text })
      if (res?.filePath) setFilePath(res.filePath)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [api, filePath, text])

  const pretty = () => {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2))
    } catch { }
  }
  const minify = () => {
    try {
      setText(JSON.stringify(JSON.parse(text)))
    } catch { }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); void openFile() }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void saveFile() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openFile, saveFile])

  return (
      <div style={{ padding: 16, height: '100vh', boxSizing: 'border-box' }}>
        <h1 style={{ marginTop: 0 }}>JSONGrid Desktop (starter)</h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <button onClick={openFile} disabled={!api}>Open (⌘/Ctrl+O)</button>
          <button onClick={saveFile} disabled={!api}>Save (⌘/Ctrl+S)</button>
          <span style={{ marginLeft: 16, color: '#555', fontFamily: 'monospace' }}>
        {filePath ? filePath : '(untitled)'}
      </span>
          {error && <span style={{ marginLeft: 16, color: '#b00020' }}>{error}</span>}
        </div>

        <div style={{ display: 'flex', gap: 12, height: 'calc(100% - 110px)' }}>
          {/* Left: Monaco code editor */}
          <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
            <EditorMonaco value={text} onChange={setText} />
          </div>

          {/* Right: placeholder for next steps (Tree/Grid) */}
          <div style={{ width: '38%', border: '1px dashed #ddd', borderRadius: 6, padding: 12 }}>
            <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
              <button onClick={pretty}>Format</button>
              <button onClick={minify}>Minify</button>
            </div>
            <p style={{ marginTop: 0 }}>
              Next panel will become: <strong>Tree</strong> (JSONEditor) and then <strong>Grid</strong>.
            </p>
            <p style={{ color: '#666' }}>For now, use the left editor to paste or edit JSON.</p>
          </div>
        </div>
      </div>
  )
}

export default App