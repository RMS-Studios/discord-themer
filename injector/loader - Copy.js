// DiscordThemer Loader v6
// - Bootstrap: auto-creates AppData folders + files on first run
// - Fix: saveState uses writeFileSync correctly (no race)
// - Fix: 1s AppData watcher — pushes live theme/plugin list to renderer
// - New: Desktop notifications for errors, apply, toggle, etc
// - New: Settings sidebar injection (Themes / Plugins / System under Appearance)

const path = require("path");
const fs   = require("fs");

const BASE        = path.join(process.env.APPDATA, "DiscordThemer");
const PLUGINS_DIR = path.join(BASE, "plugins");
const THEMES_DIR  = path.join(BASE, "themes");
const CUSTOM_CSS  = path.join(BASE, "custom.css");
const STATE_FILE  = path.join(BASE, "state.json");

// ── Bootstrap ─────────────────────────────────────────────────────────────────
function bootstrap() {
  try {
    fs.mkdirSync(BASE,        { recursive: true });
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    fs.mkdirSync(THEMES_DIR,  { recursive: true });
    if (!fs.existsSync(STATE_FILE))
      fs.writeFileSync(STATE_FILE, JSON.stringify({ plugins: {}, activeTheme: null }, null, 2), "utf8");
    if (!fs.existsSync(CUSTOM_CSS))
      fs.writeFileSync(CUSTOM_CSS, "/* Your custom CSS here */\n", "utf8");
    console.log("[DiscordThemer] Bootstrap complete ✓");
  } catch(e) {
    console.error("[DiscordThemer] Bootstrap failed:", e && e.message);
  }
}
bootstrap();

// ── Notifications ─────────────────────────────────────────────────────────────
function notify(title, body, isError) {
  try {
    var N = require("electron").Notification;
    if (!N.isSupported()) return;
    new N({ title: "DiscordThemer" + (isError ? " ⚠️" : "") + " — " + title, body: body || "", silent: !isError }).show();
  } catch(e) { console.error("[DT] notify:", e && e.message); }
}
function notifyError(title, body) { notify(title, body, true); }

// ── State ─────────────────────────────────────────────────────────────────────
function loadState() {
  try {
    var raw = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(raw);
  } catch(e) {
    return { plugins: {}, activeTheme: null };
  }
}
function saveState(s) {
  try {
    fs.mkdirSync(BASE, { recursive: true });
    var json = JSON.stringify(s, null, 2);
    fs.writeFileSync(STATE_FILE, json, "utf8");
    console.log("[DiscordThemer] state.json saved:", json);
  } catch(e) {
    console.error("[DiscordThemer] saveState failed:", e && e.message);
    notifyError("Save Failed", "Could not write state.json: " + (e && e.message));
  }
}

// ── Themes ────────────────────────────────────────────────────────────────────
function getAllThemes() {
  var out = [];
  if (!fs.existsSync(THEMES_DIR)) return out;

  fs.readdirSync(THEMES_DIR).forEach(function(id) {
    var dir = path.join(THEMES_DIR, id);
    try {
      if (!fs.statSync(dir).isDirectory()) return;
      var meta = { id: id, name: id, author: "Unknown", version: "1.0", description: "" };
      var jp = path.join(dir, "theme.json");
      if (fs.existsSync(jp)) Object.assign(meta, JSON.parse(fs.readFileSync(jp, "utf8")));
      meta.id       = id;
      meta.cssFiles = fs.readdirSync(dir).filter(function(f){ return f.endsWith(".css"); }).map(function(f){ return path.join(dir,f); });
      meta.jsFiles  = fs.readdirSync(dir).filter(function(f){ return f.endsWith(".js");  }).map(function(f){ return path.join(dir,f); });
      out.push(meta);
    } catch(e) { notifyError("Theme Load Error", id + ": " + (e && e.message)); }
  });

  // BD single-file themes
  fs.readdirSync(THEMES_DIR).forEach(function(f) {
    if (!f.endsWith(".css")) return;
    try {
      var fp = path.join(THEMES_DIR, f);
      if (fs.statSync(fp).isDirectory()) return;
      var content = fs.readFileSync(fp, "utf8");
      var meta = { id: f, name: f.replace(".css",""), author: "Unknown", version: "1.0", description: "", isBD: true };
      var nm = content.match(/@name\s+(.+)/);        if (nm)  meta.name        = nm[1].trim();
      var am = content.match(/@author\s+(.+)/);      if (am)  meta.author      = am[1].trim();
      var vm = content.match(/@version\s+(.+)/);     if (vm)  meta.version     = vm[1].trim();
      var dm = content.match(/@description\s+(.+)/); if (dm)  meta.description = dm[1].trim();
      meta.cssFiles = [fp]; meta.jsFiles = [];
      out.push(meta);
    } catch(e) { notifyError("BD Theme Error", f + ": " + (e && e.message)); }
  });

  return out;
}

// ── Plugins ───────────────────────────────────────────────────────────────────
function getAllPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) return [];
  var state = loadState();
  var out = [];
  fs.readdirSync(PLUGINS_DIR).forEach(function(id) {
    var dir = path.join(PLUGINS_DIR, id);
    try {
      if (!fs.statSync(dir).isDirectory()) return;
      var ix = path.join(dir, "index.js");
      if (!fs.existsSync(ix)) return;
      var meta = { id: id, name: id, author: "Unknown", version: "1.0", description: "" };
      var jp = path.join(dir, "plugin.json");
      if (fs.existsSync(jp)) {
        try { Object.assign(meta, JSON.parse(fs.readFileSync(jp, "utf8"))); } catch(e) {}
      }
      // Also try reading name/description from JS comment header
      var ixContent = "";
      try { ixContent = fs.readFileSync(path.join(dir, "index.js"), "utf8").slice(0, 500); } catch(e) {}
      var nameM = ixContent.match(/[@*]\s*name[:\s]+(.+)/i);
      var authM = ixContent.match(/[@*]\s*author[:\s]+(.+)/i);
      var descM = ixContent.match(/[@*]\s*description[:\s]+(.+)/i);
      if (nameM && meta.name === id) meta.name = nameM[1].trim();
      if (authM && meta.author === "Unknown") meta.author = authM[1].trim();
      if (descM && !meta.description) meta.description = descM[1].trim();
      meta.id       = id;
      meta.enabled  = !!(state.plugins && state.plugins[id]);
      // Only load plain .js files — skip .ts, .tsx (discord-themer source, needs compilation)
      meta.jsFiles  = [ix].concat(fs.readdirSync(dir).filter(function(f){
        return f.endsWith(".js") && f !== "index.js" && !f.endsWith(".ts");
      }).map(function(f){ return path.join(dir,f); }));
      meta.cssFiles = fs.readdirSync(dir).filter(function(f){ return f.endsWith(".css"); }).map(function(f){ return path.join(dir,f); });
      // Flag TypeScript plugins so UI can show a warning
      meta.isTS = ix.endsWith(".ts") || (function() {
        try { var c = fs.readFileSync(ix,"utf8").slice(0,200); return c.includes("definePlugin") || c.includes("import {"); } catch(e) { return false; }
      })();
      out.push(meta);
    } catch(e) { notifyError("Plugin Load Error", id + ": " + (e && e.message)); }
  });
  return out;
}

function getCustomCSS() {
  try { return fs.existsSync(CUSTOM_CSS) ? fs.readFileSync(CUSTOM_CSS, "utf8") : ""; } catch { return ""; }
}
function setCustomCSS(css) {
  try {
    fs.mkdirSync(BASE, { recursive: true });
    fs.writeFileSync(CUSTOM_CSS, css, "utf8");
  } catch(e) { notifyError("CSS Save Error", e && e.message); }
}

