import React, { useState } from 'react'
import { ComplexCell, isComplexCell } from '../utils/deriveGridData'
import { PlusSquare, MinusSquare } from 'lucide-react'

type Props = {
    data: unknown
    name?: string
    depth?: number
    isRoot?: boolean
}

const NestedGrid: React.FC<Props> = ({ data, name, depth = 0, isRoot = false }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

    // Determine if the current data is a complex cell (object/array) or a primitive
    const isComplex = isComplexCell(data)
    const cellData = isComplex ? (data as ComplexCell) : null

    // If it's a primitive value, render it in an input-like box
    if (!isComplex) {
        return (
            <div
                style={{
                    padding: '4px 8px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 4,
                    background: 'white',
                    color: typeof data === 'string' ? '#059669' : '#d97706', // Green for strings, orange for numbers/bools
                    fontFamily: 'monospace',
                    fontSize: 12,
                    minHeight: 24,
                    display: 'flex',
                    alignItems: 'center'
                }}
                title="Click to edit/copy (Read-only for now)"
            >
                {String(data ?? '')}
            </div>
        )
    }

    // If it's complex, render the expander and potentially the nested table
    const summary = cellData?.summary || ''
    const typeLabel = cellData?.type === 'array' ? 'Array' : 'Object'
    const items = cellData?.data as object || {}
    const keys = Object.keys(items)

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsExpanded(!isExpanded)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
            {/* Header / Expander */}
            <div
                onClick={handleToggle}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#3b82f6',
                    fontWeight: 600,
                    userSelect: 'none',
                    padding: '2px 0',
                    fontSize: 13
                }}
            >
                {isExpanded ? <MinusSquare size={14} /> : <PlusSquare size={14} />}
                <span style={{ color: '#1f2937' }}>
                    {name && <span style={{ color: '#374151', marginRight: 4 }}>{name}</span>}
                    <span style={{ color: '#6b7280', fontWeight: 400 }}>{typeLabel} {summary}</span>
                </span>
            </div>

            {/* Nested Table */}
            {isExpanded && (
                <div style={{
                    marginTop: 4,
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    overflow: 'hidden',
                    background: 'white',
                    width: '100%',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <tbody>
                            {keys.map((key, index) => {
                                const value = (items as any)[key]
                                return (
                                    <tr key={key} style={{ borderBottom: index < keys.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                                        {/* Key Column */}
                                        <td style={{
                                            width: '120px',
                                            padding: '6px 10px',
                                            background: '#f9fafb',
                                            borderRight: '1px solid #e5e7eb',
                                            color: '#3b82f6',
                                            fontWeight: 600,
                                            verticalAlign: 'top',
                                            fontFamily: 'monospace'
                                        }}>
                                            {key}
                                        </td>
                                        {/* Value Column */}
                                        <td style={{ padding: '6px 10px', verticalAlign: 'top' }}>
                                            <NestedGrid data={value} depth={depth + 1} />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default NestedGrid
