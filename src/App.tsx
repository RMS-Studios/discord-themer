import { useState } from "react";
import { Layout, Palette, ShoppingBag, Archive, Settings, Plug, Keyboard, Code } from "lucide-react";
import ThemeManager from "./components/ThemeManager";
import Marketplace from "./components/Marketplace";
import BackupManager from "./components/BackupManager";
import PluginManager from "./components/PluginManager";
import KeybindManager from "./components/KeybindManager";
import CustomCSS from "./components/CustomCSS";
import SettingsPage from "./components/SettingsPage";
import InjectorStatus from "./components/InjectorStatus";

type Tab = "themes" | "marketplace" | "plugins" | "keybinds" | "css" | "backups" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("themes");

  const navItems = [
    { id: "themes",      label: "My Themes",    icon: Palette },
    { id: "marketplace", label: "Marketplace",   icon: ShoppingBag },
    { id: "plugins",     label: "Plugins",       icon: Plug },
    { id: "keybinds",   label: "Keybinds",      icon: Keyboard },
    { id: "css",         label: "Custom CSS",    icon: Code },
    { id: "backups",     label: "Backups",       icon: Archive },
    { id: "settings",   label: "Settings",      icon: Settings },
  ] as const;

  return (
    <div className="flex h-screen bg-discord-dark">
      {/* Sidebar */}
      <div className="w-56 bg-discord-sidebar flex flex-col py-4 px-2 gap-1 border-r border-black/20">
        <div className="px-3 pb-4 mb-2 border-b border-black/20">
          <h1 className="text-white font-bold text-lg flex items-center gap-2">
            <Layout size={20} className="text-discord-blurple" />
            Discord Themer
          </h1>
          <p className="text-xs text-gray-400 mt-1">v0.1.0</p>
        </div>

        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors w-full text-left ${
              tab === id
                ? "bg-discord-blurple text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}

        <div className="mt-auto">
          <InjectorStatus />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto bg-discord-bg">
        {tab === "themes"      && <ThemeManager />}
        {tab === "marketplace" && <Marketplace />}
        {tab === "plugins"     && <PluginManager />}
        {tab === "keybinds"    && <KeybindManager />}
        {tab === "css"         && <CustomCSS />}
        {tab === "backups"     && <BackupManager />}
        {tab === "settings"    && <SettingsPage />}
      </div>
    </div>
  );
}
