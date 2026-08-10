import { useEffect, useState, useCallback } from 'react'
import { FileJson, FolderOpen, Save } from 'lucide-react'

import { JsonGridWorkspace } from './lib'
import { fileHost } from './platform/fileHost'
import { sampleJson } from './sampleJson'
import './App.css'

function App() {
  const [text, setText] = useState(sampleJson)
  const [filePath, setFilePath] = useState<string>()
  const [fileError, setFileError] = useState<string | null>(null)

  const openFile = useCallback(async (): Promise<void> => {
    try {
      setFileError(null)
      const res = await fileHost.openFile()
      if (res?.text) {
        setText(res.text)
        setFilePath(res.filePath)
      }
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const saveFile = useCallback(async (): Promise<void> => {
    try {
      setFileError(null)
      const res = await fileHost.saveFile({ filePath, text })
      if (res?.filePath) setFilePath(res.filePath)
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e))
    }
  }, [filePath, text])

  useEffect(() => {
    void fileHost.setTitle(filePath)
  }, [filePath])

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

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-title">
          <FileJson size={20} />
          <span>JSONGrid Desktop</span>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={openFile} title="Open (⌘/Ctrl+O)">
            <FolderOpen size={16} /> Open
          </button>
          <button className="btn-primary" onClick={saveFile} title="Save (⌘/Ctrl+S)">
            <Save size={16} /> Save
          </button>
          {filePath && (
            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>
              {filePath}
            </span>
          )}
        </div>
      </header>

      <div className="main-content">
        <JsonGridWorkspace
          value={text}
          onChange={setText}
          sampleJson={sampleJson}
          errorMessage={fileError}
        />
      </div>
    </div>
  )
}

export default App
