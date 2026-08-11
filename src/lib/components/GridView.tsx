import React, { useMemo, useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  useReactTable,
  Row,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { DeriveResult, GridRow, isComplexCell } from '../utils/deriveGridData'
import NestedGrid from './NestedGrid'
import { useGridContext } from '../context/GridContext'

type Props = {
  data: DeriveResult | null
  rowHeight?: number
}

export type GridViewHandle = {
  expandAll: () => void
  collapseAll: () => void
  setGlobalFilter: (value: string) => void
}

/** Widest a column may auto-grow to fit expanded nested content */
const MAX_AUTO_WIDTH = 560
/** Horizontal padding of a td (12px left + 12px right) plus a small buffer */
const CELL_PADDING = 26

/**
 * @name exportCSV
 * @description A simple CSV export utility that does not require extra dependencies.
 */
function exportCSV(rows: Row<GridRow>[], columns: string[], filename: string) {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (/["\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const head = columns.join(',')
  // Only export top-level rows
  const body = rows
    .filter((r) => r.depth === 0)
    .map((r) => columns.map((c) => esc(r.original[c])).join(','))
    .join('\n')

  const csv = `${head}\n${body}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * Wraps complex-cell content and reports its natural width so the host
 * column can auto-grow when nested content is expanded (jsongrid.com style).
 */
function MeasuredCell({
  reportKey,
  onWidth,
  children,
}: {
  reportKey: string
  onWidth: (key: string, width: number | null) => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const report = () => onWidth(reportKey, el.scrollWidth)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => {
      ro.disconnect()
      onWidth(reportKey, null)
    }
  }, [reportKey, onWidth])

  return (
    <div ref={ref} style={{ width: 'fit-content', maxWidth: '100%' }}>
      {children}
    </div>
  )
}

/**
 * @name GridView
 * @description A virtualized, sortable, and filterable data grid. Object/array cells
 * expand inline (jsongrid.com style): the column auto-grows to fit nested content,
 * and clicking any node highlights the matching line in the JSON editor.
 */
const GridView = forwardRef<GridViewHandle, Props>(({ data, rowHeight = 34 }, ref) => {
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const { onSelectPath } = useGridContext()

  const rows = data?.rows ?? []
  const columnKeys = useMemo(() => data?.columns.map((c) => c.key) ?? [], [data?.columns])
  // Synthetic 'value' column means rows are raw array elements, not objects
  const isPrimitiveArray = columnKeys.length === 1 && columnKeys[0] === 'value'

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  // Natural content width per expanded complex cell, keyed by `${rowId}::${colKey}`
  const [cellWidths, setCellWidths] = useState<Record<string, number>>({})
  const [selectedCell, setSelectedCell] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    expandAll: () => { },
    collapseAll: () => { },
    setGlobalFilter: (value: string) => setGlobalFilter(value),
  }))

  const handleWidth = useCallback((key: string, width: number | null) => {
    setCellWidths((prev) => {
      if (width === null) {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      }
      const current = prev[key]
      if (current !== undefined && Math.abs(current - width) < 2) return prev
      return { ...prev, [key]: width }
    })
  }, [])

  // Per-column auto width = widest expanded cell in that column
  const autoWidths = useMemo(() => {
    const m: Record<string, number> = {}
    for (const [key, w] of Object.entries(cellWidths)) {
      const col = key.split('::')[1]
      m[col] = Math.max(m[col] ?? 0, w)
    }
    return m
  }, [cellWidths])

  const basePathFor = useCallback(
    (row: Row<GridRow>, colKey: string): (string | number)[] =>
      isPrimitiveArray ? [row.index] : [row.index, colKey],
    [isPrimitiveArray]
  )

  const columns = useMemo<ColumnDef<GridRow>[]>(() => {
    return columnKeys.map((key, i) => ({
      accessorKey: key,
      header: () => key,
      size: i === 0 ? 250 : 150,
      cell: ({ row, getValue }) => {
        const value = getValue()
        const path = basePathFor(row, key)
        if (isComplexCell(value)) {
          return (
            <MeasuredCell reportKey={`${row.id}::${key}`} onWidth={handleWidth}>
              <NestedGrid data={value} path={path} />
            </MeasuredCell>
          )
        }
        return <NestedGrid data={value} path={path} />
      },
    }))
  }, [columnKeys, basePathFor, handleWidth])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    globalFilterFn: (row, _columnId, filterValue: string) => {
      if (!filterValue) return true
      const q = filterValue.toLowerCase()
      for (const k of columnKeys) {
        const v = row.original[k]
        if (v != null && String(v).toLowerCase().includes(q)) return true
      }
      return false
    },
  })

  // Effective column width: manual/base size, grown to fit expanded content (capped)
  const effectiveWidth = useCallback(
    (colId: string, baseSize: number) => {
      const auto = autoWidths[colId]
      if (!auto) return baseSize
      return Math.max(baseSize, Math.min(auto + CELL_PADDING, MAX_AUTO_WIDTH))
    },
    [autoWidths]
  )

  const totalWidth = useMemo(
    () =>
      table
        .getAllLeafColumns()
        .reduce((sum, col) => sum + effectiveWidth(col.id, col.getSize()), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, effectiveWidth, table.getState().columnSizing]
  )

  const { rows: tableRows } = table.getRowModel()
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  })

  if (!data) {
    return (
      <div style={{ color: '#666', padding: 20, textAlign: 'center', marginTop: 40 }}>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No tabular data detected</div>
        <div style={{ fontSize: 14, color: '#9ca3af' }}>
          Paste a JSON array of objects to view it as a grid.
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {/* Info bar */}
      <div style={{
        padding: '4px 8px',
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        fontSize: 11,
        color: '#6b7280',
        display: 'flex',
        gap: 12
      }}>
        <span>Path: <strong>{data.path}</strong></span>
        <span>Rows: <strong>{rows.length}</strong></span>
        <span>Columns: <strong>{columnKeys.length}</strong></span>
        <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#3b82f6' }} onClick={() => exportCSV(table.getCoreRowModel().rows, columnKeys, 'grid.csv')}>
          Export CSV
        </span>
      </div>

      {/* Table container */}
      {/* display:grid/flex table — absolutely-positioned <tr> inside a real table
          breaks column layout on WebKitGTK (Tauri's Linux webview) */}
      <div ref={tableContainerRef} style={{ overflow: 'auto', flex: 1, background: 'white' }}>
        <table style={{ display: 'grid', width: totalWidth, borderSpacing: 0 }}>
          <thead style={{ display: 'grid', background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 1 }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} style={{ display: 'flex', width: '100%' }}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{
                      display: 'flex',
                      flexShrink: 0,
                      width: effectiveWidth(header.column.id, header.getSize()),
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderBottom: '1px solid #e5e7eb',
                      borderRight: '1px solid #f3f4f6',
                      userSelect: 'none',
                      position: 'relative',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.025em',
                      boxSizing: 'border-box'
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        height: '100%',
                        width: 4,
                        background: header.column.getIsResizing() ? '#3b82f6' : 'transparent',
                        cursor: 'col-resize',
                        userSelect: 'none',
                        touchAction: 'none',
                      }}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody style={{ display: 'grid', height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = tableRows[virtualRow.index]
              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    background: virtualRow.index % 2 === 0 ? 'white' : '#f9fafb',
                  }}
                  className="grid-row"
                >
                  {row.getVisibleCells().map((cell) => {
                    const cellKey = `${row.id}::${cell.column.id}`
                    return (
                      <td
                        key={cell.id}
                        onClick={(e) => {
                          setSelectedCell(cellKey)
                          // Deeper NestedGrid nodes select their own (deeper) path
                          if (!e.defaultPrevented) onSelectPath(basePathFor(row, cell.column.id))
                        }}
                        style={{
                          display: 'block',
                          flexShrink: 0,
                          width: effectiveWidth(cell.column.id, cell.column.getSize()),
                          padding: '8px 12px',
                          borderBottom: '1px solid #f3f4f6',
                          borderRight: '1px solid #f9fafb',
                          verticalAlign: 'top',
                          fontSize: 13,
                          wordBreak: 'break-word',
                          boxSizing: 'border-box',
                          overflowX: 'auto',
                          background: selectedCell === cellKey ? '#fef9c3' : undefined,
                          cursor: 'default',
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
})

export default GridView
