import React, { useMemo, useRef, useImperativeHandle, forwardRef } from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  SortingState,
  ExpandedState,
  useReactTable,
  Row,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { DeriveResult, GridRow, isComplexCell, ComplexCell } from '../utils/deriveGridData'
import { ChevronRight, ChevronDown, PlusSquare, MinusSquare } from 'lucide-react'
import NestedGrid from './NestedGrid'

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

/**
 * @name GridView
 * @description A virtualized, sortable, and filterable data grid with resizable columns and expandable rows for nested data.
 */
const GridView = forwardRef<GridViewHandle, Props>(({ data, rowHeight = 34 }, ref) => {
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const rows = data?.rows ?? []
  const columnKeys = useMemo(() => data?.columns.map((c) => c.key) ?? [], [data?.columns])

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [expanded, setExpanded] = React.useState<ExpandedState>({})

  useImperativeHandle(ref, () => ({
    expandAll: () => { }, // No-op for now as we switched to inline expansion
    collapseAll: () => { }, // No-op
    setGlobalFilter: (value: string) => setGlobalFilter(value),
  }))



  /**
   * ✅ CRITICAL FIX: The column definition is now hierarchical.
   * It creates a special first column that handles both the expander icon and renders
   * content differently for top-level rows vs. nested key-value sub-rows.
   */
  const columns = useMemo<ColumnDef<GridRow>[]>(() => {
    const firstKey = columnKeys[0]

    const firstCol: ColumnDef<GridRow> = {
      id: 'expander-and-content',
      header: () => firstKey || 'Data',
      size: 250,
      cell: ({ row }) => {
        // For top-level rows, display the value of the first column
        const value = firstKey ? row.original[firstKey] : ''

        // Use NestedGrid for complex cells, but pass the value directly
        // If it's a complex cell, NestedGrid handles it.
        // If it's a primitive, NestedGrid handles it too (as an input box).
        return <NestedGrid data={value} />
      },
    }

    // The rest of the columns, which will be blank for sub-rows
    const otherCols: ColumnDef<GridRow>[] = columnKeys.slice(1).map((key) => ({
      accessorKey: key,
      header: () => key,
      cell: (info) => {
        const value = info.getValue()
        return <NestedGrid data={value} />
      },
      size: 150,
    }))

    return [firstCol, ...otherCols]
  }, [columnKeys])

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
      <div ref={tableContainerRef} style={{ overflow: 'auto', flex: 1, background: 'white' }}>
        <table style={{ width: table.getTotalSize(), borderSpacing: 0, tableLayout: 'fixed' }}>
          <thead style={{ background: '#f3f4f6', position: 'sticky', top: 0, zIndex: 1 }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{
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
                      letterSpacing: '0.025em'
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
          <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = tableRows[virtualRow.index]
              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
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
                        width: cell.column.getSize(),
                        padding: '8px 12px',
                        borderBottom: '1px solid #f3f4f6',
                        borderRight: '1px solid #f9fafb',
                        verticalAlign: 'top',
                        fontSize: 13,
                        wordBreak: 'break-word'
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
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