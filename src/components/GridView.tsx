import React, { useMemo, useRef } from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { DeriveResult, GridRow } from '../utils/deriveGridData'

type Props = {
  data: DeriveResult | null
  height?: number
  rowHeight?: number
}

// Simple CSV export without extra deps
function exportCSV(rows: GridRow[], columns: string[], filename: string) {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (/["\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const head = columns.join(',')
  const body = rows.map(r => columns.map(c => esc((r as never)[c])).join(',')).join('\n')
  const csv = `${head}\n${body}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function GridView({ data, height = 520, rowHeight = 34 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const rows = data?.rows ?? []
  const allKeys = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) for (const k of Object.keys(r)) s.add(k)
    return Array.from(s)
  }, [rows])

  const columns = useMemo<ColumnDef<GridRow>[]>(() => {
    return allKeys.map((key) => ({
      id: key,
      accessorFn: (row) => (row as never)[key],
      header: () => key,
      cell: (info) => {
        const v = info.getValue() as unknown
        return <span title={typeof v === 'string' ? v : String(v)}>{String(v ?? '')}</span>
      },
    }))
  }, [allKeys])

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      if (!filterValue) return true
      const q = filterValue.toLowerCase()
      for (const k of allKeys) {
        const v = row.original[k]
        if (v != null && String(v).toLowerCase().includes(q)) return true
      }
      return false
    },
    debugTable: false,
  })

  const parentRef = useRef<HTMLDivElement>(null)
  const virtual = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  })

  if (!data) {
    return (
      <div style={{ color: '#666' }}>
        <strong>No tabular array detected.</strong>
        <div>Paste JSON that contains an array of records (e.g., <code>[{"{...}"}, {"{...}"}]</code>).</div>
      </div>
    )
  }

  const gridHeader = (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${allKeys.length}, minmax(120px, 1fr))`, borderBottom: '1px solid #ddd', fontWeight: 600 }}>
      {table.getFlatHeaders().map((header) => (
        <div
          key={header.id}
          role="columnheader"
          style={{ padding: '6px 8px', cursor: header.column.getCanSort() ? 'pointer' : 'default', userSelect: 'none' }}
          onClick={header.column.getToggleSortingHandler()}
          title="Click to sort"
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          {{
            asc: ' ▲',
            desc: ' ▼',
          }[header.column.getIsSorted() as 'asc' | 'desc'] ?? ''}
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ height, display: 'flex', flexDirection: 'column' }} ref={containerRef}>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}
        />
        <button
          onClick={() => exportCSV(rows, allKeys, 'grid.csv')}
          disabled={rows.length === 0}
          title="Export CSV"
        >
          Export CSV
        </button>
      </div>

      <div style={{ color: '#777', marginBottom: 8 }}>
        <span>Path: <code>{data.path}</code></span>
        {data.note ? <span style={{ marginLeft: 8 }}>• {data.note}</span> : null}
        <span style={{ marginLeft: 8 }}>• Rows: {rows.length} • Cols: {allKeys.length}</span>
      </div>

      <div role="grid" style={{ border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden', height: height - 120 }}>
        {gridHeader}

        <div
          ref={parentRef}
          style={{
            height: height - 155,
            overflow: 'auto',
            willChange: 'transform',
          }}
        >
          <div
            style={{
              height: virtual.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtual.getVirtualItems().map((vi) => {
              const row = table.getRowModel().rows[vi.index]
              return (
                <div
                  key={row.id}
                  role="row"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vi.start}px)`,
                    height: rowHeight,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${allKeys.length}, minmax(120px, 1fr))`,
                    borderBottom: '1px solid #eee',
                    padding: '6px 8px',
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id} role="gridcell" style={{ paddingRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
