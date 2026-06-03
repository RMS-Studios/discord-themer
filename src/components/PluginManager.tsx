import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import { Plug, AlertTriangle, FolderOpen, ChevronDown, ChevronUp, Trash2, RefreshCw } from "lucide-react";

interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  enabled: boolean;
  path: string;
  has_settings: boolean;
}

export default function PluginManager() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const list = await invoke<Plugin[]>("list_plugins");
      setPlugins(list);
    } catch {
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id: string, enabled: boolean) => {
    try { await invoke("toggle_plugin", { id, enabled: !enabled }); } catch {}
    setPlugins(ps => ps.map(p => p.id === id ? { ...p, enabled: !enabled } : p));
    setMsg(`Plugin ${!enabled ? "enabled" : "disabled"}. Restart Discord to apply.`);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this plugin?")) return;
    try { await invoke("delete_plugin", { id }); } catch {}
    setPlugins(ps => ps.filter(p => p.id !== id));
  };

  const importPlugin = async () => {
    try {
      const folder = await open({ directory: true, title: "Select Plugin Folder" });
      if (folder && typeof folder === "string") {
        await invoke("import_plugin_from_path", { folderPath: folder });
        load();
        setMsg("Plugin imported! Restart Discord to load it.");
      }
    } catch (e) { setMsg("Import error: " + e); }
  };

  const filtered = plugins.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase()) ||
    p.author.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Plugins</h2>
          <p className="text-sm text-gray-400 mt-1">{plugins.length} installed</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white" title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button onClick={importPlugin} className="flex items-center gap-2 bg-discord-blurple hover:bg-discord-blurple/80 text-white px-4 py-2 rounded text-sm font-medium">
            <FolderOpen size={16} /> Import Plugin
          </button>
        </div>
      </div>

      <div className="mb-5 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-yellow-300 flex gap-3">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div><strong>Security Warning:</strong> Only install plugins from sources you trust. Plugins run JavaScript inside Discord and have access to your account.</div>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-discord-blurple/20 border border-discord-blurple/40 rounded text-sm text-discord-blurple flex justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg("")} className="underline ml-2 shrink-0">Dismiss</button>
        </div>
      )}

      {plugins.length > 0 && (
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search plugins..."
          className="w-full mb-4 bg-discord-dark border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-discord-blurple/50" />
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Plug size={40} className="mx-auto mb-3 opacity-30" />
          <p>{plugins.length === 0 ? "No plugins installed." : "No plugins match your search."}</p>
          <p className="text-sm mt-1">Click Import Plugin to add one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(p => (
            <div key={p.id} className={`rounded-lg border transition-colors ${p.enabled ? "border-discord-blurple/40 bg-discord-blurple/5" : "border-white/10 bg-discord-sidebar"}`}>
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-white text-sm">{p.name}</span>
                    <span className="text-xs text-gray-500">v{p.version}</span>
                    <span className="text-xs text-gray-500">by {p.author}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{p.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle */}
                  <button onClick={() => toggle(p.id, p.enabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${p.enabled ? "bg-discord-blurple" : "bg-white/20"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${p.enabled ? "left-5" : "left-0.5"}`} />
                  </button>
                  <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="p-1 rounded text-gray-500 hover:text-white">
                    {expanded === p.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button onClick={() => remove(p.id)} className="p-1 rounded text-gray-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {expanded === p.id && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3 text-sm text-gray-400">
                  <p className="mb-2">{p.description}</p>
                  <p className="text-xs font-mono text-gray-600 truncate">{p.path}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
