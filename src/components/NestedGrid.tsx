import React, { useState, useEffect } from 'react'
import { PlusSquare, MinusSquare, Pencil } from 'lucide-react'
import { useGridContext } from '../context/GridContext'
import { ComplexCell } from '../utils/deriveGridData'

type Props = {
    data: unknown
    name?: string
    depth?: number
    isRoot?: boolean
    path?: (string | number)[]
}

const NestedGrid: React.FC<Props> = ({ data, name, depth = 0, isRoot = false, path = [] }) => {
    const { expandAllToken, collapseAllToken, onEditValue } = useGridContext()
    const [isExpanded, setIsExpanded] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState<string | null>(null)

    // Effect to handle global expand/collapse signals
    useEffect(() => {
        if (expandAllToken > 0) setIsExpanded(true)
    }, [expandAllToken])

    useEffect(() => {
        if (collapseAllToken > 0) setIsExpanded(false)
    }, [collapseAllToken])

    // Normalize data: unwrap ComplexCell if present, otherwise use data as is
    let actualData = data
    let summary = ''
    let typeLabel = ''
    let isComplex = false

    if (data && typeof data === 'object') {
        if ('type' in data && 'summary' in data && 'data' in data) {
            // It's a ComplexCell
            const cell = data as ComplexCell
            actualData = cell.data
            summary = cell.summary
            typeLabel = cell.type === 'array' ? 'Array' : 'Object'
            isComplex = true
        } else {
            // It's a raw object/array
            isComplex = true
            if (Array.isArray(data)) {
                typeLabel = 'Array'
                summary = `[${(data as any[]).length}]`
            } else {
                typeLabel = 'Object'
                summary = `{${Object.keys(data).length}}`
            }
        }
    }

    // If it's a primitive value, render it in an input box with edit icon
    if (!isComplex) {
        const strValue = String(actualData ?? '')
        const displayValue = editValue !== null ? editValue : strValue
        const isString = typeof actualData === 'string'
        const color = isString ? '#059669' : (typeof actualData === 'number' || typeof actualData === 'boolean' ? '#d97706' : '#374151')

        if (isEditing) {
            return (
                <div className="value-cell-edit" style={{ width: '100%', padding: '2px' }}>
                    <input
                        autoFocus
                        value={displayValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => {
                            if (editValue !== null && editValue !== strValue) {
                                onEditValue(path, editValue)
                            }
                            setIsEditing(false)
                            setEditValue(null)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.currentTarget.blur()
                            } else if (e.key === 'Escape') {
                                setEditValue(null)
                                setIsEditing(false)
                            }
                        }}
                        style={{
                            width: '100%',
                            padding: '2px 4px',
                            border: '1px solid #3b82f6',
                            borderRadius: 4,
                            outline: 'none',
                            fontFamily: 'monospace',
                            fontSize: 12,
                            background: 'white',
                            color: '#1f2937'
                        }}
                    />
                </div>
            )
        }

        return (
            <div
                className="value-cell-view"
                onClick={() => {
                    setEditValue(strValue)
                    setIsEditing(true)
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    minHeight: 24,
                    width: 'fit-content',
                    maxWidth: '100%'
                }}
            >
                <span style={{
                    color,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    wordBreak: 'break-word'
                }}>
                    {strValue}
                </span>
                <Pencil
                    size={12}
                    className="edit-icon"
                    style={{
                        color: '#9ca3af',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        flexShrink: 0
                    }}
                />
                <style>{`
                    .value-cell-view:hover .edit-icon { opacity: 1 !important; }
                `}</style>
            </div>
        )
    }

    // Check if it's an array of objects (Smart Table Mode)
    let isArrayOfObjects = false
    let allKeys: string[] = []

    if (Array.isArray(actualData)) {
        const arr = actualData as any[]
        if (arr.length > 0 && arr.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
            isArrayOfObjects = true
            // Collect all unique keys
            const keySet = new Set<string>()
            arr.forEach(item => Object.keys(item).forEach(k => keySet.add(k)))
            allKeys = Array.from(keySet)
        }
    }

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

            {/* Nested Content */}
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
                    {isArrayOfObjects ? (
                        // Smart Table View for Array of Objects
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', color: '#6b7280', width: 40, borderRight: '1px solid #e5e7eb' }}>#</th>
                                        {allKeys.map(key => (
                                            <th key={key} style={{ padding: '6px 10px', textAlign: 'left', color: '#374151', fontWeight: 600, borderRight: '1px solid #e5e7eb' }}>
                                                {key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(actualData as any[]).map((item, index) => (
                                        <tr key={index} style={{ borderBottom: index < (actualData as any[]).length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                                            <td style={{ padding: '6px 10px', color: '#9ca3af', borderRight: '1px solid #e5e7eb', fontFamily: 'monospace' }}>
                                                {index}
                                            </td>
                                            {allKeys.map(key => (
                                                <td key={key} style={{ padding: '0', borderRight: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                                                    <div style={{ padding: '2px' }}>
                                                        <NestedGrid data={item[key]} depth={depth + 1} path={[...path, index, key]} />
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        // Standard Key-Value View
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <tbody>
                                {Object.keys(actualData as object).map((key, index, arr) => {
                                    const value = (actualData as any)[key]
                                    return (
                                        <tr key={key} style={{ borderBottom: index < arr.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
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
                                            <td style={{ padding: '0', verticalAlign: 'top' }}>
                                                <div style={{ padding: '2px' }}>
                                                    <NestedGrid data={value} depth={depth + 1} path={[...path, key]} />
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    )
}

export default NestedGrid
