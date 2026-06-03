import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import { Trash2, CheckCircle, Upload } from "lucide-react";

interface Theme {
  id: string; name: string; version: string; author: string;
  description: string; tags: string[]; css_file: string; active: boolean;
}

export default function ThemeManager() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try { setThemes(await invoke<Theme[]>("list_themes")); }
    catch (e) { setMsg("Failed to load: " + e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const activate = async (id: string) => {
    try { await invoke("activate_theme", { id }); setMsg("Theme activated! Restart Discord to apply."); load(); }
    catch (e) { setMsg("Error: " + e); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this theme?")) return;
    try { await invoke("delete_theme", { id }); load(); }
    catch (e) { setMsg("Error: " + e); }
  };

  const importTheme = async () => {
    try {
      const folder = await open({ directory: true, title: "Select Theme Folder" });
      if (folder && typeof folder === "string") {
        await invoke("import_theme_from_path", { folderPath: folder });
        load();
      }
    } catch (e) { setMsg("Import error: " + e); }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Loading themes...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">My Themes</h2>
          <p className="text-sm text-gray-400 mt-1">{themes.length} installed</p>
        </div>
        <button onClick={importTheme}
          className="flex items-center gap-2 bg-discord-blurple hover:bg-discord-blurple/80 text-white px-4 py-2 rounded text-sm font-medium">
          <Upload size={16} /> Import Theme
        </button>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-discord-blurple/20 border border-discord-blurple/40 rounded text-sm text-discord-blurple">
          {msg} <button onClick={() => setMsg("")} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {themes.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-4">🎨</p>
          <p>No themes installed yet.</p>
          <p className="text-sm mt-1">Visit the Marketplace to browse themes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {themes.map(t => (
            <div key={t.id} className={`rounded-lg border p-4 ${t.active ? "border-discord-blurple bg-discord-blurple/10" : "border-white/10 bg-discord-sidebar"}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-white">{t.name}</h3>
                  <p className="text-xs text-gray-400">by {t.author} · v{t.version}</p>
                </div>
                {t.active && <CheckCircle size={18} className="text-discord-blurple shrink-0" />}
              </div>
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">{t.description}</p>
              <div className="flex gap-1 flex-wrap mb-3">
                {t.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">{tag}</span>
                ))}
              </div>
              <div className="flex gap-2">
                {!t.active && (
                  <button onClick={() => activate(t.id)}
                    className="flex-1 bg-discord-blurple hover:bg-discord-blurple/80 text-white text-sm py-1.5 rounded font-medium">
                    Apply
                  </button>
                )}
                <button onClick={() => remove(t.id)}
                  className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
