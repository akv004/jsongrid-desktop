import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { getCurrentWindow } from '@tauri-apps/api/window'

export interface FileHost {
  openFile(): Promise<{ filePath?: string; text: string } | null>
  saveFile(data: { filePath?: string; text: string }): Promise<{ filePath: string } | null>
  setTitle(filePath?: string): Promise<void>
}

const JSON_FILTERS = [
  { name: 'JSON Files', extensions: ['json'] },
  { name: 'All Files', extensions: ['*'] },
]

const BASE_TITLE = 'JSONGrid'

const tauriHost: FileHost = {
  async openFile() {
    const filePath = await open({ title: 'Open JSON File', multiple: false, filters: JSON_FILTERS })
    if (!filePath) return null
    const text = await readTextFile(filePath)
    return { filePath, text }
  },

  async saveFile({ filePath, text }) {
    const target = await save({
      title: 'Save JSON File',
      defaultPath: filePath || 'untitled.json',
      filters: JSON_FILTERS,
    })
    if (!target) return null
    await writeTextFile(target, text)
    return { filePath: target }
  },

  async setTitle(filePath) {
    const fileName = filePath ? filePath.split(/[/\\]/).pop() : undefined
    await getCurrentWindow().setTitle(fileName ? `${fileName} — ${BASE_TITLE}` : BASE_TITLE)
  },
}

// Fallback so the lib and app shell still work in a plain browser (vite dev without Tauri).
const browserHost: FileHost = {
  openFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json,application/json'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return resolve(null)
        resolve({ filePath: file.name, text: await file.text() })
      }
      input.oncancel = () => resolve(null)
      input.click()
    })
  },

  async saveFile({ filePath, text }) {
    const name = (filePath?.split(/[/\\]/).pop()) || 'untitled.json'
    const blob = new Blob([text], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
    return { filePath: name }
  },

  async setTitle(filePath) {
    const fileName = filePath ? filePath.split(/[/\\]/).pop() : undefined
    document.title = fileName ? `${fileName} — ${BASE_TITLE}` : BASE_TITLE
  },
}

export const isTauri = '__TAURI_INTERNALS__' in window

export const fileHost: FileHost = isTauri ? tauriHost : browserHost
