import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

export default function SettingsPage() {
  const [discordPath, setDiscordPath] = useState("");
  const [detecting, setDetecting] = useState(false);

  const detect = async () => {
    setDetecting(true);
    try {
      const path = await invoke<string>("find_discord");
      setDiscordPath(path);
    } catch (e) { setDiscordPath("Not found: " + e); }
    finally { setDetecting(false); }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-6">Settings</h2>

      <section className="mb-8">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Discord Detection</h3>
        <div className="bg-discord-sidebar border border-white/10 rounded-lg p-4">
          <div className="flex gap-2 mb-2">
            <input readOnly value={discordPath} placeholder="Click Detect to find Discord..."
              className="flex-1 bg-discord-dark border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none" />
            <button onClick={detect} disabled={detecting}
              className="bg-discord-blurple hover:bg-discord-blurple/80 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium">
              {detecting ? "Detecting..." : "Detect"}
            </button>
          </div>
          <p className="text-xs text-gray-500">Searches %LOCALAPPDATA%\Discord for the latest version.</p>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">About</h3>
        <div className="bg-discord-sidebar border border-white/10 rounded-lg p-4 text-sm text-gray-400 space-y-1">
          <p>Discord Themer v0.1.0</p>
          <p>Built with Tauri + React + Rust</p>
          <p className="text-yellow-400/80 mt-2">⚠️ Use responsibly. Modifying Discord's client may violate its ToS.</p>
        </div>
      </section>
    </div>
  );
}
