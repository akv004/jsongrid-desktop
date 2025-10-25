import React from 'react'
import Editor, { OnChange } from '@monaco-editor/react'

type Props = {
    value: string
    onChange: (t: string) => void
}

export default function EditorMonaco({ value, onChange }: Props) {
    const handleChange: OnChange = (v /* string | undefined */) => {
        onChange(v ?? '')
    }

    return (
        <Editor
            height="100%"
            defaultLanguage="json"
            value={value}
            onChange={handleChange}
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
}