use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BackupEntry {
    pub filename: String,
    pub path: String,
    pub timestamp: String,
    pub original_file: String,
}

fn backup_dir() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    Path::new(&appdata).join("DiscordThemer").join("backups")
}

pub fn backup_file_raw(file_path: &Path) -> Result<PathBuf, String> {
    let dir = backup_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let ts = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let name = file_path.file_name().unwrap_or_default().to_str().unwrap_or("file");
    let backup_path = dir.join(format!("{}_{}.bak", name, ts));
    fs::copy(file_path, &backup_path).map_err(|e| e.to_string())?;

    let mut backups: Vec<PathBuf> = fs::read_dir(&dir)
        .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path())
            .filter(|p| p.extension().map(|x| x == "bak").unwrap_or(false)).collect())
        .unwrap_or_default();
    backups.sort();
    while backups.len() > 10 { let _ = fs::remove_file(backups.remove(0)); }
    Ok(backup_path)
}

#[tauri::command]
pub fn create_backup() -> Result<String, String> {
    if let Some(target) = crate::injector::find_discord_index_js() {
        let p = backup_file_raw(&target)?;
        Ok(format!("Backup created: {}", p.display()))
    } else { Err("Discord not found".into()) }
}

#[tauri::command]
pub fn list_backups() -> Vec<BackupEntry> {
    let dir = backup_dir();
    fs::read_dir(&dir).map(|rd| {
        let mut v: Vec<BackupEntry> = rd.filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map(|x| x == "bak").unwrap_or(false))
            .map(|e| {
                let path = e.path();
                let filename = path.file_name().unwrap_or_default().to_str().unwrap_or("").to_string();
                BackupEntry {
                    filename: filename.clone(), path: path.to_string_lossy().to_string(),
                    timestamp: filename.clone(), original_file: "discord_desktop_core/index.js".into(),
                }
            }).collect();
        v.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        v
    }).unwrap_or_default()
}

#[tauri::command]
pub fn restore_backup(backup_path: String) -> Result<String, String> {
    let target = crate::injector::find_discord_index_js().ok_or("Discord not found")?;
    fs::copy(Path::new(&backup_path), &target).map_err(|e| e.to_string())?;
    Ok("Backup restored successfully".into())
}
