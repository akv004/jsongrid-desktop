/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * This is the **CommonJS** preload script for Electron.
 * It runs in an isolated context and safely exposes IPC functions to the renderer.
 */

'use strict'

// Import only safe modules
const { contextBridge, ipcRenderer } = require('electron')

console.log('[JSONGRID] ✅ preload.cjs successfully loaded')

// Expose a limited, secure API to the renderer process (window.api)
contextBridge.exposeInMainWorld('api', {
    /**
     * Opens a JSON file via an IPC handler defined in main.ts.
     * @returns {Promise<{ filePath: string, text: string } | null>} A promise that resolves with the file path and content, or null if canceled.
     */
    openFile: () => ipcRenderer.invoke('file:open'),

    /**
     * Saves the current JSON content to disk via an IPC handler in main.ts.
     * @param {{ filePath?: string, text: string }} data - The payload containing the text to save and an optional file path.
     * @returns {Promise<{ filePath: string } | null>} A promise that resolves with the new file path, or null if canceled.
     */
    saveFile: (data: { filePath?: string; text: string }) => ipcRenderer.invoke('file:save', data),

    /**
     * FIX: Expose a function to set the window title.
     * Sends a one-way message to the main process.
     * @param {string} [filePath] - The file path to use for the title.
     */
    setTitle: (filePath?: string) => ipcRenderer.send('window:set-title', filePath),
})