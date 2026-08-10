import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

type GridContextType = {
    expandAllToken: number
    collapseAllToken: number
    triggerExpandAll: () => void
    triggerCollapseAll: () => void
    onEditValue: (path: (string | number)[], value: any) => void
    registerEditHandler: (handler: (path: (string | number)[], value: any) => void) => void
}

const GridContext = createContext<GridContextType>({
    expandAllToken: 0,
    collapseAllToken: 0,
    triggerExpandAll: () => { },
    triggerCollapseAll: () => { },
    onEditValue: () => { },
    registerEditHandler: () => { },
})

export const useGridContext = () => useContext(GridContext)

export const GridProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [expandAllToken, setExpandAllToken] = useState(0)
    const [collapseAllToken, setCollapseAllToken] = useState(0)
    const editHandlerRef = useRef<((path: (string | number)[], value: any) => void) | null>(null)

    const triggerExpandAll = useCallback(() => setExpandAllToken(prev => prev + 1), [])
    const triggerCollapseAll = useCallback(() => setCollapseAllToken(prev => prev + 1), [])

    const registerEditHandler = useCallback((handler: (path: (string | number)[], value: any) => void) => {
        editHandlerRef.current = handler
    }, [])

    const onEditValue = useCallback((path: (string | number)[], value: any) => {
        if (editHandlerRef.current) {
            editHandlerRef.current(path, value)
        } else {
            console.warn('No edit handler registered')
        }
    }, [])

    return (
        <GridContext.Provider value={{
            expandAllToken,
            collapseAllToken,
            triggerExpandAll,
            triggerCollapseAll,
            onEditValue,
            registerEditHandler
        }}>
            {children}
        </GridContext.Provider>
    )
}