// ── Apply all to webContents ──────────────────────────────────────────────────
function applyAll(wc) {
  try {
    var state   = loadState();
    var themes  = getAllThemes();
    var plugins = getAllPlugins();

    if (state.activeTheme) {
      var theme = themes.find(function(t){ return t.id === state.activeTheme; });
      if (theme) {
        theme.cssFiles.forEach(function(f){ try{ wc.insertCSS(fs.readFileSync(f,"utf8")).catch(function(){}); }catch(e){} });
        theme.jsFiles.forEach(function(f){ try{ wc.executeJavaScript("(function(){" + fs.readFileSync(f,"utf8") + "})();").catch(function(){}); }catch(e){} });
      }
    }

    plugins.filter(function(p){ return p.enabled; }).forEach(function(p) {
      p.cssFiles.forEach(function(f){ try{ wc.insertCSS(fs.readFileSync(f,"utf8")).catch(function(){}); }catch(e){} });
      var js = p.jsFiles.map(function(f){ try{ return fs.readFileSync(f,"utf8"); }catch(e){ return ""; } }).join("\n\n");
      if (!js.trim()) return;
      var guard = "__dtp_" + p.id.replace(/\W/g,"_");
      // Wrap with DOM-ready guard so plugins that touch the DOM work correctly
      var wrapped = "(function(){" +
        "if(window[" + JSON.stringify(guard) + "])return;" +
        "window[" + JSON.stringify(guard) + "]=true;" +
        "function __run(){try{" + js + "}catch(e){" +
          "console.error('[DT Plugin " + p.id + "]',e);" +
          "window[" + JSON.stringify(guard) + "]=false;" +  // allow retry
        "}}" +
        "if(document.body){__run();}" +
        "else{document.addEventListener('DOMContentLoaded',__run);}" +
      "})()";
      wc.executeJavaScript(wrapped).catch(function(e){ console.error('[DT] Plugin inject error:', p.id, e && e.message); });
    });

    var custom = getCustomCSS();
    if (custom.trim()) wc.insertCSS(custom).catch(function(){});
  } catch(e) {
    console.error("[DT] applyAll:", e);
    notifyError("Apply Error", e && e.message);
  }
}

