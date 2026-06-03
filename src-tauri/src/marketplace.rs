use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

const REGISTRY_URL: &str =
    "https://raw.githubusercontent.com/your-org/discord-themer-registry/main/index.json";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RegistryEntry {
    pub id: String,
    pub name: String,
    pub author: String,
    pub description: String,
    pub tags: Vec<String>,
    pub rating: f32,
    pub downloads: u64,
    pub manifest_url: String,
    pub preview_url: Option<String>,
    pub verified: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Registry {
    pub version: String,
    pub updated: String,
    pub themes: Vec<RegistryEntry>,
}

fn themes_dir() -> std::path::PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    Path::new(&appdata).join("DiscordThemer").join("themes")
}

fn validate_url(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url).map_err(|_| "Invalid URL format")?;
    if parsed.scheme() != "https" { return Err("Only HTTPS URLs are allowed".into()); }
    let allowed = ["raw.githubusercontent.com", "cdn.discordthemer.app", "github.com"];
    let host = parsed.host_str().unwrap_or("");
    if !allowed.iter().any(|&h| host.ends_with(h)) {
        return Err(format!("Host '{}' not in allowlist", host));
    }
    Ok(())
}

#[tauri::command]
pub async fn fetch_registry() -> Result<Vec<RegistryEntry>, String> {
    let resp = reqwest::get(REGISTRY_URL).await.map_err(|e| e.to_string())?;
    let registry: Registry = resp.json().await.map_err(|e| e.to_string())?;
    Ok(registry.themes)
}

#[tauri::command]
pub async fn download_theme_from_url(manifest_url: String) -> Result<String, String> {
    validate_url(&manifest_url)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("DiscordThemer/1.0")
        .build().map_err(|e| e.to_string())?;

    let manifest_text = client.get(&manifest_url).send().await.map_err(|e| e.to_string())?
        .text().await.map_err(|e| e.to_string())?;
    let manifest: serde_json::Value = serde_json::from_str(&manifest_text)
        .map_err(|_| "Invalid theme manifest JSON")?;

    let id = manifest["id"].as_str().ok_or("Missing 'id' in manifest")?;
    let css_url = manifest["files"]["css"].as_str().ok_or("Missing CSS URL")?;
    validate_url(css_url)?;

    let css_content = client.get(css_url).send().await.map_err(|e| e.to_string())?
        .text().await.map_err(|e| e.to_string())?;

    match crate::sandbox::validate_css(&css_content) {
        crate::sandbox::ValidationResult::Blocked(r) =>
            return Err(format!("Blocked by safety scanner: {}", r)),
        _ => {}
    }

    if let Some(expected) = manifest["checksum"].as_str() {
        let actual = format!("{:x}", Sha256::digest(css_content.as_bytes()));
        if actual != expected { return Err("Checksum mismatch — possible tampering".into()); }
    }

    let dest = themes_dir().join(id);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    fs::write(dest.join("theme.json"), &manifest_text).map_err(|e| e.to_string())?;
    fs::write(dest.join("theme.css"), &css_content).map_err(|e| e.to_string())?;
    Ok(format!("Theme '{}' installed successfully", id))
}
