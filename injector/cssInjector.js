// CSS hot-reload helper (used during theme development)
const fs = require("fs");

let watchHandle = null;

function watchCSS(cssPath, webContents) {
  if (watchHandle) { watchHandle.close(); watchHandle = null; }

  if (!fs.existsSync(cssPath)) return;

  watchHandle = fs.watch(cssPath, () => {
    try {
      const css = fs.readFileSync(cssPath, "utf8");
      // Clear previous styles by injecting a reset first
      webContents.insertCSS("/* DiscordThemer reset */").then(() => {
        webContents.insertCSS(css);
      });
    } catch (err) {
      console.error("[DiscordThemer] Hot-reload error:", err);
    }
  });
}

module.exports = { watchCSS };
