import { useEffect, useMemo, useRef } from 'react'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import JSON5 from 'json5'
import {
  FileJson,
  Play,
  Minimize2,
  CheckCircle,
  Trash2,
  Search,
  Maximize2,
  Minimize,
  Filter
} from 'lucide-react'

import { GridProvider, useGridContext } from './context/GridContext'
import EditorMonaco from './components/EditorMonaco'
import GridView, { GridViewHandle } from './components/GridView'
import { deriveGridData } from './utils/deriveGridData'
import { useDebounce } from './hooks/useDebounce'
import './styles.css'

export type JsonGridWorkspaceProps = {
  value: string
  onChange: (text: string) => void
  /** Optional JSON string loaded by the "Sample" toolbar button. Button is hidden when omitted. */
  sampleJson?: string
  /** Optional message shown in the JSON panel header (e.g. file errors from the host app). */
  errorMessage?: string | null
}

function WorkspaceInner({ value, onChange, sampleJson, errorMessage }: JsonGridWorkspaceProps) {
  const { triggerExpandAll, triggerCollapseAll, registerEditHandler } = useGridContext()
  const gridRef = useRef<GridViewHandle>(null)

  const debouncedText = useDebounce(value, 300)

  const { data: gridData, error: gridError } = useMemo(() => {
    return deriveGridData(debouncedText)
  }, [debouncedText])

  useEffect(() => {
    registerEditHandler((relativePath, newValue) => {
      if (!gridData) return
      try {
        const root = JSON5.parse(value)
        // gridData.pathArray starts with '$', skip it
        const basePath = gridData.pathArray[0] === '$' ? gridData.pathArray.slice(1) : gridData.pathArray
        const fullPath = [...basePath, ...relativePath]

        const setValue = (obj: unknown, p: (string | number)[], v: string): unknown => {
          if (p.length === 0) return v
          const [head, ...tail] = p
          const k = head

          const source = obj as Record<string | number, unknown>
          const clone = (Array.isArray(obj) ? [...obj] : { ...source }) as Record<string | number, unknown>

          if (tail.length === 0) {
            let finalValue: unknown = v
            const original = source[k]
            // Attempt to preserve type
            if (typeof original === 'number' && !isNaN(Number(v)) && v.trim() !== '') {
              finalValue = Number(v)
            } else if (typeof original === 'boolean') {
              if (v === 'true') finalValue = true
              if (v === 'false') finalValue = false
            }
            clone[k] = finalValue
          } else {
            clone[k] = setValue(source[k] || (typeof tail[0] === 'number' ? [] : {}), tail, v)
          }
          return clone
        }

        const newRoot = setValue(root, fullPath, newValue)
        onChange(JSON.stringify(newRoot, null, 2))
      } catch (e) {
        console.error('Failed to update JSON', e)
      }
    })
  }, [gridData, registerEditHandler, value, onChange])

  const handleFormat = () => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2))
    } catch {
      // ignore error
    }
  }

  const handleMinify = () => {
    try {
      onChange(JSON.stringify(JSON.parse(value)))
    } catch {
      // ignore error
    }
  }

  return (
    <Allotment>
      <Allotment.Pane minSize={300}>
        <div className="panel-container">
          <div className="panel-header">
            <span>JSON</span>
            {errorMessage && <span style={{ color: '#fca5a5', fontSize: 12 }}>{errorMessage}</span>}
          </div>
          <div className="toolbar">
            {sampleJson && (
              <button className="toolbar-btn" onClick={() => onChange(sampleJson)}>
                <FileJson size={14} /> Sample
              </button>
            )}
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
            <button className="toolbar-btn danger" onClick={() => onChange('')}>
              <Trash2 size={14} /> Clear
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <EditorMonaco value={value} onChange={onChange} />
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
  )
}

/**
 * Self-contained editor + grid dual pane. No platform dependencies — drop it
 * into any React app and control the JSON text via value/onChange.
 */
export function JsonGridWorkspace(props: JsonGridWorkspaceProps) {
  return (
    <GridProvider>
      <WorkspaceInner {...props} />
    </GridProvider>
  )
}

export default JsonGridWorkspace