// ── Build renderer script ─────────────────────────────────────────────────────
function buildScript() {
  var state   = loadState();
  var themes  = getAllThemes().map(function(t){ return {id:t.id,name:t.name,author:t.author,version:t.version,description:t.description,isBD:!!t.isBD}; });
  var plugins = getAllPlugins().map(function(p){ return {id:p.id,name:p.name,author:p.author,version:p.version,description:p.description,enabled:p.enabled,isTS:!!p.isTS}; });
  var custom  = getCustomCSS();
  var active  = state.activeTheme || null;

  return `(function() {
  if (window.__dtV6) return;
  window.__dtV6 = true;

  var _themes  = ` + JSON.stringify(themes)  + `;
  var _plugins = ` + JSON.stringify(plugins) + `;
  var _custom  = ` + JSON.stringify(custom)  + `;
  var _active  = ` + JSON.stringify(active)  + `;
  var _tab     = "themes";

  // ── IPC ────────────────────────────────────────────────────────────────
  var ipc = null;
  try { ipc = require("electron").ipcRenderer; } catch(e) {}
  function send(ch, a, b) {
    if (ipc) try { return ipc.invoke(ch, a, b); } catch(e) {}
    return Promise.resolve(null);
  }

  // ── Live data updates from main (1s watcher) ───────────────────────────
  if (ipc) {
    ipc.on("dt:liveData", function(_, data) {
      _themes  = data.themes;
      _plugins = data.plugins;
      _active  = data.activeTheme;
      // Only refresh if overlay is open so we don't waste cycles
      var ov = document.getElementById("__dt-overlay");
      if (ov && ov.classList.contains("open")) refreshContent();
    });
  }

  // ── Style injection ────────────────────────────────────────────────────
  function setStyle(id, css) {
    var el = document.getElementById(id);
    if (!el) { el = document.createElement("style"); el.id = id; document.head.appendChild(el); }
    el.textContent = css;
  }
  if (_custom) setStyle("__dt-custom", _custom);

  // ── Main CSS ───────────────────────────────────────────────────────────
  setStyle("__dt-main-css", "\n    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');\n\n    #__dt-topbtn {\n      position: fixed;\n      top: 8px;\n      right: 116px;\n      z-index: 2147483647;\n      height: 28px;\n      padding: 0 12px;\n      border-radius: 6px;\n      border: none;\n      background: linear-gradient(135deg, #5865f2, #7289da);\n      color: #fff;\n      font-size: 11px;\n      font-weight: 700;\n      letter-spacing: .3px;\n      cursor: pointer;\n      display: flex;\n      align-items: center;\n      gap: 5px;\n      font-family: \"gg sans\", \"Noto Sans\", system-ui, sans-serif;\n      box-shadow: 0 2px 8px rgba(88,101,242,.4);\n      transition: transform .15s, box-shadow .15s;\n    }\n    #__dt-topbtn:hover {\n      transform: translateY(-1px);\n      box-shadow: 0 4px 14px rgba(88,101,242,.5);\n    }\n    #__dt-topbtn:active { transform: translateY(0); }\n\n    /* ── Settings panel overlay ── */\n    #__dt-overlay {\n      position: fixed;\n      inset: 0;\n      z-index: 2147483640;\n      display: none;\n      background: var(--background-primary, #313338);\n      flex-direction: row;\n      overflow: hidden;\n      font-family: \"gg sans\", \"Noto Sans\", system-ui, sans-serif;\n      animation: __dt-fadein .15s ease;\n    }\n    @keyframes __dt-fadein { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: scale(1); } }\n    #__dt-overlay.open { display: flex; }\n\n    /* Sidebar */\n    #__dt-sidebar {\n      width: 240px;\n      min-width: 240px;\n      background: var(--background-secondary, #2b2d31);\n      display: flex;\n      flex-direction: column;\n      padding: 56px 8px 20px;\n      overflow-y: auto;\n      box-sizing: border-box;\n      border-right: 1px solid var(--background-modifier-accent, rgba(255,255,255,.06));\n    }\n    #__dt-sidebar::-webkit-scrollbar { width: 4px; }\n    #__dt-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 2px; }\n    .dt-sidebar-logo {\n      display: flex;\n      align-items: center;\n      gap: 10px;\n      padding: 0 10px 16px;\n      margin-bottom: 4px;\n      border-bottom: 1px solid var(--background-modifier-accent, rgba(255,255,255,.06));\n    }\n    .dt-sidebar-logo-icon {\n      width: 28px; height: 28px;\n      border-radius: 8px;\n      background: linear-gradient(135deg,#5865f2,#7289da);\n      display: flex; align-items: center; justify-content: center;\n      font-size: 14px;\n      flex-shrink: 0;\n      box-shadow: 0 2px 8px rgba(88,101,242,.35);\n    }\n    .dt-sidebar-logo-text {\n      font-size: 14px;\n      font-weight: 700;\n      color: var(--header-primary, #f2f3f5);\n      letter-spacing: -.1px;\n    }\n    .dt-sidebar-logo-ver {\n      font-size: 10px;\n      color: var(--text-muted, #80848e);\n      font-weight: 400;\n      margin-top: 1px;\n    }\n    .dt-sidebar-header {\n      padding: 12px 10px 4px;\n      font-size: 10px;\n      font-weight: 700;\n      text-transform: uppercase;\n      letter-spacing: .8px;\n      color: var(--channels-default, #80848e);\n      margin-bottom: 2px;\n    }\n    .dt-nav-item {\n      padding: 7px 10px;\n      border-radius: 6px;\n      font-size: 13.5px;\n      color: var(--interactive-normal, #949ba4);\n      cursor: pointer;\n      margin-bottom: 1px;\n      display: flex;\n      align-items: center;\n      gap: 9px;\n      transition: background .1s, color .1s;\n      user-select: none;\n      font-weight: 500;\n    }\n    .dt-nav-item:hover {\n      background: var(--background-modifier-hover, rgba(255,255,255,.06));\n      color: var(--interactive-hover, #dbdee1);\n    }\n    .dt-nav-item.active {\n      background: rgba(88,101,242,.15);\n      color: #7289da;\n    }\n    .dt-nav-item .dt-nav-icon {\n      width: 18px; text-align: center; font-size: 14px; flex-shrink: 0;\n    }\n    .dt-nav-sep {\n      height: 1px;\n      background: var(--background-modifier-accent, rgba(255,255,255,.06));\n      margin: 8px 6px;\n    }\n    .dt-nav-quick {\n      padding: 6px 10px;\n      border-radius: 6px;\n      font-size: 12px;\n      color: var(--text-muted, #80848e);\n      cursor: pointer;\n      display: flex;\n      align-items: center;\n      gap: 8px;\n      transition: background .1s, color .1s;\n    }\n    .dt-nav-quick:hover {\n      background: var(--background-modifier-hover, rgba(255,255,255,.06));\n      color: var(--interactive-hover, #dbdee1);\n    }\n\n    /* Content area */\n    #__dt-content {\n      flex: 1;\n      overflow-y: auto;\n      padding: 48px 48px 48px;\n      box-sizing: border-box;\n      max-width: 900px;\n    }\n    #__dt-content::-webkit-scrollbar { width: 6px; }\n    #__dt-content::-webkit-scrollbar-track { background: transparent; }\n    #__dt-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 3px; }\n\n    /* Close button */\n    #__dt-close {\n      position: absolute;\n      top: 14px;\n      right: 14px;\n      width: 32px;\n      height: 32px;\n      border-radius: 8px;\n      border: none;\n      background: var(--background-modifier-hover, rgba(255,255,255,.06));\n      color: var(--interactive-normal, #949ba4);\n      font-size: 16px;\n      cursor: pointer;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      z-index: 10;\n      transition: background .15s, color .15s;\n    }\n    #__dt-close:hover { background: var(--status-danger, #ed4245); color: #fff; }\n\n    /* Page header */\n    .dt-page-header {\n      margin-bottom: 24px;\n      padding-bottom: 16px;\n      border-bottom: 1px solid var(--background-modifier-accent, rgba(255,255,255,.06));\n    }\n    .dt-page-title {\n      font-size: 22px;\n      font-weight: 700;\n      color: var(--header-primary, #f2f3f5);\n      margin: 0 0 4px;\n      letter-spacing: -.3px;\n    }\n    .dt-page-sub {\n      font-size: 13px;\n      color: var(--text-muted, #80848e);\n      margin: 0;\n      line-height: 1.5;\n    }\n    .dt-section-title {\n      font-size: 10px;\n      font-weight: 700;\n      text-transform: uppercase;\n      letter-spacing: .8px;\n      color: var(--text-muted, #80848e);\n      margin: 24px 0 10px;\n    }\n\n    /* Cards */\n    .dt-card {\n      background: var(--background-secondary, #2b2d31);\n      border-radius: 10px;\n      margin-bottom: 8px;\n      overflow: hidden;\n      border: 1px solid var(--background-modifier-accent, rgba(255,255,255,.04));\n      transition: border-color .15s;\n    }\n    .dt-card:hover { border-color: rgba(255,255,255,.09); }\n    .dt-card-inner {\n      display: flex;\n      align-items: flex-start;\n      justify-content: space-between;\n      padding: 14px 16px;\n      gap: 14px;\n    }\n    .dt-card-title {\n      font-size: 14px;\n      font-weight: 600;\n      color: var(--header-primary, #f2f3f5);\n      margin-bottom: 3px;\n      display: flex;\n      align-items: center;\n      gap: 7px;\n      flex-wrap: wrap;\n    }\n    .dt-card-meta {\n      font-size: 12px;\n      color: var(--text-muted, #80848e);\n      margin-bottom: 2px;\n      line-height: 1.5;\n    }\n    .dt-badge {\n      font-size: 10px;\n      font-weight: 700;\n      padding: 2px 7px;\n      border-radius: 10px;\n      line-height: 1.4;\n    }\n    .dt-badge-active { background: rgba(88,101,242,.25); color: #7289da; border: 1px solid rgba(88,101,242,.3); }\n    .dt-badge-bd     { background: var(--background-tertiary,#1e1f22); color: var(--text-muted,#80848e); border: 1px solid rgba(255,255,255,.06); }\n\n    /* Toggle switch */\n    .dt-toggle {\n      width: 42px;\n      min-width: 42px;\n      height: 24px;\n      border-radius: 12px;\n      cursor: pointer;\n      position: relative;\n      transition: background .2s;\n      flex-shrink: 0;\n      margin-top: 2px;\n    }\n    .dt-toggle-knob {\n      position: absolute;\n      top: 3px;\n      width: 18px;\n      height: 18px;\n      border-radius: 50%;\n      background: #fff;\n      transition: left .2s cubic-bezier(.4,0,.2,1);\n      box-shadow: 0 1px 4px rgba(0,0,0,.4);\n    }\n\n    /* Buttons */\n    .dt-btn {\n      border: none;\n      border-radius: 6px;\n      padding: 7px 14px;\n      cursor: pointer;\n      font-size: 13px;\n      font-weight: 600;\n      transition: filter .15s, transform .1s;\n      font-family: inherit;\n      white-space: nowrap;\n    }\n    .dt-btn:hover { filter: brightness(1.12); }\n    .dt-btn:active { transform: scale(.97); }\n    .dt-btn-brand  { background: #5865f2; color: #fff; box-shadow: 0 1px 6px rgba(88,101,242,.3); }\n    .dt-btn-danger { background: #ed4245; color: #fff; box-shadow: 0 1px 6px rgba(237,66,69,.3); }\n    .dt-btn-ghost  { background: var(--background-modifier-selected,rgba(255,255,255,.08)); color: var(--text-normal,#dbdee1); border: 1px solid rgba(255,255,255,.07); }\n    .dt-btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 5px; }\n\n    /* System rows */\n    .dt-sys-row {\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      padding: 14px 16px;\n      background: var(--background-secondary,#2b2d31);\n      border-radius: 10px;\n      margin-bottom: 8px;\n      border: 1px solid var(--background-modifier-accent,rgba(255,255,255,.04));\n    }\n    .dt-sys-label { font-size: 14px; color: var(--header-primary,#f2f3f5); font-weight: 500; }\n    .dt-sys-desc  { font-size: 12px; color: var(--text-muted,#80848e); margin-top:2px; }\n\n    /* Textarea / code editor */\n    .dt-textarea {\n      width: 100%;\n      background: #1e1f22;\n      border: 1px solid rgba(255,255,255,.08);\n      border-radius: 8px;\n      color: #d4d7dc;\n      font-family: \"Fira Code\", \"Cascadia Code\", \"Consolas\", monospace;\n      font-size: 12.5px;\n      padding: 12px 14px;\n      box-sizing: border-box;\n      resize: vertical;\n      outline: none;\n      line-height: 1.7;\n      height: 200px;\n      transition: border-color .2s;\n    }\n    .dt-textarea:focus { border-color: #5865f2; box-shadow: 0 0 0 3px rgba(88,101,242,.12); }\n\n    /* Search */\n    .dt-search {\n      width: 100%;\n      background: var(--background-tertiary,#1e1f22);\n      border: 1px solid rgba(255,255,255,.07);\n      border-radius: 8px;\n      color: var(--text-normal,#dbdee1);\n      font-size: 13px;\n      padding: 9px 13px;\n      box-sizing: border-box;\n      outline: none;\n      font-family: inherit;\n      margin-bottom: 16px;\n      transition: border-color .2s;\n    }\n    .dt-search:focus { border-color: #5865f2; }\n\n    /* Notice bar */\n    .dt-notice {\n      background: rgba(88,101,242,.12);\n      border: 1px solid rgba(88,101,242,.25);\n      border-radius: 8px;\n      padding: 10px 14px;\n      font-size: 13px;\n      color: var(--text-normal,#dbdee1);\n      margin-bottom: 16px;\n    }\n\n    /* Empty state */\n    .dt-empty {\n      text-align: center;\n      padding: 48px 20px;\n      color: var(--text-muted,#80848e);\n      font-size: 14px;\n      line-height: 1.8;\n    }\n    .dt-empty-icon { font-size: 44px; margin-bottom: 14px; display: block; }\n    .dt-empty code {\n      display: inline-block;\n      background: var(--background-secondary,#2b2d31);\n      padding: 2px 8px;\n      border-radius: 5px;\n      font-size: 12px;\n      font-family: monospace;\n      border: 1px solid rgba(255,255,255,.06);\n    }\n\n    /* ── Snippets tab ─── */\n    .dt-snippet-grid {\n      display: grid;\n      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));\n      gap: 8px;\n      margin-bottom: 12px;\n    }\n    .dt-snippet-card {\n      background: var(--background-secondary,#2b2d31);\n      border: 1px solid rgba(255,255,255,.05);\n      border-radius: 10px;\n      padding: 14px;\n      cursor: pointer;\n      transition: border-color .15s, background .15s;\n      position: relative;\n      overflow: hidden;\n    }\n    .dt-snippet-card:hover { border-color: rgba(88,101,242,.4); background: rgba(88,101,242,.05); }\n    .dt-snippet-card-label {\n      font-size: 12.5px;\n      font-weight: 600;\n      color: var(--header-primary,#f2f3f5);\n      margin-bottom: 3px;\n    }\n    .dt-snippet-card-desc {\n      font-size: 11px;\n      color: var(--text-muted,#80848e);\n      margin-bottom: 8px;\n      line-height: 1.4;\n    }\n    .dt-snippet-preview {\n      font-family: \"Fira Code\",\"Consolas\",monospace;\n      font-size: 10.5px;\n      color: #7289da;\n      background: rgba(88,101,242,.08);\n      border-radius: 5px;\n      padding: 5px 8px;\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n    }\n    .dt-snippet-copied {\n      position: absolute;\n      inset: 0;\n      background: rgba(87,242,135,.15);\n      border: 1px solid rgba(87,242,135,.4);\n      border-radius: 10px;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      font-size: 13px;\n      font-weight: 700;\n      color: #57f287;\n      opacity: 0;\n      pointer-events: none;\n      transition: opacity .2s;\n    }\n    .dt-snippet-card.copied .dt-snippet-copied { opacity: 1; }\n\n    /* CSS editor area with copy bar */\n    .dt-snippet-editor-wrap { margin-top: 16px; }\n    .dt-snippet-editor-bar {\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      margin-bottom: 6px;\n    }\n    .dt-snippet-editor-title { font-size: 12px; font-weight: 600; color: var(--text-muted,#80848e); text-transform: uppercase; letter-spacing: .6px; }\n\n    /* Tab pill row */\n    .dt-tab-pills {\n      display: flex;\n      gap: 4px;\n      margin-bottom: 18px;\n      flex-wrap: wrap;\n    }\n    .dt-tab-pill {\n      padding: 5px 12px;\n      border-radius: 20px;\n      font-size: 12px;\n      font-weight: 600;\n      cursor: pointer;\n      border: 1px solid rgba(255,255,255,.08);\n      background: transparent;\n      color: var(--text-muted,#80848e);\n      transition: all .15s;\n      font-family: inherit;\n    }\n    .dt-tab-pill.active, .dt-tab-pill:hover {\n      background: rgba(88,101,242,.15);\n      border-color: rgba(88,101,242,.35);\n      color: #7289da;\n    }\n\n    /* Stats strip */\n    .dt-stats-strip {\n      display: flex;\n      gap: 8px;\n      margin-bottom: 20px;\n    }\n    .dt-stat-chip {\n      background: var(--background-secondary,#2b2d31);\n      border: 1px solid rgba(255,255,255,.05);\n      border-radius: 8px;\n      padding: 10px 16px;\n      flex: 1;\n      text-align: center;\n    }\n    .dt-stat-num { font-size: 20px; font-weight: 700; color: var(--header-primary,#f2f3f5); }\n    .dt-stat-lbl { font-size: 11px; color: var(--text-muted,#80848e); margin-top: 2px; }\n  ");

  // ── Render helpers ─────────────────────────────────────────────────────

  function toggle(id, on) {
    return '<div class="dt-toggle" data-a="toggle" data-id="' + id + '" data-on="' + on + '" style="background:' + (on ? '#5865f2' : 'rgba(255,255,255,.12)') + '">'
      + '<div class="dt-toggle-knob" style="left:' + (on ? '21px' : '3px') + '"></div>'
      + '</div>';
  }

  function pageHeader(title, sub) {
    return '<div class="dt-page-header"><h2 class="dt-page-title">' + title + '</h2><p class="dt-page-sub">' + sub + '</p></div>';
  }

  // ── SNIPPETS DATA ───────────────────────────────────────────────────────
  var SNIPPETS = {
    scrollbar: [
      { label: "Hide Settings Scrollbar", desc: "Removes the scrollbar in Discord's settings sidebar", code: '[class*="sidebar"] ::-webkit-scrollbar { display: none; }' },
      { label: "Thin Settings Scrollbar", desc: "Slim 3px scrollbar for the settings panel", code: '[class*="sidebar"] ::-webkit-scrollbar { width: 3px; }\n[class*="sidebar"] ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }' },
      { label: "Hide All Scrollbars", desc: "Remove all scrollbars across Discord", code: '::-webkit-scrollbar { display: none !important; }' },
      { label: "Colored Scrollbar", desc: "Brand-colored scrollbar throughout", code: '::-webkit-scrollbar { width: 4px; }\n::-webkit-scrollbar-thumb { background: #5865f2; border-radius: 4px; }\n::-webkit-scrollbar-track { background: transparent; }' },
    ],
    sidebar: [
      { label: "Settings Sidebar Background", desc: "Change the settings sidebar background color", code: '[class*="sidebar-"] { background: #1e1f22 !important; }' },
      { label: "Settings Sidebar Width", desc: "Widen the settings nav sidebar", code: '[class*="sidebar-"] { width: 260px !important; min-width: 260px !important; }' },
      { label: "Hide Settings Nav Labels", desc: "Icon-only settings sidebar", code: '[class*="sidebar-"] [class*="item-"] { font-size: 0 !important; }\n[class*="sidebar-"] [class*="item-"]::before { font-size: 14px !important; }' },
      { label: "Rounded Sidebar Items", desc: "More rounded nav items in settings", code: '[class*="sidebar-"] [class*="item-"] { border-radius: 8px !important; }' },
    ],
    misc: [
      { label: "Hide Nitro Upsell", desc: "Remove Nitro upgrade prompts from settings", code: '[class*="premiumTab-"], [class*="upsell-"] { display: none !important; }' },
      { label: "Hide Settings Keybind Hints", desc: "Remove the keyboard shortcut hints", code: '[class*="keybind-"] { display: none !important; }' },
      { label: "Settings Font Override", desc: "Change the font in settings", code: '[class*="standardSidebarView-"] { font-family: "Inter", sans-serif !important; }' },
      { label: "Blur Settings BG", desc: "Frosted glass settings panel background", code: '[class*="contentRegion-"] { backdrop-filter: blur(20px); background: rgba(30,31,34,.85) !important; }' },
    ],
  };

  function renderSnippetCard(s, idx, cat) {
    var preview = s.code.split('\n')[0];
    return '<div class="dt-snippet-card" data-a="snippet-copy" data-code="' + encodeURIComponent(s.code) + '" data-idx="' + cat + '-' + idx + '">'
      + '<div class="dt-snippet-card-label">' + s.label + '</div>'
      + '<div class="dt-snippet-card-desc">' + s.desc + '</div>'
      + '<div class="dt-snippet-preview">' + preview.replace(/</g,'&lt;') + '</div>'
      + '<div class="dt-snippet-copied">✓ Copied to CSS editor!</div>'
      + '</div>';
  }

  function renderSnippets() {
    var customVal = (_custom || "").replace(/&/g,"&amp;").replace(/</g,"&lt;");
    var html = pageHeader("CSS Snippets", "Click any snippet to copy it into your Custom CSS editor. All snippets target Discord's settings area.");

    html += '<div class="dt-section-title">Scrollbar</div><div class="dt-snippet-grid">';
    SNIPPETS.scrollbar.forEach(function(s,i){ html += renderSnippetCard(s,i,"scrollbar"); });
    html += '</div>';

    html += '<div class="dt-section-title">Settings Sidebar</div><div class="dt-snippet-grid">';
    SNIPPETS.sidebar.forEach(function(s,i){ html += renderSnippetCard(s,i,"sidebar"); });
    html += '</div>';

    html += '<div class="dt-section-title">Misc</div><div class="dt-snippet-grid">';
    SNIPPETS.misc.forEach(function(s,i){ html += renderSnippetCard(s,i,"misc"); });
    html += '</div>';

    html += '<div class="dt-section-title">Custom CSS</div>'
      + '<div class="dt-snippet-editor-wrap">'
      + '<div class="dt-snippet-editor-bar">'
      + '<span class="dt-snippet-editor-title">Editing custom.css</span>'
      + '<div style="display:flex;gap:6px">'
      + '<button class="dt-btn dt-btn-sm dt-btn-ghost" data-a="css-clear">Clear</button>'
      + '<button class="dt-btn dt-btn-sm dt-btn-brand" data-a="css-apply">Apply & Save</button>'
      + '</div></div>'
      + '<textarea class="dt-textarea" id="__dt-css-in" placeholder="/* Paste or write CSS here, or click a snippet above */" style="height:220px">' + customVal + '</textarea>'
      + '</div>';
    return html;
  }

  function renderThemes() {
    var activeThemeObj = _themes.find(function(t){ return t.id === _active; });
    var html = pageHeader("Themes", "Apply CSS themes to Discord. Supports BetterDiscord .css files and folder themes.");

    // Stats strip
    html += '<div class="dt-stats-strip">'
      + '<div class="dt-stat-chip"><div class="dt-stat-num">' + _themes.length + '</div><div class="dt-stat-lbl">Installed</div></div>'
      + '<div class="dt-stat-chip"><div class="dt-stat-num">' + (_active ? '1' : '0') + '</div><div class="dt-stat-lbl">Active</div></div>'
      + '<div class="dt-stat-chip"><div class="dt-stat-num">' + _themes.filter(function(t){return t.isBD;}).length + '</div><div class="dt-stat-lbl">BD Compat</div></div>'
      + '</div>';

    html += '<input class="dt-search" placeholder="Search themes..." id="__dt-theme-search">';

    if (_themes.length === 0) {
      html += '<div class="dt-empty"><span class="dt-empty-icon">🎨</span>'
        + 'No themes installed.<br>Drop themes into<br><code>%APPDATA%\\DiscordThemer\\themes\\</code></div>';
    } else {
      _themes.forEach(function(t) {
        var on = t.id === _active;
        html += '<div class="dt-card dt-theme-card" data-name="' + t.name.toLowerCase() + '">'
          + '<div class="dt-card-inner">'
          + '<div style="flex:1;min-width:0">'
          + '<div class="dt-card-title">' + t.name
          + (on ? '<span class="dt-badge dt-badge-active">Active</span>' : '')
          + (t.isBD ? '<span class="dt-badge dt-badge-bd">BD</span>' : '')
          + '</div>'
          + '<div class="dt-card-meta">by ' + t.author + (t.version ? ' &nbsp;·&nbsp; v' + t.version : '') + '</div>'
          + (t.description ? '<div class="dt-card-meta" style="margin-top:2px">' + t.description + '</div>' : '')
          + '</div>'
          + '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0">'
          + (on
            ? '<button class="dt-btn dt-btn-danger dt-btn-sm" data-a="theme-off">Disable</button>'
            : '<button class="dt-btn dt-btn-brand dt-btn-sm" data-a="theme-on" data-id="' + t.id + '">Apply</button>'
          )
          + '</div></div></div>';
      });
    }
    return html;
  }

  function renderPlugins() {
    var enabledCount = _plugins.filter(function(p){ return p.enabled; }).length;
    var html = pageHeader("Plugins", "Extend Discord with JavaScript plugins. Toggle to enable or disable instantly.");

    html += '<div class="dt-stats-strip">'
      + '<div class="dt-stat-chip"><div class="dt-stat-num">' + _plugins.length + '</div><div class="dt-stat-lbl">Installed</div></div>'
      + '<div class="dt-stat-chip"><div class="dt-stat-num">' + enabledCount + '</div><div class="dt-stat-lbl">Enabled</div></div>'
      + '<div class="dt-stat-chip"><div class="dt-stat-num">' + _plugins.filter(function(p){return p.isTS;}).length + '</div><div class="dt-stat-lbl">TS Only</div></div>'
      + '</div>';

    html += '<input class="dt-search" placeholder="Search plugins..." id="__dt-plugin-search">';

    if (_plugins.length === 0) {
      html += '<div class="dt-empty"><span class="dt-empty-icon">🧩</span>'
        + 'No plugins installed.<br>Drop plugin folders into<br><code>%APPDATA%\\DiscordThemer\\plugins\\</code>'
        + '<br><br><span style="font-size:12px">Each plugin needs a folder with<br><strong>index.js</strong> + <strong>plugin.json</strong></span></div>';
    } else {
      _plugins.forEach(function(p) {
        var tsBadge = p.isTS
          ? '<span style="font-size:10px;font-weight:700;background:#ed4245;color:#fff;padding:2px 7px;border-radius:10px;margin-left:6px">discord-themer only</span>'
          : '';
        var tsNote = p.isTS
          ? '<div class="dt-card-meta" style="color:#faa61a;margin-top:4px">⚠ Needs discord-themer — cannot load as plain JS.</div>'
          : '';
        html += '<div class="dt-card dt-plugin-card" data-name="' + p.name.toLowerCase() + '">'
          + '<div class="dt-card-inner">'
          + '<div style="flex:1;min-width:0">'
          + '<div class="dt-card-title">' + p.name + tsBadge + '</div>'
          + '<div class="dt-card-meta">by ' + p.author + (p.version ? ' &nbsp;·&nbsp; v' + p.version : '') + '</div>'
          + (p.description ? '<div class="dt-card-meta" style="margin-top:2px">' + p.description + '</div>' : '')
          + tsNote
          + '</div>'
          + (p.isTS
            ? '<div style="font-size:11px;color:#87898c;align-self:center;white-space:nowrap">Not supported</div>'
            : toggle(p.id, p.enabled))
          + '</div></div>';
      });
    }
    return html;
  }

  function renderSystem() {
    return pageHeader("System", "Manage Discord and DiscordThemer.")
      + '<div class="dt-stats-strip">'
      + '<div class="dt-stat-chip"><div class="dt-stat-num">' + _themes.length + '</div><div class="dt-stat-lbl">Themes</div></div>'
      + '<div class="dt-stat-chip"><div class="dt-stat-num">' + _plugins.length + '</div><div class="dt-stat-lbl">Plugins</div></div>'
      + '<div class="dt-stat-chip"><div class="dt-stat-num" style="font-size:13px;padding-top:2px">' + (_active || '—') + '</div><div class="dt-stat-lbl">Active Theme</div></div>'
      + '</div>'

      + '<div class="dt-section-title">Discord</div>'
      + '<div class="dt-sys-row"><div><div class="dt-sys-label">Reload Discord</div><div class="dt-sys-desc">Refreshes the window. Re-injects themes and plugins.</div></div><button class="dt-btn dt-btn-brand dt-btn-sm" data-a="sys-reload">Reload</button></div>'
      + '<div class="dt-sys-row"><div><div class="dt-sys-label">Restart Discord</div><div class="dt-sys-desc">Fully restarts and re-injects on startup.</div></div><button class="dt-btn dt-btn-ghost dt-btn-sm" data-a="sys-restart">Restart</button></div>'
      + '<div class="dt-sys-row"><div><div class="dt-sys-label">Close Discord</div><div class="dt-sys-desc">Completely closes Discord and all background processes.</div></div><button class="dt-btn dt-btn-danger dt-btn-sm" data-a="sys-close">Close</button></div>'

      + '<div class="dt-section-title">DiscordThemer</div>'
      + '<div class="dt-sys-row"><div><div class="dt-sys-label">Disable Active Theme</div><div class="dt-sys-desc">Removes the current theme. Discord will reload.</div></div><button class="dt-btn dt-btn-ghost dt-btn-sm" data-a="theme-off">Disable Theme</button></div>'
      + '<div class="dt-sys-row"><div><div class="dt-sys-label">Open Config Folder</div><div class="dt-sys-desc">Opens %APPDATA%\\DiscordThemer in Explorer.</div></div><button class="dt-btn dt-btn-ghost dt-btn-sm" data-a="sys-open-folder">Open Folder</button></div>'

      + '<div class="dt-section-title">About</div>'
      + '<div class="dt-card"><div class="dt-card-inner" style="flex-direction:column;gap:6px">'
      + '<div style="font-size:15px;color:var(--header-primary,#f2f3f5);font-weight:700">DiscordThemer v6</div>'
      + '<div style="font-size:12px;color:var(--text-muted,#80848e)">Loader v6 · ' + _themes.length + ' themes · ' + _plugins.length + ' plugins</div>'
      + '<div style="font-size:12px;color:var(--text-muted,#80848e)">Active: ' + (_active || 'None') + '</div>'
      + '</div></div>';
  }

  function renderHelp() {
    return pageHeader("Help & Support", "Documentation, resources, and quick tips for DiscordThemer.")
      + '<div class="dt-section-title">Resources</div>'
      + '<div class="dt-sys-row"><div><div class="dt-sys-label">📖 GitHub Docs</div><div class="dt-sys-desc">Full documentation, theme/plugin format, API reference.</div></div><button class="dt-btn dt-btn-brand dt-btn-sm" data-a="open-url" data-url="https://github.com/zxkuhl/DiscordThemer">Open</button></div>'
      + '<div class="dt-sys-row"><div><div class="dt-sys-label">🎨 Theme Format</div><div class="dt-sys-desc">Create folder themes, BD-compatible CSS, and JS animations.</div></div><button class="dt-btn dt-btn-ghost dt-btn-sm" data-a="open-url" data-url="https://github.com/zxkuhl/DiscordThemer#theme-format">View Guide</button></div>'
      + '<div class="dt-sys-row"><div><div class="dt-sys-label">🧩 Plugin API</div><div class="dt-sys-desc">Build plugins with DOM access, CSS injection, and webpack hooks.</div></div><button class="dt-btn dt-btn-ghost dt-btn-sm" data-a="open-url" data-url="https://github.com/zxkuhl/DiscordThemer#plugin-format">View API</button></div>'
      + '<div class="dt-section-title">Community</div>'
      + '<div class="dt-sys-row"><div><div class="dt-sys-label">💬 Discord Server</div><div class="dt-sys-desc">Get help, share themes, hang out with the community.</div></div><button class="dt-btn dt-btn-brand dt-btn-sm" data-a="open-url" data-url="https://discord.gg/TdaWNwNAMa">Join</button></div>'
      + '<div class="dt-sys-row"><div><div class="dt-sys-label">🐛 Report a Bug</div><div class="dt-sys-desc">Found an issue? Open a GitHub issue.</div></div><button class="dt-btn dt-btn-ghost dt-btn-sm" data-a="open-url" data-url="https://github.com/zxkuhl/DiscordThemer/issues/new">Report</button></div>'
      + '<div class="dt-sys-row"><div><div class="dt-sys-label">⭐ Star on GitHub</div><div class="dt-sys-desc">Like the project? Give it a star!</div></div><button class="dt-btn dt-btn-ghost dt-btn-sm" data-a="open-url" data-url="https://github.com/zxkuhl/DiscordThemer">Star</button></div>'
      + '<div class="dt-section-title">Quick Tips</div>'
      + '<div class="dt-card"><div class="dt-card-inner" style="flex-direction:column;gap:12px;font-size:13px;color:var(--text-normal,#dbdee1);line-height:1.6">'
      + '<div><strong style="color:var(--header-primary,#f2f3f5)">Installing themes</strong><br>Drop a folder with <code style="background:var(--background-tertiary,#1e1f22);padding:1px 6px;border-radius:4px;font-size:11px">theme.json</code> + CSS into <code style="background:var(--background-tertiary,#1e1f22);padding:1px 6px;border-radius:4px;font-size:11px">%APPDATA%\\DiscordThemer\\themes\\</code> — or drop a .css file directly for BD-style themes.</div>'
      + '<div><strong style="color:var(--header-primary,#f2f3f5)">Installing plugins</strong><br>Drop a folder with <code style="background:var(--background-tertiary,#1e1f22);padding:1px 6px;border-radius:4px;font-size:11px">index.js</code> + <code style="background:var(--background-tertiary,#1e1f22);padding:1px 6px;border-radius:4px;font-size:11px">plugin.json</code> into <code style="background:var(--background-tertiary,#1e1f22);padding:1px 6px;border-radius:4px;font-size:11px">%APPDATA%\\DiscordThemer\\plugins\\</code> then toggle it on.</div>'
      + '<div><strong style="color:var(--header-primary,#f2f3f5)">Live updates</strong><br>The file watcher checks every second — drop in a new theme and it appears instantly without reloading Discord.</div>'
      + '<div><strong style="color:var(--header-primary,#f2f3f5)">CSS Snippets</strong><br>Use the Snippets tab to quickly copy pre-built CSS targeting Discord\'s settings scrollbar, sidebar, and more.</div>'
      + '</div></div>';
  }

  // ── NAV ────────────────────────────────────────────────────────────────
  var NAV = [
    { id: "themes",   icon: "🎨", label: "Themes"   },
    { id: "plugins",  icon: "🧩", label: "Plugins"  },
    { id: "snippets", icon: "✂️",  label: "CSS Snippets" },
    { id: "system",   icon: "⚙️",  label: "System"   },
    { id: "help",     icon: "❓", label: "Help"     },
  ];

  // ── Build full overlay ─────────────────────────────────────────────────
  function buildOverlay() {
    var sidebar = '<div id="__dt-sidebar">'
      + '<div class="dt-sidebar-logo">'
      + '<div class="dt-sidebar-logo-icon">🎨</div>'
      + '<div><div class="dt-sidebar-logo-text">DiscordThemer</div><div class="dt-sidebar-logo-ver">v6 · RMS Edition</div></div>'
      + '</div>'
      + '<div class="dt-sidebar-header">Navigation</div>';

    NAV.forEach(function(n) {
      sidebar += '<div class="dt-nav-item' + (n.id === _tab ? ' active' : '') + '" data-a="nav" data-tab="' + n.id + '">'
        + '<span class="dt-nav-icon">' + n.icon + '</span>' + n.label + '</div>';
    });

    sidebar += '<div class="dt-nav-sep"></div>'
      + '<div class="dt-sidebar-header">Quick Actions</div>'
      + '<div class="dt-nav-quick" data-a="sys-reload"><span class="dt-nav-icon">🔄</span> Reload Discord</div>'
      + '<div class="dt-nav-quick" data-a="sys-open-folder"><span class="dt-nav-icon">📁</span> Open Folder</div>'
      + '</div>';

    var content = '<div id="__dt-content">' + renderTab() + '</div>';
    var close   = '<button id="__dt-close" data-a="close" title="Close (Esc)">✕</button>';
    return sidebar + content + close;
  }

  function renderTab() {
    if (_tab === "themes")   return renderThemes();
    if (_tab === "plugins")  return renderPlugins();
    if (_tab === "snippets") return renderSnippets();
    if (_tab === "system")   return renderSystem();
    if (_tab === "help")     return renderHelp();
    return "";
  }

  // ── Mount overlay ──────────────────────────────────────────────────────

  function mount() {
    var overlay = document.getElementById("__dt-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "__dt-overlay";
      document.body.appendChild(overlay);

      // Keyboard close
      document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && overlay.classList.contains("open")) closeOverlay();
      });
    }
    overlay.innerHTML = buildOverlay();

    // Wire search filters
    wireSearch("__dt-theme-search",  ".dt-theme-card");
    wireSearch("__dt-plugin-search", ".dt-plugin-card");

    // Events
    overlay.addEventListener("click", handleClick);
  }

  function openOverlay(tab) {
    _tab = tab || _tab;
    mount();
    document.getElementById("__dt-overlay").classList.add("open");
  }

  function closeOverlay() {
    var o = document.getElementById("__dt-overlay");
    if (o) o.classList.remove("open");
  }

  function refreshContent() {
    var c = document.getElementById("__dt-content");
    if (c) {
      c.innerHTML = renderTab();
      wireSearch("__dt-theme-search",  ".dt-theme-card");
      wireSearch("__dt-plugin-search", ".dt-plugin-card");
    }
  }

  function wireSearch(inputId, cardSel) {
    var inp = document.getElementById(inputId);
    if (!inp) return;
    inp.addEventListener("input", function() {
      var q = inp.value.toLowerCase();
      document.querySelectorAll(cardSel).forEach(function(card) {
        card.style.display = (!q || card.dataset.name.includes(q)) ? "" : "none";
      });
    });
  }

  // ── Event handler ──────────────────────────────────────────────────────

  function handleClick(e) {
    var el = e.target.closest("[data-a]");
    if (!el) return;
    var a = el.getAttribute("data-a");

    if (a === "nav") {
      _tab = el.getAttribute("data-tab");
      document.querySelectorAll(".dt-nav-item").forEach(function(n) {
        n.classList.toggle("active", n.getAttribute("data-tab") === _tab);
      });
      refreshContent();

    } else if (a === "snippet-copy") {
      var code = decodeURIComponent(el.getAttribute("data-code") || "");
      // Append to custom CSS textarea
      var ta = document.getElementById("__dt-css-in");
      if (ta) {
        ta.value = (ta.value ? ta.value + "\n\n" : "") + code;
      } else {
        // If on a different tab, just switch to snippets tab and set it
        _custom = (_custom ? _custom + "\n\n" : "") + code;
      }
      // Show copied flash
      el.classList.add("copied");
      setTimeout(function() { el.classList.remove("copied"); }, 1200);

    } else if (a === "theme-on") {
      var id = el.getAttribute("data-id");
      _active = id;
      send("dt:applyTheme", id).then(refreshContent);

    } else if (a === "theme-off") {
      _active = null;
      send("dt:disableTheme").then(refreshContent);

    } else if (a === "toggle") {
      var pid = el.getAttribute("data-id");
      var on  = el.getAttribute("data-on") === "true";
      var now = !on;
      _plugins = _plugins.map(function(p) { return p.id === pid ? Object.assign({},p,{enabled:now}) : p; });
      send("dt:togglePlugin", pid, now).then(refreshContent);

    } else if (a === "css-apply") {
      var css = (document.getElementById("__dt-css-in")||{}).value || "";
      _custom = css;
      setStyle("__dt-custom", css);
      send("dt:setCustomCSS", css);

    } else if (a === "css-clear") {
      _custom = "";
      var s = document.getElementById("__dt-custom"); if (s) s.remove();
      send("dt:setCustomCSS", "").then(refreshContent);

    } else if (a === "sys-reload") {
      closeOverlay();
      setTimeout(function() { send("dt:reload"); }, 200);

    } else if (a === "sys-restart") {
      closeOverlay();
      setTimeout(function() { send("dt:restart"); }, 200);

    } else if (a === "sys-close") {
      closeOverlay();
      setTimeout(function() { send("dt:close"); }, 200);

    } else if (a === "sys-open-folder") {
      send("dt:openFolder");

    } else if (a === "open-url") {
      var url = el.getAttribute("data-url");
      if (url) send("dt:openURL", url);

    } else if (a === "close" || el.id === "__dt-close") {
      closeOverlay();
    }
  }

  // ── Top bar button ─────────────────────────────────────────────────────

  function bootBtn() {
    if (document.getElementById("__dt-topbtn")) return;
    var btn = document.createElement("button");
    btn.id = "__dt-topbtn";
    btn.innerHTML = "🎨 RMS";
    document.body.appendChild(btn);
    btn.addEventListener("click", function() { openOverlay("themes"); });
  }

  // ── Also inject into Discord settings sidebar ──────────────────────────

  function injectSettingsNav() {
    if (document.getElementById("__dt-settings-nav")) return;
    var sidebar = null;
    document.querySelectorAll('[class*="sidebar"]').forEach(function(d) {
      if (d.textContent.includes("My Account") && d.textContent.includes("Appearance")) sidebar = d;
    });
    if (!sidebar) return;

    var anchor = null;
    sidebar.querySelectorAll('[class*="item"]').forEach(function(el) {
      if (el.textContent.trim() === "Appearance") anchor = el;
    });
    if (!anchor) return;

    // Grab the exact className from Discord's own nav item so we inherit all styles
    var discordItemClass = anchor.className;

    var sep = document.createElement("div");
    sep.style.cssText = "height:1px;background:var(--background-modifier-accent,rgba(255,255,255,.06));margin:8px 10px;";

    var hdr = document.createElement("div");
    hdr.style.cssText = "padding:6px 10px 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--channels-default,#80848e);";
    hdr.textContent = "RMS";

    var wrap = document.createElement("div");
    wrap.id = "__dt-settings-nav";

    NAV.forEach(function(n) {
      var item = document.createElement("div");
      // Use Discord's exact class so it matches their styling perfectly
      item.className = discordItemClass;
      item.textContent = n.icon + "  " + n.label;
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.style.cursor = "pointer";
      item.addEventListener("click", function() {
        // Deselect all Discord items
        sidebar.querySelectorAll('[aria-selected="true"]').forEach(function(x) {
          x.setAttribute("aria-selected", "false");
        });
        item.setAttribute("aria-selected", "true");
        openOverlay(n.id);
      });
      wrap.appendChild(item);
    });

    anchor.parentNode.insertBefore(sep,  anchor.nextSibling);
    anchor.parentNode.insertBefore(hdr,  sep.nextSibling);
    anchor.parentNode.insertBefore(wrap, hdr.nextSibling);
  }

  // MutationObserver for settings sidebar
  new MutationObserver(function() {
    var s = document.querySelector('[class*="sidebar"]');
    if (s && s.textContent.includes("My Account") && s.textContent.includes("Appearance")) injectSettingsNav();
  }).observe(document.body, { childList: true, subtree: true });


  // ── Boot ───────────────────────────────────────────────────────────────
  function boot() { bootBtn(); }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);

  // Keepalive
  setInterval(function(){
    if (!document.getElementById("__dt-topbtn")) { window.__dtV6 = false; bootBtn(); window.__dtV6 = true; }
  }, 2000);

})();`;
}

