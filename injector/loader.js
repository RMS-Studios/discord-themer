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
  setStyle("__dt-main-css", \`
    #__dt-topbtn {
      position: fixed;
      top: 8px;
      right: 116px;
      z-index: 2147483647;
      height: 24px;
      padding: 0 10px;
      border-radius: 4px;
      border: none;
      background: var(--brand-experiment, #5865f2);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      font-family: "gg sans", "Noto Sans", system-ui, sans-serif;
      box-shadow: 0 1px 4px rgba(0,0,0,.4);
      transition: filter .15s;
    }
    #__dt-topbtn:hover { filter: brightness(1.1); }

    /* ── Settings panel overlay ── */
    #__dt-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483640;
      display: none;
      background: var(--background-primary, #313338);
      flex-direction: row;
      overflow: hidden;
      font-family: "gg sans", "Noto Sans", system-ui, sans-serif;
    }
    #__dt-overlay.open { display: flex; }

    /* Sidebar */
    #__dt-sidebar {
      width: 232px;
      min-width: 232px;
      background: var(--background-secondary, #2b2d31);
      display: flex;
      flex-direction: column;
      padding: 60px 6px 20px;
      overflow-y: auto;
      box-sizing: border-box;
    }
    .dt-sidebar-header {
      padding: 6px 10px 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .5px;
      color: var(--channels-default, #80848e);
      margin-bottom: 2px;
    }
    .dt-nav-item {
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 14px;
      color: var(--interactive-normal, #949ba4);
      cursor: pointer;
      margin-bottom: 1px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background .1s, color .1s;
      user-select: none;
    }
    .dt-nav-item:hover {
      background: var(--background-modifier-hover, rgba(255,255,255,.06));
      color: var(--interactive-hover, #dbdee1);
    }
    .dt-nav-item.active {
      background: var(--background-modifier-selected, rgba(255,255,255,.1));
      color: var(--interactive-active, #f2f3f5);
    }
    .dt-nav-sep {
      height: 1px;
      background: var(--background-modifier-accent, rgba(255,255,255,.06));
      margin: 8px 10px;
    }

    /* Content area */
    #__dt-content {
      flex: 1;
      overflow-y: auto;
      padding: 60px 40px 40px;
      box-sizing: border-box;
    }
    #__dt-content::-webkit-scrollbar { width: 6px; }
    #__dt-content::-webkit-scrollbar-track { background: transparent; }
    #__dt-content::-webkit-scrollbar-thumb { background: var(--scrollbar-thin-thumb, #1a1b1e); border-radius: 3px; }

    /* Close button */
    #__dt-close {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: var(--background-modifier-hover, rgba(255,255,255,.06));
      color: var(--interactive-normal, #949ba4);
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      transition: background .15s, color .15s;
    }
    #__dt-close:hover {
      background: var(--status-danger, #ed4245);
      color: #fff;
    }

    /* Page title */
    .dt-page-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--header-primary, #f2f3f5);
      margin: 0 0 4px;
    }
    .dt-page-sub {
      font-size: 14px;
      color: var(--text-muted, #80848e);
      margin: 0 0 24px;
    }
    .dt-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .5px;
      color: var(--text-muted, #80848e);
      margin: 20px 0 8px;
    }

    /* Cards */
    .dt-card {
      background: var(--background-secondary, #2b2d31);
      border-radius: 8px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .dt-card-inner {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 16px;
      gap: 12px;
    }
    .dt-card-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--header-primary, #f2f3f5);
      margin-bottom: 3px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .dt-card-meta {
      font-size: 12px;
      color: var(--text-muted, #80848e);
      margin-bottom: 3px;
    }
    .dt-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 3px;
      line-height: 1.4;
    }
    .dt-badge-active { background: var(--brand-experiment,#5865f2); color: #fff; }
    .dt-badge-bd     { background: var(--background-tertiary,#1e1f22); color: var(--text-muted,#80848e); }

    /* Toggle switch */
    .dt-toggle {
      width: 40px;
      min-width: 40px;
      height: 24px;
      border-radius: 12px;
      cursor: pointer;
      position: relative;
      transition: background .2s;
    }
    .dt-toggle-knob {
      position: absolute;
      top: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      transition: left .2s;
      box-shadow: 0 1px 3px rgba(0,0,0,.4);
    }

    /* Buttons */
    .dt-btn {
      border: none;
      border-radius: 3px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: filter .15s;
      font-family: inherit;
      white-space: nowrap;
    }
    .dt-btn:hover { filter: brightness(1.1); }
    .dt-btn-brand   { background: var(--brand-experiment,#5865f2); color: #fff; }
    .dt-btn-danger  { background: var(--status-danger,#ed4245);    color: #fff; }
    .dt-btn-ghost   { background: var(--background-modifier-selected,rgba(255,255,255,.1)); color: var(--text-normal,#dbdee1); }

    /* System page buttons */
    .dt-sys-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: var(--background-secondary,#2b2d31);
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .dt-sys-label { font-size: 14px; color: var(--header-primary,#f2f3f5); font-weight: 500; }
    .dt-sys-desc  { font-size: 12px; color: var(--text-muted,#80848e); margin-top:2px; }

    /* Textarea */
    .dt-textarea {
      width: 100%;
      background: var(--background-secondary,#2b2d31);
      border: 1px solid var(--background-modifier-accent,rgba(255,255,255,.06));
      border-radius: 6px;
      color: var(--text-normal,#dbdee1);
      font-family: "Fira Code", "Consolas", monospace;
      font-size: 12px;
      padding: 10px;
      box-sizing: border-box;
      resize: vertical;
      outline: none;
      line-height: 1.6;
      height: 180px;
    }
    .dt-textarea:focus {
      border-color: var(--brand-experiment,#5865f2);
    }

    /* Search */
    .dt-search {
      width: 100%;
      background: var(--background-tertiary,#1e1f22);
      border: 1px solid transparent;
      border-radius: 4px;
      color: var(--text-normal,#dbdee1);
      font-size: 14px;
      padding: 8px 12px;
      box-sizing: border-box;
      outline: none;
      font-family: inherit;
      margin-bottom: 16px;
    }
    .dt-search:focus { border-color: var(--brand-experiment,#5865f2); }

    /* Notice bar */
    .dt-notice {
      background: rgba(88,101,242,.15);
      border: 1px solid rgba(88,101,242,.3);
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 13px;
      color: var(--text-normal,#dbdee1);
      margin-bottom: 16px;
    }

    /* Empty state */
    .dt-empty {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted,#80848e);
      font-size: 14px;
      line-height: 1.7;
    }
    .dt-empty-icon { font-size: 40px; margin-bottom: 12px; }
    .dt-empty code {
      display: inline-block;
      background: var(--background-secondary,#2b2d31);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
    }
  \`);

  // ── Render helpers ─────────────────────────────────────────────────────

  function toggle(id, on) {
    return '<div class="dt-toggle" data-a="toggle" data-id="' + id + '" data-on="' + on + '" style="background:' + (on ? 'var(--brand-experiment,#5865f2)' : 'var(--background-modifier-accent,#4f545c)') + '">'
      + '<div class="dt-toggle-knob" style="left:' + (on ? '19px' : '3px') + '"></div>'
      + '</div>';
  }

  function renderThemes() {
    var html = '<h2 class="dt-page-title">Themes</h2>'
      + '<p class="dt-page-sub">Apply CSS themes to Discord. Supports BetterDiscord .css files and folder themes with JS animations.</p>'
      + '<input class="dt-search" placeholder="🔍  Search themes..." id="__dt-theme-search">';

    if (_themes.length === 0) {
      html += '<div class="dt-empty"><div class="dt-empty-icon">🎨</div>'
        + 'No themes installed.<br>Drop themes into<br><code>%APPDATA%\\\\DiscordThemer\\\\themes\\\\</code></div>';
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
          + '<div class="dt-card-meta">by ' + t.author + (t.version ? ' · v' + t.version : '') + '</div>'
          + (t.description ? '<div class="dt-card-meta">' + t.description + '</div>' : '')
          + '</div>'
          + '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0">'
          + (on
            ? '<button class="dt-btn dt-btn-danger" data-a="theme-off">Disable</button>'
            : '<button class="dt-btn dt-btn-brand" data-a="theme-on" data-id="' + t.id + '">Apply</button>'
          )
          + '</div></div></div>';
      });
    }

    // Custom CSS
    var customVal = (_custom || "").replace(/&/g,"&amp;").replace(/</g,"&lt;");
    html += '<div class="dt-section-title">Custom CSS</div>'
      + '<textarea class="dt-textarea" id="__dt-css-in" placeholder="/* Your custom CSS here */">' + customVal + '</textarea>'
      + '<div style="display:flex;gap:8px;margin-top:8px">'
      + '<button class="dt-btn dt-btn-brand" data-a="css-apply">Apply CSS</button>'
      + '<button class="dt-btn dt-btn-ghost" data-a="css-clear">Clear</button>'
      + '</div>';

    return html;
  }

  function renderPlugins() {
    var html = '<h2 class="dt-page-title">Plugins</h2>'
      + '<p class="dt-page-sub">Extend Discord with JavaScript plugins. Toggle to enable or disable. Changes apply immediately or on next reload.</p>'
      + '<input class="dt-search" placeholder="🔍  Search plugins..." id="__dt-plugin-search">';

    if (_plugins.length === 0) {
      html += '<div class="dt-empty"><div class="dt-empty-icon">🧩</div>'
        + 'No plugins installed.<br>Drop plugin folders into<br><code>%APPDATA%\\\\DiscordThemer\\\\plugins\\\\</code>'
        + '<br><br><span style="font-size:12px">Each plugin needs a folder with<br><strong>index.js</strong> + <strong>plugin.json</strong></span></div>';
    } else {
      _plugins.forEach(function(p) {
        var tsBadge = p.isTS
          ? '<span style="font-size:10px;font-weight:700;background:#ed4245;color:#fff;padding:1px 6px;border-radius:3px;margin-left:6px;vertical-align:middle">discord-themer only</span>'
          : '';
        var tsNote = p.isTS
          ? '<div class="dt-card-meta" style="color:#faa61a;margin-top:4px">⚠ TypeScript/discord-themer plugin — needs discord-themer to run. Cannot be loaded as plain JS.</div>'
          : '';
        html += '<div class="dt-card dt-plugin-card" data-name="' + p.name.toLowerCase() + '">'
          + '<div class="dt-card-inner">'
          + '<div style="flex:1;min-width:0">'
          + '<div class="dt-card-title">' + p.name + tsBadge + '</div>'
          + '<div class="dt-card-meta">by ' + p.author + (p.version ? ' · v' + p.version : '') + '</div>'
          + (p.description ? '<div class="dt-card-meta">' + p.description + '</div>' : '')
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
    return '<h2 class="dt-page-title">System</h2>'
      + '<p class="dt-page-sub">Manage Discord and DiscordThemer.</p>'

      + '<div class="dt-section-title">Discord</div>'

      + '<div class="dt-sys-row">'
      + '<div><div class="dt-sys-label">Reload Discord</div><div class="dt-sys-desc">Refreshes the Discord window. Re-injects themes and plugins.</div></div>'
      + '<button class="dt-btn dt-btn-brand" data-a="sys-reload">Reload</button>'
      + '</div>'

      + '<div class="dt-sys-row">'
      + '<div><div class="dt-sys-label">Restart Discord</div><div class="dt-sys-desc">Fully restarts the Discord app and re-injects on startup.</div></div>'
      + '<button class="dt-btn dt-btn-ghost" data-a="sys-restart">Restart</button>'
      + '</div>'

      + '<div class="dt-sys-row">'
      + '<div><div class="dt-sys-label">Close Discord</div><div class="dt-sys-desc">Completely closes Discord and all background processes.</div></div>'
      + '<button class="dt-btn dt-btn-danger" data-a="sys-close">Close</button>'
      + '</div>'

      + '<div class="dt-section-title">DiscordThemer</div>'

      + '<div class="dt-sys-row">'
      + '<div><div class="dt-sys-label">Disable All Themes</div><div class="dt-sys-desc">Removes the active theme. Discord will reload.</div></div>'
      + '<button class="dt-btn dt-btn-ghost" data-a="theme-off">Disable Theme</button>'
      + '</div>'

      + '<div class="dt-sys-row">'
      + '<div><div class="dt-sys-label">Open Config Folder</div><div class="dt-sys-desc">Opens %APPDATA%\\DiscordThemer in Explorer.</div></div>'
      + '<button class="dt-btn dt-btn-ghost" data-a="sys-open-folder">Open Folder</button>'
      + '</div>'

      + '<div class="dt-section-title">About</div>'
      + '<div class="dt-card"><div class="dt-card-inner" style="flex-direction:column;gap:4px">'
      + '<div style="font-size:14px;color:var(--header-primary,#f2f3f5);font-weight:600">DiscordThemer v4</div>'
      + '<div style="font-size:12px;color:var(--text-muted,#80848e)">Themes: ' + _themes.length + ' installed · Plugins: ' + _plugins.length + ' installed</div>'
      + '<div style="font-size:12px;color:var(--text-muted,#80848e)">Active theme: ' + (_active || "None") + '</div>'
      + '</div></div>';
  }

  function renderHelp() {
    return '<h2 class="dt-page-title">Help & Support</h2>'
      + '<p class="dt-page-sub">Documentation, resources, and support for DiscordThemer.</p>'

      + '<div class="dt-section-title">Documentation</div>'

      + '<div class="dt-sys-row">'
      + '<div><div class="dt-sys-label">📖 Official Docs</div><div class="dt-sys-desc">Full documentation, guides, and theme/plugin API reference.</div></div>'
      + '<button class="dt-btn dt-btn-brand" data-a="open-url" data-url="https://github.com/zxkuhl/DiscordThemer">Open Docs</button>'
      + '</div>'

      + '<div class="dt-sys-row">'
      + '<div><div class="dt-sys-label">🎨 Theme Format Guide</div><div class="dt-sys-desc">How to create folder themes, BD-compatible CSS files, and JS animations.</div></div>'
      + '<button class="dt-btn dt-btn-ghost" data-a="open-url" data-url="https://github.com/zxkuhl/DiscordThemer#theme-format">View Guide</button>'
      + '</div>'

      + '<div class="dt-sys-row">'
      + '<div><div class="dt-sys-label">🧩 Plugin API</div><div class="dt-sys-desc">Learn how to build plugins with DOM access, CSS injection, and webpack hooks.</div></div>'
      + '<button class="dt-btn dt-btn-ghost" data-a="open-url" data-url="https://github.com/zxkuhl/DiscordThemer#plugin-format">View API</button>'
      + '</div>'

      + '<div class="dt-section-title">Support</div>'

      + '<div class="dt-sys-row">'
      + '<div><div class="dt-sys-label">💬 Discord Server</div><div class="dt-sys-desc">Get help, share themes, and hang out with the community.</div></div>'
      + '<button class="dt-btn dt-btn-brand" data-a="open-url" data-url="https://discord.gg/TdaWNwNAMa">Join Server</button>'
      + '</div>'

      + '<div class="dt-sys-row">'
      + '<div><div class="dt-sys-label">🐛 Report a Bug</div><div class="dt-sys-desc">Found an issue? Open a GitHub issue and we will fix it.</div></div>'
      + '<button class="dt-btn dt-btn-ghost" data-a="open-url" data-url="https://github.com/zxkuhl/DiscordThemer/issues/new">Report Bug</button>'
      + '</div>'

      + '<div class="dt-sys-row">'
      + '<div><div class="dt-sys-label">⭐ Star on GitHub</div><div class="dt-sys-desc">Like the project? Give it a star to show support!</div></div>'
      + '<button class="dt-btn dt-btn-ghost" data-a="open-url" data-url="https://github.com/zxkuhl/DiscordThemer">Star Repo</button>'
      + '</div>'

      + '<div class="dt-section-title">Quick Tips</div>'
      + '<div class="dt-card"><div class="dt-card-inner" style="flex-direction:column;gap:10px;font-size:13px;color:var(--text-normal,#dbdee1);line-height:1.6">'
      + '<div><strong style="color:var(--header-primary,#f2f3f5)">Installing themes</strong><br>Drop a folder with <code style="background:var(--background-tertiary,#1e1f22);padding:1px 5px;border-radius:3px">theme.json</code> + CSS files into <code style="background:var(--background-tertiary,#1e1f22);padding:1px 5px;border-radius:3px">%APPDATA%\DiscordThemer\themes\</code> — or just drop a .css file directly for BetterDiscord-style themes.</div>'
      + '<div><strong style="color:var(--header-primary,#f2f3f5)">Installing plugins</strong><br>Drop a folder with <code style="background:var(--background-tertiary,#1e1f22);padding:1px 5px;border-radius:3px">index.js</code> + <code style="background:var(--background-tertiary,#1e1f22);padding:1px 5px;border-radius:3px">plugin.json</code> into <code style="background:var(--background-tertiary,#1e1f22);padding:1px 5px;border-radius:3px">%APPDATA%\DiscordThemer\plugins\</code> then toggle it on in the Plugins tab.</div>'
      + '<div><strong style="color:var(--header-primary,#f2f3f5)">Themes update live</strong><br>The file watcher checks every second — drop a new theme in and it shows up instantly without reloading Discord.</div>'
      + '</div></div>';
  }

  // ── Build full overlay ─────────────────────────────────────────────────

  var NAV = [
    { id: "themes",  icon: "🎨", label: "Themes"  },
    { id: "plugins", icon: "🧩", label: "Plugins" },
    { id: "system",  icon: "⚙️",  label: "System"  },
    { id: "help",    icon: "❓", label: "Help & Support" },
  ];

  // ── Build full overlay ─────────────────────────────────────────────────
  function buildOverlay() {
    var sidebar = '<div id="__dt-sidebar">'
      + '<div class="dt-sidebar-header">DiscordThemer</div>';
    NAV.forEach(function(n) {
      sidebar += '<div class="dt-nav-item' + (n.id === _tab ? ' active' : '') + '" data-a="nav" data-tab="' + n.id + '">'
        + n.icon + ' ' + n.label + '</div>';
    });
    sidebar += '<div class="dt-nav-sep"></div>'
      + '<div class="dt-nav-item" data-a="sys-reload">🔄 Reload Discord</div>'
      + '</div>';

    var content = '<div id="__dt-content">' + renderTab() + '</div>';
    var close   = '<button id="__dt-close" data-a="close" title="Close (Esc)">✕</button>';

    return sidebar + content + close;
  }

  function renderTab() {
    if (_tab === "themes")  return renderThemes();
    if (_tab === "plugins") return renderPlugins();
    if (_tab === "system")  return renderSystem();
    if (_tab === "help")    return renderHelp();
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
      // Update active state
      document.querySelectorAll(".dt-nav-item").forEach(function(n) {
        n.classList.toggle("active", n.getAttribute("data-tab") === _tab);
      });
      refreshContent();

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
    btn.innerHTML = "🎨 Themer";
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
    hdr.textContent = "DiscordThemer";

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