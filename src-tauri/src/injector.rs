use std::fs;
use std::path::{Path, PathBuf};

#[tauri::command]
pub fn find_discord() -> Result<String, String> {
    find_discord_index_js()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Discord installation not found".to_string())
}

pub fn find_discord_index_js() -> Option<PathBuf> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    let discord_dir = Path::new(&local).join("Discord");

    let mut versions: Vec<PathBuf> = fs::read_dir(&discord_dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("app-"))
                .unwrap_or(false)
        })
        .collect();

    versions.sort();
    versions.last().map(|v| {
        v.join("modules")
            .join("discord_desktop_core")
            .join("index.js")
    })
}

#[tauri::command]
pub fn is_injected() -> bool {
    if let Some(target) = find_discord_index_js() {
        if let Ok(content) = fs::read_to_string(&target) {
            return content.contains("DiscordThemer");
        }
    }
    false
}

#[tauri::command]
pub fn inject_loader(loader_path: String) -> Result<String, String> {
    let target = find_discord_index_js().ok_or("Discord not found")?;
    crate::backup::backup_file_raw(&target)?;

    let original = fs::read_to_string(&target).map_err(|e| e.to_string())?;
    if original.contains("DiscordThemer") {
        return Ok("Already injected".to_string());
    }

    let inject_line = format!(
        "// DiscordThemer Injector\nrequire({:?});\n\n",
        loader_path
    );
    let patched = format!("{}{}", inject_line, original);
    fs::write(&target, patched).map_err(|e| e.to_string())?;
    Ok("Injection successful".to_string())
}

#[tauri::command]
pub fn uninject_loader() -> Result<String, String> {
    let target = find_discord_index_js().ok_or("Discord not found")?;
    let content = fs::read_to_string(&target).map_err(|e| e.to_string())?;

    let lines: Vec<&str> = content.lines().collect();
    let cleaned = lines
        .into_iter()
        .skip_while(|l| l.contains("DiscordThemer") || (l.contains("require(") && l.contains("loader")))
        .collect::<Vec<_>>()
        .join("\n");

    fs::write(&target, cleaned).map_err(|e| e.to_string())?;
    Ok("Uninjected successfully".to_string())
}
