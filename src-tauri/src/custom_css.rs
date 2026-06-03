use std::fs;
use std::path::PathBuf;

fn css_path() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    std::path::Path::new(&appdata)
        .join("DiscordThemer")
        .join("custom.css")
}

#[tauri::command]
pub fn get_custom_css() -> Result<String, String> {
    fs::read_to_string(css_path()).unwrap_or_default().pipe(Ok)
}

#[tauri::command]
pub fn set_custom_css(css: String) -> Result<(), String> {
    let path = css_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, &css).map_err(|e| e.to_string())?;

    // Also write it to the injected loader location so Discord picks it up
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    let loader_css = std::path::Path::new(&appdata)
        .join("DiscordThemer")
        .join("injector")
        .join("custom.css");
    if let Some(parent) = loader_css.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&loader_css, &css);

    Ok(())
}

trait Pipe: Sized {
    fn pipe<F: FnOnce(Self) -> R, R>(self, f: F) -> R { f(self) }
}
impl<T> Pipe for T {}
