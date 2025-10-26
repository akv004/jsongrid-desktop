import React, { useMemo, useRef } from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  // ❌ getPaginationRowModel, // REMOVED: This was causing the 10-row limit.
  getExpandedRowModel,
  SortingState,
  ExpandedState,
  useReactTable,
  Row,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { DeriveResult, GridRow } from '../utils/deriveGridData'

type Props = {
  data: DeriveResult | null
  rowHeight?: number
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
export default function GridView({ data, rowHeight = 34 }: Props) {
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const rows = data?.rows ?? []
  const columnKeys = useMemo(() => data?.columns.map((c) => c.key) ?? [], [data?.columns])

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [expanded, setExpanded] = React.useState<ExpandedState>({})

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
        const isSubRow = !!row.original.isSubRow
        let content: React.ReactNode

        if (isSubRow) {
          // For sub-rows, display `key: value`
          content = (
              <>
                <strong style={{ marginRight: '8px' }}>{String(row.original.key)}:</strong>
                <span>{String(row.original.value ?? '')}</span>
              </>
          )
        } else {
          // For top-level rows, display the value of the first column
          const value = firstKey ? row.original[firstKey] : ''
          content = <span title={String(value ?? '')}>{String(value ?? '')}</span>
        }

        return (
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: `${row.depth * 1.2}rem` }}>
              {row.getCanExpand() ? (
                  <button
                      style={{ cursor: 'pointer', border: 'none', background: 'none', padding: '0 8px 0 0', flexShrink: 0 }}
                      onClick={row.getToggleExpandedHandler()}
                  >
                    {row.getIsExpanded() ? '▾' : '▸'}
                  </button>
              ) : (
                  // Add a spacer for alignment if not expandable
                  <div style={{ width: '24px', flexShrink: 0 }}></div>
              )}
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content}</div>
            </div>
        )
      },
    }

    // The rest of the columns, which will be blank for sub-rows
    const otherCols: ColumnDef<GridRow>[] = columnKeys.slice(1).map((key) => ({
      accessorKey: key,
      header: () => key,
      cell: (info) => {
        // Sub-rows are blank in these columns
        if (info.row.original.isSubRow) return null
        const value = info.getValue()
        const strValue = String(value ?? '')
        return <span title={strValue}>{strValue}</span>
      },
      size: 150,
    }))

    return [firstCol, ...otherCols]
  }, [columnKeys])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, expanded },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // ❌ getPaginationRowModel: getPaginationRowModel(), // REMOVED
    getExpandedRowModel: getExpandedRowModel(),
    columnResizeMode: 'onChange',
    globalFilterFn: (row, _columnId, filterValue: string) => {
      if (!filterValue) return true
      const q = filterValue.toLowerCase()
      // Only filter top-level rows
      if (row.depth > 0) return false
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
    overscan: 20, // Increased overscan for smoother scrolling with expanded rows
  })

  if (!data) {
    return (
        <div style={{ color: '#666', padding: 12 }}>
          <strong>No tabular array detected.</strong>
          <div>
            Paste JSON that contains an array of records (e.g., <code>[{"{...}"}, {"{...}"}]</code>).
          </div>
        </div>
    )
  }

  return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: 12, gap: 8 }}>
        {/* Header section */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <input
              type="text"
              placeholder="Search..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}
          />
          <button
              onClick={() => exportCSV(table.getCoreRowModel().rows, columnKeys, 'grid.csv')}
              disabled={rows.length === 0}
              title="Export CSV"
          >
            Export CSV
          </button>
        </div>

        {/* Info section */}
        <div style={{ color: '#777', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span>Path: <code>{data.path}</code></span>
          {data.note ? <span style={{ marginLeft: 8 }}>• {data.note}</span> : null}
          <span style={{ marginLeft: 8 }}>• Rows: {rows.length} • Cols: {columnKeys.length}</span>
        </div>

        {/* Table container */}
        <div ref={tableContainerRef} style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: table.getTotalSize(), borderSpacing: 0 }}>
            <thead style={{ background: '#f8f8f8', position: 'sticky', top: 0, zIndex: 1 }}>
            {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                      <th
                          key={header.id}
                          colSpan={header.colSpan}
                          style={{ width: header.getSize(), textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #ddd', userSelect: 'none', position: 'relative' }}
                      >
                        {header.isPlaceholder ? null : (
                            <div
                                style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
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
                              width: 5,
                              background: header.column.getIsResizing() ? '#a0c8e8' : 'transparent',
                              cursor: 'col-resize',
                              userSelect: 'none',
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
                      style={{
                        height: `${rowHeight}px`,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        background: virtualRow.index % 2 ? '#fdfdfd' : 'white',
                      }}
                  >
                    {row.getVisibleCells().map((cell) => (
                        <td
                            key={cell.id}
                            style={{
                              width: cell.column.getSize(),
                              padding: '6px 8px',
                              borderBottom: '1px solid #eee',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
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
}