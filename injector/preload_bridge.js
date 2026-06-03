// preload_bridge.js
// If your Tauri/Electron build gives you a custom preload file, require this from it.
// It exposes window.discordthemer so the renderer script can call IPC without nodeIntegration.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("discordthemer", {
  getThemes: () => ipcRenderer.invoke("DiscordThemerGetThemes"),
  getActive:  () => ipcRenderer.invoke("DiscordThemerGetActive"),
  activate:   (id, css) => ipcRenderer.invoke("DiscordThemerActivate", id, css),
  disable:    () => ipcRenderer.invoke("DiscordThemerDisable"),
});