// ── IPC ───────────────────────────────────────────────────────────────────────
try {
  var el      = require("electron");
  var ipcMain = el.ipcMain;
  var app     = el.app;
  var session = el.session;
  var BW      = el.BrowserWindow;
  var shell   = el.shell;

  if (!global.__dtIPC) {
    global.__dtIPC = true;

    ipcMain.handle("dt:applyTheme", function(_, id) {
      try {
        var s = loadState(); s.activeTheme = id; saveState(s);
        BW.getAllWindows().forEach(function(w){ applyAll(w.webContents); });
        notify("Theme Applied", id);
        return { ok: true };
      } catch(e) { notifyError("Apply Theme Failed", e && e.message); return { ok: false }; }
    });

    ipcMain.handle("dt:disableTheme", function() {
      try {
        var s = loadState(); s.activeTheme = null; saveState(s);
        BW.getAllWindows().forEach(function(w){ w.webContents.reload(); });
        notify("Theme Disabled", "No theme active");
        return { ok: true };
      } catch(e) { notifyError("Disable Theme Failed", e && e.message); return { ok: false }; }
    });

    ipcMain.handle("dt:togglePlugin", function(_, id, enabled) {
      try {
        var s = loadState(); if (!s.plugins) s.plugins = {}; s.plugins[id] = enabled; saveState(s);
        if (enabled) {
          var plugin = getAllPlugins().find(function(p){ return p.id === id; });
          if (plugin) {
            BW.getAllWindows().forEach(function(w) {
              plugin.cssFiles.forEach(function(f){ try{ w.webContents.insertCSS(fs.readFileSync(f,"utf8")).catch(function(){}); }catch(e){} });
              var js = plugin.jsFiles.map(function(f){ try{ return fs.readFileSync(f,"utf8"); }catch(e){ return ""; } }).join("\n\n");
              if (js.trim()) {
                var guard = "__dtp_" + id.replace(/\W/g,"_");
                // Reset guard so re-enabling works after disable
                w.webContents.executeJavaScript("window[" + JSON.stringify(guard) + "]=false;").catch(function(){});
                var wrapped = "(function(){" +
                  "if(window[" + JSON.stringify(guard) + "])return;" +
                  "window[" + JSON.stringify(guard) + "]=true;" +
                  "function __run(){try{" + js + "}catch(e){" +
                    "console.error('[DT Plugin " + id + "]',e);" +
                    "window[" + JSON.stringify(guard) + "]=false;" +
                  "}}" +
                  "if(document.body){__run();}" +
                  "else{document.addEventListener('DOMContentLoaded',__run);}" +
                "})()";
                w.webContents.executeJavaScript(wrapped).catch(function(e){ console.error("[DT] Plugin toggle inject:", id, e && e.message); });
              }
            });
          }
          notify("Plugin Enabled", id);
        } else {
          BW.getAllWindows().forEach(function(w){ w.webContents.reload(); });
          notify("Plugin Disabled", id);
        }
        return { ok: true };
      } catch(e) { notifyError("Toggle Plugin Failed", id + ": " + (e && e.message)); return { ok: false }; }
    });

    ipcMain.handle("dt:setCustomCSS", function(_, css) {
      try {
        setCustomCSS(css);
        BW.getAllWindows().forEach(function(w){ w.webContents.insertCSS(css).catch(function(){}); });
        return { ok: true };
      } catch(e) { notifyError("CSS Error", e && e.message); return { ok: false }; }
    });

    ipcMain.handle("dt:reload",  function() { BW.getAllWindows().forEach(function(w){ w.webContents.reload(); }); return { ok: true }; });
    ipcMain.handle("dt:restart", function() { app.relaunch(); app.quit(); return { ok: true }; });
    ipcMain.handle("dt:close",   function() { app.quit(); return { ok: true }; });
    ipcMain.handle("dt:openFolder", function() {
      fs.mkdirSync(BASE, { recursive: true });
      shell.openPath(BASE);
      return { ok: true };
    });

    ipcMain.handle("dt:openURL", function(_, url) {
      try {
        if (url && (url.startsWith("https://") || url.startsWith("http://"))) {
          shell.openExternal(url);
        }
      } catch(e) {}
      return { ok: true };
    });
  }

  // ── CSP bypass ────────────────────────────────────────────────────────
  try {
    session.defaultSession.webRequest.onHeadersReceived(function(details, cb) {
      var h = Object.assign({}, details.responseHeaders);
      delete h["content-security-policy"]; delete h["Content-Security-Policy"];
      cb({ responseHeaders: h });
    });
  } catch(e) {}

  // ── Inject ────────────────────────────────────────────────────────────
  function inject(wc) {
    try { applyAll(wc); wc.executeJavaScript(buildScript()).catch(function(){}); } catch(e) {}
  }

  setTimeout(function(){ BW.getAllWindows().forEach(function(w){ inject(w.webContents); }); }, 500);
  setTimeout(function(){ BW.getAllWindows().forEach(function(w){ inject(w.webContents); }); }, 2000);

  app.on("browser-window-created", function(_, win) {
    win.webContents.on("dom-ready",            function(){ inject(win.webContents); });
    win.webContents.on("did-navigate-in-page", function(){ inject(win.webContents); });
  });
  BW.getAllWindows().forEach(function(win) {
    win.webContents.on("did-navigate-in-page", function(){ inject(win.webContents); });
  });

  // ── 1s AppData watcher — push live theme/plugin list to all renderers ─
  if (!global.__dtWatcher) {
    global.__dtWatcher = true;
    setInterval(function() {
      try {
        var themes  = getAllThemes().map(function(t){ return {id:t.id,name:t.name,author:t.author,version:t.version,description:t.description,isBD:!!t.isBD}; });
        var plugins = getAllPlugins().map(function(p){ return {id:p.id,name:p.name,author:p.author,version:p.version,description:p.description,enabled:p.enabled,isTS:!!p.isTS}; });
        var state   = loadState();
        var data    = { themes: themes, plugins: plugins, activeTheme: state.activeTheme || null };
        BW.getAllWindows().forEach(function(w) {
          try { w.webContents.send("dt:liveData", data); } catch(e) {}
        });
      } catch(e) { console.error("[DT] watcher error:", e && e.message); }
    }, 1000);
  }

  console.log("[DiscordThemer] Loader v6 initialized ✓");
} catch(e) {
  console.error("[DiscordThemer] Fatal:", e && e.message);
}