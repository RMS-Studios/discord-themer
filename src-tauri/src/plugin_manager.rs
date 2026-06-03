use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone)]
pub struct Plugin {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub version: String,
    pub enabled: bool,
    pub path: String,
    pub has_settings: bool,
}

#[derive(Deserialize)]
struct PluginMeta {
    name: Option<String>,
    description: Option<String>,
    author: Option<String>,
    version: Option<String>,
}

fn plugins_dir() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    Path::new(&appdata).join("DiscordThemer").join("plugins")
}

fn state_path() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    Path::new(&appdata).join("DiscordThemer").join("plugin_state.json")
}

fn load_state() -> std::collections::HashMap<String, bool> {
    fs::read_to_string(state_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_state(state: &std::collections::HashMap<String, bool>) {
    if let Ok(json) = serde_json::to_string_pretty(state) {
        let _ = fs::write(state_path(), json);
    }
}

#[tauri::command]
pub fn list_plugins() -> Result<Vec<Plugin>, String> {
    let dir = plugins_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let state = load_state();
    let mut plugins = Vec::new();

    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() { continue; }

        let index = path.join("index.js");
        if !index.exists() { continue; }

        let id = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        // Try to read plugin.json for metadata
        let meta: PluginMeta = path.join("plugin.json")
            .pipe(|p| fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(PluginMeta { name: None, description: None, author: None, version: None });

        let enabled = *state.get(&id).unwrap_or(&false);

        plugins.push(Plugin {
            id: id.clone(),
            name: meta.name.unwrap_or_else(|| id.clone()),
            description: meta.description.unwrap_or_else(|| "No description".to_string()),
            author: meta.author.unwrap_or_else(|| "Unknown".to_string()),
            version: meta.version.unwrap_or_else(|| "1.0.0".to_string()),
            enabled,
            path: path.to_string_lossy().to_string(),
            has_settings: path.join("settings.js").exists(),
        });
    }

    plugins.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(plugins)
}

#[tauri::command]
pub fn toggle_plugin(id: String, enabled: bool) -> Result<(), String> {
    let mut state = load_state();
    state.insert(id, enabled);
    save_state(&state);
    Ok(())
}

#[tauri::command]
pub fn delete_plugin(id: String) -> Result<(), String> {
    let dir = plugins_dir().join(&id);
    fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut state = load_state();
    state.remove(&id);
    save_state(&state);
    Ok(())
}

#[tauri::command]
pub fn import_plugin_from_path(folder_path: String) -> Result<String, String> {
    let src = Path::new(&folder_path);
    if !src.join("index.js").exists() {
        return Err("No index.js found in plugin folder".to_string());
    }
    let name = src.file_name().unwrap_or_default().to_string_lossy().to_string();
    let dest = plugins_dir().join(&name);
    copy_dir_all(src, &dest).map_err(|e| e.to_string())?;
    Ok(format!("Imported plugin: {}", name))
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)?.flatten() {
        let ty = entry.file_type()?;
        let dest = dst.join(entry.file_name());
        if ty.is_dir() { copy_dir_all(&entry.path(), &dest)?; }
        else { fs::copy(entry.path(), dest)?; }
    }
    Ok(())
}

// Trait to make path.pipe() work
trait Pipe: Sized {
    fn pipe<F: FnOnce(Self) -> R, R>(self, f: F) -> R { f(self) }
}
impl<T> Pipe for T {}
