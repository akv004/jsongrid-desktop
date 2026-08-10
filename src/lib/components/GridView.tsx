import React, { useMemo, useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
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
import { DeriveResult, GridRow, isComplexCell, ComplexCell } from '../utils/deriveGridData'
import { PlusSquare, MinusSquare, X } from 'lucide-react'
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

function detailKey(rowId: string, colKey: string) {
  return `${rowId}::${colKey}`
}

/** Compact trigger rendered inside the cell for object/array values */
function CellExpander({ cell, open, onToggle }: { cell: ComplexCell; open: boolean; onToggle: () => void }) {
  const label = cell.type === 'array' ? `Array [${cell.itemCount ?? ''}]` : `Object {${cell.itemCount ?? ''}}`
  return (
    <button
      onClick={onToggle}
      title={open ? 'Collapse details' : 'Expand details below the row'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: `1px solid ${open ? '#93c5fd' : '#e5e7eb'}`,
        background: open ? '#eff6ff' : 'white',
        color: '#3b82f6',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'monospace',
      }}
    >
      {open ? <MinusSquare size={13} /> : <PlusSquare size={13} />}
      <span style={{ color: '#6b7280' }}>{label}</span>
    </button>
  )
}

/**
 * @name GridView
 * @description A virtualized, sortable, and filterable data grid. Object/array cells
 * expand into a full-width detail panel beneath the row (readable at any column width).
 */
const GridView = forwardRef<GridViewHandle, Props>(({ data, rowHeight = 34 }, ref) => {
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const { expandAllToken, collapseAllToken } = useGridContext()

  const rows = data?.rows ?? []
  const columnKeys = useMemo(() => data?.columns.map((c) => c.key) ?? [], [data?.columns])
  // Synthetic 'value' column means rows are raw array elements, not objects
  const isPrimitiveArray = columnKeys.length === 1 && columnKeys[0] === 'value'

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  // Open detail panels, keyed by `${rowId}::${columnKey}`
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set())
  const [containerWidth, setContainerWidth] = useState(0)

  useImperativeHandle(ref, () => ({
    expandAll: () => { },
    collapseAll: () => { },
    setGlobalFilter: (value: string) => setGlobalFilter(value),
  }))

  // Keep detail panels within the visible viewport width
  useEffect(() => {
    const el = tableContainerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Global expand/collapse: open/close every complex cell's detail panel
  useEffect(() => {
    if (expandAllToken === 0) return
    const all = new Set<string>()
    rows.forEach((r, i) => {
      columnKeys.forEach((k) => {
        if (isComplexCell(r[k])) all.add(detailKey(String(i), k))
      })
    })
    setOpenDetails(all)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandAllToken])

  useEffect(() => {
    if (collapseAllToken === 0) return
    setOpenDetails(new Set())
  }, [collapseAllToken])

  const toggleDetail = (rowId: string, colKey: string) => {
    setOpenDetails((prev) => {
      const next = new Set(prev)
      const key = detailKey(rowId, colKey)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const basePathFor = (row: Row<GridRow>, colKey: string): (string | number)[] =>
    isPrimitiveArray ? [row.index] : [row.index, colKey]

  const columns = useMemo<ColumnDef<GridRow>[]>(() => {
    return columnKeys.map((key, i) => ({
      accessorKey: key,
      header: () => key,
      size: i === 0 ? 250 : 150,
      cell: ({ row, getValue }) => {
        const value = getValue()
        if (isComplexCell(value)) {
          return (
            <CellExpander
              cell={value}
              open={openDetails.has(detailKey(row.id, key))}
              onToggle={() => toggleDetail(row.id, key)}
            />
          )
        }
        return <NestedGrid data={value} path={basePathFor(row, key)} />
      },
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnKeys, openDetails, isPrimitiveArray])

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
        <table style={{ display: 'grid', width: table.getTotalSize(), borderSpacing: 0 }}>
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
                      width: header.getSize(),
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
              const openCols = columnKeys.filter((k) => openDetails.has(detailKey(row.id, k)))
              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    background: virtualRow.index % 2 === 0 ? 'white' : '#f9fafb',
                  }}
                  className="grid-row"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{
                        display: 'block',
                        flexShrink: 0,
                        width: cell.column.getSize(),
                        padding: '8px 12px',
                        borderBottom: openCols.length ? 'none' : '1px solid #f3f4f6',
                        borderRight: '1px solid #f9fafb',
                        verticalAlign: 'top',
                        fontSize: 13,
                        wordBreak: 'break-word',
                        boxSizing: 'border-box'
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}

                  {/* Full-width detail panels for expanded object/array cells */}
                  {openCols.map((colKey) => {
                    const cellValue = row.original[colKey]
                    if (!isComplexCell(cellValue)) return null
                    return (
                      <td
                        key={`detail-${colKey}`}
                        style={{
                          display: 'block',
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '0 12px 10px',
                          borderBottom: '1px solid #e5e7eb',
                          background: 'inherit',
                        }}
                      >
                        {/* sticky-left keeps the panel visible while scrolling wide tables */}
                        <div style={{
                          position: 'sticky',
                          left: 12,
                          width: containerWidth ? containerWidth - 24 : '100%',
                          boxSizing: 'border-box',
                          border: '1px solid #bfdbfe',
                          borderRadius: 6,
                          background: '#f8fafc',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            background: '#eff6ff',
                            borderBottom: '1px solid #bfdbfe',
                            fontSize: 11,
                          }}>
                            <span style={{ color: '#1d4ed8', fontWeight: 600, fontFamily: 'monospace' }}>
                              {isPrimitiveArray ? `[${row.index}]` : `[${row.index}].${colKey}`}
                            </span>
                            <span style={{ color: '#6b7280' }}>
                              {cellValue.type === 'array' ? `Array [${cellValue.itemCount ?? ''}]` : `Object {${cellValue.itemCount ?? ''}}`}
                            </span>
                            <button
                              onClick={() => toggleDetail(row.id, colKey)}
                              title="Close"
                              style={{
                                marginLeft: 'auto',
                                display: 'inline-flex',
                                alignItems: 'center',
                                border: 'none',
                                background: 'transparent',
                                color: '#6b7280',
                                cursor: 'pointer',
                                padding: 2,
                              }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div style={{ padding: 8, maxHeight: 420, overflow: 'auto', background: 'white' }}>
                            <NestedGrid
                              data={cellValue}
                              bare
                              path={basePathFor(row, colKey)}
                            />
                          </div>
                        </div>
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
