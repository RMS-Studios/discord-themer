import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { Download, Star, ShieldCheck, Search, Link } from "lucide-react";

interface RegistryEntry {
  id: string; name: string; author: string; description: string;
  tags: string[]; rating: number; downloads: number;
  manifest_url: string; preview_url?: string; verified: boolean;
}

export default function Marketplace() {
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  const fetchRegistry = async () => {
    setLoading(true);
    try { setEntries(await invoke<RegistryEntry[]>("fetch_registry")); }
    catch (e) { setMsg("Failed to load registry: " + e); }
    finally { setLoading(false); }
  };

  const install = async (url: string, id: string) => {
    setInstalling(id);
    try {
      const result = await invoke<string>("download_theme_from_url", { manifestUrl: url });
      setMsg(result);
    } catch (e) { setMsg("Install failed: " + e); }
    finally { setInstalling(null); }
  };

  const filtered = entries.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Marketplace</h2>
        <p className="text-sm text-gray-400">Browse and install community themes</p>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-discord-blurple/20 border border-discord-blurple/40 rounded text-sm text-discord-blurple">
          {msg} <button onClick={() => setMsg("")} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Install from URL */}
      <div className="mb-6 p-4 bg-discord-sidebar rounded-lg border border-white/10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Link size={14} /> Install from URL
        </h3>
        <div className="flex gap-2">
          <input
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            placeholder="https://raw.githubusercontent.com/.../theme.json"
            className="flex-1 bg-discord-dark border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-discord-blurple"
          />
          <button
            onClick={() => install(customUrl, "custom")}
            disabled={!customUrl || installing === "custom"}
            className="bg-discord-blurple hover:bg-discord-blurple/80 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
          >
            {installing === "custom" ? "Installing..." : "Install"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Only HTTPS URLs from GitHub are accepted. All CSS is scanned before install.</p>
      </div>

      {/* Registry browser */}
      {entries.length === 0 ? (
        <div className="text-center py-12">
          <button onClick={fetchRegistry} disabled={loading}
            className="bg-discord-blurple hover:bg-discord-blurple/80 text-white px-6 py-3 rounded font-medium">
            {loading ? "Loading..." : "Browse Community Themes"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search themes..." 
                className="w-full bg-discord-dark border border-white/10 rounded pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-discord-blurple" />
            </div>
            <span className="text-sm text-gray-400">{filtered.length} themes</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(e => (
              <div key={e.id} className="rounded-lg border border-white/10 bg-discord-sidebar p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-white">{e.name}</h3>
                      {e.verified && <ShieldCheck size={13} className="text-discord-blurple" />}
                    </div>
                    <p className="text-xs text-gray-400">by {e.author}</p>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-400 text-xs">
                    <Star size={12} fill="currentColor" /> {e.rating.toFixed(1)}
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{e.description}</p>
                <div className="flex gap-1 flex-wrap mb-3">
                  {e.tags.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">{tag}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{e.downloads.toLocaleString()} installs</span>
                  <button
                    onClick={() => install(e.manifest_url, e.id)}
                    disabled={installing === e.id}
                    className="flex items-center gap-1.5 bg-discord-blurple hover:bg-discord-blurple/80 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded font-medium">
                    <Download size={12} />
                    {installing === e.id ? "Installing..." : "Install"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
