import { forwardRef, useImperativeHandle, useRef } from 'react'
import Editor, { OnChange, OnMount } from '@monaco-editor/react'

type Props = {
    value: string
    onChange: (t: string) => void
}

export type EditorMonacoHandle = {
    /** Scroll to a character offset and highlight its line. */
    revealOffset: (offset: number) => void
}

type EditorInstance = Parameters<OnMount>[0]
type MonacoInstance = Parameters<OnMount>[1]

const EditorMonaco = forwardRef<EditorMonacoHandle, Props>(function EditorMonaco({ value, onChange }, ref) {
    const editorRef = useRef<EditorInstance | null>(null)
    const monacoRef = useRef<MonacoInstance | null>(null)
    const decorationsRef = useRef<string[]>([])

    const handleChange: OnChange = (v /* string | undefined */) => {
        onChange(v ?? '')
    }

    const handleMount: OnMount = (editor, monaco) => {
        editorRef.current = editor
        monacoRef.current = monaco
    }

    useImperativeHandle(ref, () => ({
        revealOffset(offset: number) {
            const editor = editorRef.current
            const monaco = monacoRef.current
            const model = editor?.getModel()
            if (!editor || !monaco || !model) return
            const pos = model.getPositionAt(offset)
            editor.revealPositionInCenterIfOutsideViewport(pos)
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
                {
                    range: new monaco.Range(pos.lineNumber, 1, pos.lineNumber, 1),
                    options: { isWholeLine: true, className: 'json-line-highlight' },
                },
            ])
        },
    }))

    return (
        <Editor
            height="100%"
            defaultLanguage="json"
            value={value}
            onChange={handleChange}
            onMount={handleMount}
            options={{
                wordWrap: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                renderValidationDecorations: 'on',
                tabSize: 2,
            }}
        />
    )
})

export default EditorMonaco
