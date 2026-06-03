use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub tags: Vec<String>,
    pub preview: Option<String>,
    pub css_file: String,
    pub active: bool,
}

fn themes_dir() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    Path::new(&appdata).join("DiscordThemer").join("themes")
}

fn active_config_path() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    Path::new(&appdata).join("DiscordThemer").join("active.json")
}

fn get_active_id() -> Option<String> {
    let content = fs::read_to_string(active_config_path()).ok()?;
    let val: serde_json::Value = serde_json::from_str(&content).ok()?;
    val["id"].as_str().map(|s| s.to_string())
}

#[tauri::command]
pub fn list_themes() -> Vec<Theme> {
    let dir = themes_dir();
    fs::create_dir_all(&dir).ok();
    let active_id = get_active_id();
    fs::read_dir(&dir).map(|rd| {
        rd.filter_map(|e| e.ok()).filter(|e| e.path().is_dir())
            .filter_map(|e| {
                let content = fs::read_to_string(e.path().join("theme.json")).ok()?;
                let mut t: Theme = serde_json::from_str(&content).ok()?;
                t.active = active_id.as_deref() == Some(&t.id);
                Some(t)
            }).collect()
    }).unwrap_or_default()
}

#[tauri::command]
pub fn activate_theme(id: String) -> Result<String, String> {
    let dir = themes_dir().join(&id);
    if !dir.join("theme.json").exists() { return Err(format!("Theme '{}' not found", id)); }
    let css_path = dir.join("theme.css");
    let active = serde_json::json!({ "id": id, "enabled": true, "cssPath": css_path });
    let cfg = active_config_path();
    fs::create_dir_all(cfg.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&cfg, serde_json::to_string_pretty(&active).unwrap()).map_err(|e| e.to_string())?;
    Ok(format!("Theme '{}' activated", id))
}

#[tauri::command]
pub fn delete_theme(id: String) -> Result<String, String> {
    let dir = themes_dir().join(&id);
    if dir.exists() { fs::remove_dir_all(&dir).map_err(|e| e.to_string())?; }
    Ok(format!("Theme '{}' deleted", id))
}

#[tauri::command]
pub fn import_theme_from_path(folder_path: String) -> Result<String, String> {
    let src = Path::new(&folder_path);
    let content = fs::read_to_string(src.join("theme.json"))
        .map_err(|_| "No theme.json found in selected folder")?;
    let theme: Theme = serde_json::from_str(&content)
        .map_err(|_| "Invalid theme.json format")?;
    let dest = themes_dir().join(&theme.id);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        fs::copy(entry.path(), dest.join(entry.file_name())).map_err(|e| e.to_string())?;
    }
    Ok(format!("Theme '{}' imported", theme.name))
}
