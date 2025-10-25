import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
    openFile: () => ipcRenderer.invoke('file:open'),
    saveFile: (data: { filePath?: string; text: string }) => ipcRenderer.invoke('file:save', data),
})