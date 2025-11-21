import { app as l, BrowserWindow as c, ipcMain as r, dialog as f } from "electron";
import { dirname as m, join as n } from "node:path";
import { fileURLToPath as w } from "node:url";
import { writeFile as P, readFile as h } from "node:fs/promises";
const u = w(import.meta.url), _ = m(u);
process.env.APP_ROOT = n(_, "../..");
const a = process.env.VITE_DEV_SERVER_URL, v = n(process.env.APP_ROOT, "dist-electron"), p = n(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = a ? n(process.env.APP_ROOT, "public") : p;
let e;
function d() {
  e = new c({
    // FIX: Set a default title for the window.
    title: "JSONGrid",
    icon: n(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: n(v, "preload.cjs")
    }
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), a ? (e.loadURL(a), e.webContents.openDevTools()) : e.loadFile(n(p, "index.html"));
}
l.on("window-all-closed", () => {
  process.platform !== "darwin" && (l.quit(), e = null);
});
l.on("activate", () => {
  c.getAllWindows().length === 0 && d();
});
l.whenReady().then(d);
r.handle("file:save", async (s, t) => {
  if (!e) return;
  const i = t.filePath || "untitled.json", o = await f.showSaveDialog(e, {
    defaultPath: i,
    title: "Save JSON File",
    filters: [{ name: "JSON Files", extensions: ["json"] }, { name: "All Files", extensions: ["*"] }]
  });
  return o.filePath ? (await P(o.filePath, t.text, "utf-8"), { filePath: o.filePath }) : null;
});
r.handle("file:open", async () => {
  if (!e) return;
  const s = await f.showOpenDialog(e, {
    title: "Open JSON File",
    properties: ["openFile"],
    filters: [{ name: "JSON Files", extensions: ["json"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (s.filePaths && s.filePaths.length > 0) {
    const t = s.filePaths[0], i = await h(t, "utf-8");
    return {
      filePath: t,
      text: i
    };
  }
  return null;
});
r.on("window:set-title", (s, t) => {
  if (e) {
    const i = "JSONGrid", o = t ? t.split(/[/\\]/).pop() : void 0;
    e.setTitle(o ? `${o} — ${i}` : i);
  }
});
export {
  v as MAIN_DIST,
  p as RENDERER_DIST,
  a as VITE_DEV_SERVER_URL
};
//# sourceMappingURL=main.js.map
