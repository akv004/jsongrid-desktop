// electron/main/main.ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

process.env.APP_ROOT = join(__dirname, '../..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    // FIX: Set a default title for the window.
    title: 'JSONGrid',
    icon: join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: join(MAIN_DIST, 'preload.cjs'),
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    // FIX: Open DevTools automatically in development mode.
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

ipcMain.handle('file:save', async (event, data: { filePath?: string; text: string }) => {
  if (!win) return

  const defaultPath = data.filePath || 'untitled.json'
  const result = await dialog.showSaveDialog(win, {
    defaultPath,
    title: 'Save JSON File',
    filters: [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
  })

  if (result.filePath) {
    await writeFile(result.filePath, data.text, 'utf-8')
    return { filePath: result.filePath }
  }
  return null
})

ipcMain.handle('file:open', async () => {
  if (!win) return

  const result = await dialog.showOpenDialog(win, {
    title: 'Open JSON File',
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
  })

  if (result.filePaths && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    const content = await readFile(filePath, 'utf-8')
    return {
      filePath: filePath,
      text: content,
    }
  }
  return null
})

/**
 * FIX: IPC handler to set the main window's title.
 * This allows the renderer process to update the title bar based on the current file.
 * It shows the filename for clarity.
 */
ipcMain.on('window:set-title', (event, filePath: string | undefined) => {
  if (win) {
    const baseTitle = 'JSONGrid'
    const fileName = filePath ? filePath.split(/[/\\]/).pop() : undefined
    win.setTitle(fileName ? `${fileName} — ${baseTitle}` : baseTitle)
  }
})