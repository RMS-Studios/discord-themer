use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
pub struct Keybind {
    pub id: String,
    pub label: String,
    pub description: String,
    pub combo: String,
    pub default_combo: String,
    pub plugin: String,
}

fn keybinds_path() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    std::path::Path::new(&appdata)
        .join("DiscordThemer")
        .join("keybinds.json")
}

fn load_combos() -> std::collections::HashMap<String, String> {
    fs::read_to_string(keybinds_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_combos(combos: &std::collections::HashMap<String, String>) {
    if let Ok(json) = serde_json::to_string_pretty(combos) {
        let _ = fs::write(keybinds_path(), json);
    }
}

// Built-in Discord Themer keybinds
fn builtin_keybinds() -> Vec<Keybind> {
    vec![
        Keybind {
            id: "discord_themer.toggle_theme".to_string(),
            label: "Toggle Active Theme".to_string(),
            description: "Enable or disable the currently active theme".to_string(),
            combo: "Ctrl+Shift+T".to_string(),
            default_combo: "Ctrl+Shift+T".to_string(),
            plugin: "Discord Themer".to_string(),
        },
        Keybind {
            id: "discord_themer.reload_css".to_string(),
            label: "Reload CSS".to_string(),
            description: "Reload the active theme and custom CSS without restarting Discord".to_string(),
            combo: "Ctrl+Shift+R".to_string(),
            default_combo: "Ctrl+Shift+R".to_string(),
            plugin: "Discord Themer".to_string(),
        },
        Keybind {
            id: "discord_themer.open_settings".to_string(),
            label: "Open Discord Themer".to_string(),
            description: "Open the Discord Themer app window".to_string(),
            combo: "Ctrl+Shift+D".to_string(),
            default_combo: "Ctrl+Shift+D".to_string(),
            plugin: "Discord Themer".to_string(),
        },
    ]
}

#[tauri::command]
pub fn list_keybinds() -> Result<Vec<Keybind>, String> {
    let combos = load_combos();
    let mut binds = builtin_keybinds();

    // Apply any saved custom combos
    for bind in &mut binds {
        if let Some(combo) = combos.get(&bind.id) {
            bind.combo = combo.clone();
        }
    }

    Ok(binds)
}

#[tauri::command]
pub fn set_keybind(id: String, combo: String) -> Result<(), String> {
    let mut combos = load_combos();
    combos.insert(id, combo);
    save_combos(&combos);
    Ok(())
}

#[tauri::command]
pub fn reset_keybind(id: String) -> Result<(), String> {
    let mut combos = load_combos();
    combos.remove(&id);
    save_combos(&combos);
    Ok(())
}
