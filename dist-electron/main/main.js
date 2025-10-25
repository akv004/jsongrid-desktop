import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // This path will now be correctly resolved
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (!app.isPackaged) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    await win.loadFile(join(__dirname, "../../dist/index.html"));
  }
}
app.whenReady().then(createWindow).catch((e) => console.error("Failed to create window:", e));
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
ipcMain.handle("file:open", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: "JSON", extensions: ["json", "jsonl"] }],
    properties: ["openFile"]
  });
  if (canceled || !filePaths[0]) return null;
  const text = await readFile(filePaths[0], "utf-8");
  return { filePath: filePaths[0], text };
});
ipcMain.handle("file:save", async (_e, p) => {
  let filePath = p.filePath;
  if (!filePath) {
    const res = await dialog.showSaveDialog({ filters: [{ name: "JSON", extensions: ["json"] }] });
    if (res.canceled || !res.filePath) return null;
    filePath = res.filePath;
  }
  await writeFile(filePath, p.text, "utf-8");
  return { filePath };
});
//# sourceMappingURL=main.js.map
