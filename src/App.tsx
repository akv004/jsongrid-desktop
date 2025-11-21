import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import JSON5 from 'json5'
import {
  FileJson,
  FolderOpen,
  Save,
  Play,
  Minimize2,
  CheckCircle,
  Trash2,
  Search,
  Maximize2,
  Minimize,
  Filter
} from 'lucide-react'
import { GridProvider } from './context/GridContext'
import { useGridContext } from './context/GridContext'

import EditorMonaco from './components/EditorMonaco'
import GridView, { GridViewHandle } from './components/GridView'
import { deriveGridData } from './utils/deriveGridData'
import { useDebounce } from '@/hooks/useDebounce'
import './App.css'

const initialJson = `[
	{
		"_id": "65ce58753546634a0dceb369",
		"guid": "7eac8b2b-6d0d-47b6-9370-e8ee5d95421c",
		"isActive": true,
		"tags": {
			"item": "et",
			"value": {
				"company": "Filodyne"
			}
		},
		"balance": "$2,839.71",
		"picture": "http://placehold.it/32x32",
		"age": 35,
		"eye Color": "brown",
		"name": "Hartman Tyler",
		"gender": "male",
		"company": "COGENTRY",
		"email": "hartmantyler@cogentry.com",
		"phone": "+1 (843) 467-2321",
		"friends": [
			{
				"id": 0,
				"name": "Anastasia Mclean"
			},
			{
				"id": 1,
				"name": "Douglas Marshall"
			},
			{
				"id": 2,
				"name": "Chris Stone"
			}
		],
		"address": "494 Gain Court, Wilmington, Guam, 9348",
		"registered": "2018-07-22T10:00:39 +04:00",
		"latitude": -37.13536,
		"longitude": -116.583092,
		"greeting": "Hello, Hartman Tyler! You have 1 unread messages.",
		"favoriteFruit": "strawberry"
	},
	{
		"_id": "65ce587519ec6121a04ba950",
		"guid": "eb5afd03-c2fb-4344-9507-f71541593a15",
		"isActive": false,
		"tags": {
			"item": "est",
			"value": {
				"company": "Affluex"
			}
		},
		"balance": "$1,442.27",
		"picture": "http://placehold.it/32x32",
		"age": 35,
		"eye Color": "green",
		"name": "Malinda Jarvis",
		"gender": "female",
		"company": "OVATION",
		"email": "malindajarvis@ovation.com",
		"phone": "+1 (994) 436-2250",
		"friends": [
			{
				"id": 0,
				"name": "Carmella Cleveland"
			},
			{
				"id": 1,
				"name": "Mariana Moody"
			},
			{
				"id": 2,
				"name": "Marcia Tillman"
			}
		],
		"address": "810 Lawn Court, Yettem, Mississippi, 8470",
		"registered": "2014-06-30T01:51:15 +04:00",
		"latitude": 78.030851,
		"longitude": -135.193892,
		"greeting": "Hello, Malinda Jarvis! You have 10 unread messages.",
		"favoriteFruit": "banana"
	}
]`

