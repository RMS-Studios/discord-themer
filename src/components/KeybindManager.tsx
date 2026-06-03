import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { Keyboard, RotateCcw, RefreshCw } from "lucide-react";

interface Keybind {
  id: string;
  label: string;
  description: string;
  combo: string;
  default_combo: string;
  plugin: string;
}

export default function KeybindManager() {
  const [binds, setBinds] = useState<Keybind[]>([]);
  const [recording, setRecording] = useState<string | null>(null);
  const [recordedCombo, setRecordedCombo] = useState("");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const list = await invoke<Keybind[]>("list_keybinds");
      setBinds(list);
    } catch {
      // Show placeholder keybinds until backend is wired
      setBinds([
        { id: "discord_themer.toggle_theme", label: "Toggle Active Theme", description: "Enable or disable the currently active theme", combo: "Ctrl+Shift+T", default_combo: "Ctrl+Shift+T", plugin: "Discord Themer" },
        { id: "discord_themer.open_settings", label: "Open Discord Themer", description: "Open the Discord Themer settings panel", combo: "Ctrl+Shift+D", default_combo: "Ctrl+Shift+D", plugin: "Discord Themer" },
        { id: "discord_themer.reload_css", label: "Reload CSS", description: "Reload the active theme CSS without restarting", combo: "Ctrl+Shift+R", default_combo: "Ctrl+Shift+R", plugin: "Discord Themer" },
      ]);
    }
  };

  useEffect(() => { load(); }, []);

  const startRecording = (id: string) => {
    setRecording(id);
    setRecordedCombo("Press keys...");
  };

  useEffect(() => {
    if (!recording) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(null);
        setRecordedCombo("");
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (!["Control", "Shift", "Alt", "Meta"].includes(key)) parts.push(key);

      if (parts.length > 0 && !["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        const combo = parts.join("+");
        setRecordedCombo(combo);
        setBinds(bs => bs.map(b => b.id === recording ? { ...b, combo } : b));
        try { invoke("set_keybind", { id: recording, combo }); } catch {}
        setMsg(`Keybind updated. Restart Discord to apply.`);
        setRecording(null);
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recording]);

  const reset = (id: string, defaultCombo: string) => {
    setBinds(bs => bs.map(b => b.id === id ? { ...b, combo: defaultCombo } : b));
    try { invoke("set_keybind", { id, combo: defaultCombo }); } catch {}
    setMsg("Keybind reset to default.");
  };

  // Group by plugin
  const grouped = binds
    .filter(b => b.label.toLowerCase().includes(search.toLowerCase()) || b.plugin.toLowerCase().includes(search.toLowerCase()))
    .reduce((acc, b) => {
      if (!acc[b.plugin]) acc[b.plugin] = [];
      acc[b.plugin].push(b);
      return acc;
    }, {} as Record<string, Keybind[]>);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Keybinds</h2>
          <p className="text-sm text-gray-400 mt-1">{binds.length} registered</p>
        </div>
        <button onClick={load} className="p-2 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-discord-blurple/20 border border-discord-blurple/40 rounded text-sm text-discord-blurple flex justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg("")} className="underline ml-2">Dismiss</button>
        </div>
      )}

      {recording && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-yellow-300 text-center animate-pulse">
          Press your key combination... (Esc to cancel)
        </div>
      )}

      {binds.length > 3 && (
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search keybinds..."
          className="w-full mb-4 bg-discord-dark border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-discord-blurple/50" />
      )}

      {binds.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Keyboard size={40} className="mx-auto mb-3 opacity-30" />
          <p>No keybinds registered.</p>
          <p className="text-sm mt-1">Keybinds registered by plugins will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([plugin, pluginBinds]) => (
            <div key={plugin}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{plugin}</h3>
              <div className="flex flex-col gap-2">
                {pluginBinds.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-4 bg-discord-sidebar border border-white/10 rounded-lg">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm font-medium text-white">{b.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{b.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startRecording(b.id)}
                        className={`px-3 py-1.5 rounded text-sm font-mono font-medium border transition-colors min-w-[120px] text-center ${
                          recording === b.id
                            ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-300 animate-pulse"
                            : "border-white/20 bg-discord-dark text-white hover:border-discord-blurple/50 hover:bg-discord-blurple/10"
                        }`}
                      >
                        {recording === b.id ? recordedCombo || "Press keys..." : b.combo}
                      </button>
                      {b.combo !== b.default_combo && (
                        <button
                          onClick={() => reset(b.id, b.default_combo)}
                          title="Reset to default"
                          className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/5"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
