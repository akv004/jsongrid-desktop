import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

type JsonPath = (string | number)[]

type GridContextType = {
    expandAllToken: number
    collapseAllToken: number
    triggerExpandAll: () => void
    triggerCollapseAll: () => void
    onEditValue: (path: JsonPath, value: string) => void
    registerEditHandler: (handler: (path: JsonPath, value: string) => void) => void
    /** Notify the host that a node was clicked so it can highlight the JSON source line. */
    onSelectPath: (path: JsonPath) => void
    registerSelectHandler: (handler: (path: JsonPath) => void) => void
}

const GridContext = createContext<GridContextType>({
    expandAllToken: 0,
    collapseAllToken: 0,
    triggerExpandAll: () => { },
    triggerCollapseAll: () => { },
    onEditValue: () => { },
    registerEditHandler: () => { },
    onSelectPath: () => { },
    registerSelectHandler: () => { },
})

export const useGridContext = () => useContext(GridContext)

export const GridProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [expandAllToken, setExpandAllToken] = useState(0)
    const [collapseAllToken, setCollapseAllToken] = useState(0)
    const editHandlerRef = useRef<((path: JsonPath, value: string) => void) | null>(null)
    const selectHandlerRef = useRef<((path: JsonPath) => void) | null>(null)

    const triggerExpandAll = useCallback(() => setExpandAllToken(prev => prev + 1), [])
    const triggerCollapseAll = useCallback(() => setCollapseAllToken(prev => prev + 1), [])

    const registerEditHandler = useCallback((handler: (path: JsonPath, value: string) => void) => {
        editHandlerRef.current = handler
    }, [])

    const onEditValue = useCallback((path: JsonPath, value: string) => {
        if (editHandlerRef.current) {
            editHandlerRef.current(path, value)
        } else {
            console.warn('No edit handler registered')
        }
    }, [])

    const registerSelectHandler = useCallback((handler: (path: JsonPath) => void) => {
        selectHandlerRef.current = handler
    }, [])

    const onSelectPath = useCallback((path: JsonPath) => {
        selectHandlerRef.current?.(path)
    }, [])

    return (
        <GridContext.Provider value={{
            expandAllToken,
            collapseAllToken,
            triggerExpandAll,
            triggerCollapseAll,
            onEditValue,
            registerEditHandler,
            onSelectPath,
            registerSelectHandler
        }}>
            {children}
        </GridContext.Provider>
    )
}
