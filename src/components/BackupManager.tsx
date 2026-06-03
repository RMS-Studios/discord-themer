import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { Archive, RotateCcw, Plus } from "lucide-react";

interface BackupEntry {
  filename: string; path: string; timestamp: string; original_file: string;
}

export default function BackupManager() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try { setBackups(await invoke<BackupEntry[]>("list_backups")); }
    catch (e) { setMsg("Error: " + e); }
  };

  useEffect(() => { load(); }, []);

  const createBackup = async () => {
    try { const r = await invoke<string>("create_backup"); setMsg(r); load(); }
    catch (e) { setMsg("Error: " + e); }
  };

  const restore = async (path: string) => {
    if (!confirm("Restore this backup? Discord will need to be restarted.")) return;
    try { const r = await invoke<string>("restore_backup", { backupPath: path }); setMsg(r); }
    catch (e) { setMsg("Error: " + e); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Backups</h2>
          <p className="text-sm text-gray-400 mt-1">Restore Discord to a previous state</p>
        </div>
        <button onClick={createBackup}
          className="flex items-center gap-2 bg-discord-blurple hover:bg-discord-blurple/80 text-white px-4 py-2 rounded text-sm font-medium">
          <Plus size={16} /> Create Backup
        </button>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-discord-blurple/20 border border-discord-blurple/40 rounded text-sm text-discord-blurple">
          {msg} <button onClick={() => setMsg("")} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-yellow-300">
        <strong>Note:</strong> Backups are auto-created before every injection. Up to 10 backups are kept. After restoring, restart Discord.
      </div>

      {backups.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Archive size={40} className="mx-auto mb-3 opacity-30" />
          <p>No backups yet. Create one before making changes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map(b => (
            <div key={b.path} className="flex items-center justify-between p-4 bg-discord-sidebar border border-white/10 rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">{b.filename}</p>
                <p className="text-xs text-gray-400 mt-0.5">{b.original_file}</p>
              </div>
              <button onClick={() => restore(b.path)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-gray-300 text-xs px-3 py-1.5 rounded">
                <RotateCcw size={12} /> Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
