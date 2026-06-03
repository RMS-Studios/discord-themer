import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { CheckCircle, XCircle, Loader } from "lucide-react";

export default function InjectorStatus() {
  const [injected, setInjected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { checkStatus(); }, []);

  const checkStatus = async () => {
    try { setInjected(await invoke<boolean>("is_injected")); }
    catch { setInjected(false); }
  };

  const toggle = async () => {
    setLoading(true);
    try {
      if (injected) {
        await invoke("uninject_loader");
      } else {
        await invoke("inject_loader", { loaderPath: "%APPDATA%\\DiscordThemer\\injector\\loader.js" });
      }
      await checkStatus();
    } catch (e) { alert("Error: " + e); }
    finally { setLoading(false); }
  };

  return (
    <div className="px-3 py-3 border-t border-black/20">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">Injector</span>
        {injected === null ? <Loader size={14} className="text-gray-400 animate-spin" />
          : injected ? <CheckCircle size={14} className="text-green-400" />
          : <XCircle size={14} className="text-red-400" />}
      </div>
      <button onClick={toggle} disabled={loading}
        className={`w-full text-xs py-1.5 rounded font-medium transition-colors ${
          injected ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                   : "bg-discord-blurple/20 text-discord-blurple hover:bg-discord-blurple/30"
        }`}>
        {loading ? "Working..." : injected ? "Disable Themes" : "Enable Themes"}
      </button>
    </div>
  );
}
