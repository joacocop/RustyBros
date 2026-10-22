mod editor_events;
mod encoding;
mod export;
mod game;
mod processing;
mod video;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(video::MediaStore::default())
        .manage(export::ExportState::default())
        .manage(game::GameStateStore::default())
        .setup(|app| {
            // Only preview files created in this session are exposed to the WebView.
            let cache = app.path().app_cache_dir()?.join("previews");
            std::fs::create_dir_all(&cache)?;
            // Stale previews belong to previous sessions and are safe to discard.
            for entry in std::fs::read_dir(&cache)?.flatten() {
                if entry.path().is_file() {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            video::import_video,
            video::apply_effects,
            export::export_video,
            game::get_game_state,
            game::update_game_state
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar RustyBros");
}
