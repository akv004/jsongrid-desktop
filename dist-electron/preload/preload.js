import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("api", {
  openFile: () => ipcRenderer.invoke("file:open"),
  saveFile: (data) => ipcRenderer.invoke("file:save", data)
});
//# sourceMappingURL=preload.js.map
