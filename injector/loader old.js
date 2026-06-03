// DiscordThemer Loader - runs inside Discord's Electron process
// This file is require()'d from Discord's index.js

const path = require("path");
const fs = require("fs");

const CONFIG_DIR = path.join(process.env.APPDATA, "DiscordThemer");
const ACTIVE_PATH = path.join("E:\\discord-themer\\discord-themer\\injector\\active.json");

function getActiveTheme() {
  try {
    if (!fs.existsSync(ACTIVE_PATH)) return null;
    return JSON.parse(fs.readFileSync(ACTIVE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function applyTheme(webContents) {
  const config = getActiveTheme();
  if (!config || !config.enabled || !config.cssPath) return;

  try {
    if (!fs.existsSync(config.cssPath)) return;
    const css = fs.readFileSync(config.cssPath, "utf8");
    webContents.insertCSS(css).catch(() => {});
  } catch (err) {
    console.error("[DiscordThemer] CSS inject error:", err);
  }
}

// Hook into Electron app lifecycle
try {
  const { app, session, BrowserWindow } = require("electron");

  // Relax CSP to allow injected styles
  app.on("ready", () => {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: Object.assign({}, details.responseHeaders, {
          "Content-Security-Policy": [""],
        }),
      });
    });
  });

  // Inject on every window creation
  app.on("browser-window-created", (_, win) => {
    win.webContents.on("dom-ready", () => applyTheme(win.webContents));
    win.webContents.on("did-navigate-in-page", () => applyTheme(win.webContents));
  });

  console.log("[DiscordThemer] Loader initialized successfully");
} catch (err) {
  console.error("[DiscordThemer] Loader failed to initialize:", err);
}