function App() {
  const [text, setText] = useState(initialJson)
  const [filePath, setFilePath] = useState<string>()
  const [fileError, setFileError] = useState<string | null>(null)
  const api = window.api
  const { triggerExpandAll, triggerCollapseAll, registerEditHandler } = useGridContext()
  const gridRef = useRef<GridViewHandle>(null)

  const debouncedText = useDebounce(text, 300)

  /**
   * Use useMemo to efficiently derive grid data and capture parsing errors.
   */
  const { data: gridData, error: gridError } = useMemo(() => {
    return deriveGridData(debouncedText)
  }, [debouncedText])

  useEffect(() => {
    registerEditHandler((relativePath, value) => {
      if (!gridData) return
      try {
        const root = JSON5.parse(text)
        // gridData.pathArray starts with '$', skip it
        const basePath = gridData.pathArray[0] === '$' ? gridData.pathArray.slice(1) : gridData.pathArray
        const fullPath = [...basePath, ...relativePath]

        const setValue = (obj: any, p: (string | number)[], v: any): any => {
          if (p.length === 0) return v
          const [head, ...tail] = p
          const k = head

          const clone = Array.isArray(obj) ? [...obj] : { ...obj }

          if (tail.length === 0) {
            let finalValue = v
            const original = obj[k]
            // Attempt to preserve type
            if (typeof original === 'number' && !isNaN(Number(v)) && v.trim() !== '') {
              finalValue = Number(v)
            } else if (typeof original === 'boolean') {
              if (v === 'true') finalValue = true
              if (v === 'false') finalValue = false
            }
            clone[k] = finalValue
          } else {
            clone[k] = setValue(obj[k] || (typeof tail[0] === 'number' ? [] : {}), tail, v)
          }
          return clone
        }

        const newRoot = setValue(root, fullPath, value)
        setText(JSON.stringify(newRoot, null, 2))
      } catch (e) {
        console.error("Failed to update JSON", e)
      }
    })
  }, [gridData, registerEditHandler, text])

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
      const res = await api?.saveFile({ filePath, text })
      if (res?.filePath) setFilePath(res.filePath)
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e))
    }
  }, [api, filePath, text])

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(text)
      setText(JSON.stringify(parsed, null, 2))
    } catch (e) {
      // ignore error
    }
  }

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(text)
      setText(JSON.stringify(parsed))
    } catch (e) {
      // ignore error
    }
  }

  const handleClear = () => {
    setText('')
  }

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
      {/* Header */}
      <header className="app-header">
        <div className="app-title">
          <FileJson size={20} />
          <span>JSONGrid Desktop</span>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={openFile} disabled={!api} title="Open (⌘/Ctrl+O)">
            <FolderOpen size={16} /> Open
          </button>
          <button className="btn-primary" onClick={saveFile} disabled={!api} title="Save (⌘/Ctrl+S)">
            <Save size={16} /> Save
          </button>
          {filePath && (
            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>
              {filePath}
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        <Allotment>
          <Allotment.Pane minSize={300}>
            <div className="panel-container">
              <div className="panel-header">
                <span>JSON</span>
                {fileError && <span style={{ color: '#fca5a5', fontSize: 12 }}>{fileError}</span>}
              </div>
              <div className="toolbar">
                <button className="toolbar-btn" onClick={() => setText(initialJson)}>
                  <FileJson size={14} /> Sample
                </button>
                <button className="toolbar-btn" onClick={handleFormat}>
                  <Play size={14} /> Format
                </button>
                <button className="toolbar-btn" onClick={handleMinify}>
                  <Minimize2 size={14} /> Minify
                </button>
                {/* Validate is implicit with Monaco, but we could add explicit check */}
                <button className="toolbar-btn" title="Validation is automatic">
                  <CheckCircle size={14} /> Validate
                </button>
                <div style={{ flex: 1 }} />
                <button className="toolbar-btn danger" onClick={handleClear}>
                  <Trash2 size={14} /> Clear
                </button>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <EditorMonaco value={text} onChange={setText} />
              </div>
            </div>
          </Allotment.Pane>

          <Allotment.Pane minSize={300}>
            <div className="panel-container">
              <div className="panel-header">
                <span>GRID</span>
              </div>
              <div className="toolbar">
                <div className="toolbar-group">
                  <button className="toolbar-btn" disabled>
                    <Filter size={14} />
                    Advanced Filter
                  </button>
                  <div className="search-container">
                    <Search size={14} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search..."
                      className="search-input"
                      onChange={(e) => gridRef.current?.setGlobalFilter(e.target.value)}
                    />
                  </div>
                </div>
                <div className="toolbar-group">
                  <button className="toolbar-btn" onClick={triggerExpandAll}>
                    <Maximize2 size={14} />
                    Expand All
                  </button>
                  <button className="toolbar-btn" onClick={triggerCollapseAll}>
                    <Minimize size={14} />
                    Collapse All
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {gridError ? (
                  <div style={{ padding: 20, color: '#dc2626' }}>
                    <strong>Error Parsing Input</strong>
                    <p>{gridError}</p>
                  </div>
                ) : (
                  <GridView
                    ref={gridRef}
                    data={gridData}
                    key={`${gridData?.path}-${gridData?.columns.length}`}
                  />
                )}
              </div>
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  )
}

export default App