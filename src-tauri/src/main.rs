#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod injector;
mod theme_manager;
mod backup;
mod marketplace;
mod sandbox;
mod plugin_manager;
mod keybind_manager;
mod custom_css;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Injector
            injector::find_discord,
            injector::inject_loader,
            injector::uninject_loader,
            injector::is_injected,
            // Themes
            theme_manager::list_themes,
            theme_manager::activate_theme,
            theme_manager::delete_theme,
            theme_manager::import_theme_from_path,
            // Backups
            backup::create_backup,
            backup::list_backups,
            backup::restore_backup,
            // Marketplace
            marketplace::fetch_registry,
            marketplace::download_theme_from_url,
            // Plugins
            plugin_manager::list_plugins,
            plugin_manager::toggle_plugin,
            plugin_manager::delete_plugin,
            plugin_manager::import_plugin_from_path,
            // Keybinds
            keybind_manager::list_keybinds,
            keybind_manager::set_keybind,
            keybind_manager::reset_keybind,
            // Custom CSS
            custom_css::get_custom_css,
            custom_css::set_custom_css,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
