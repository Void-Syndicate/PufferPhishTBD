mod matrix;
mod commands;
mod store;
mod error;

use std::sync::Arc;
use tokio::sync::Mutex;

/// Application state shared across Tauri commands
pub struct AppState {
    pub matrix_client: Arc<Mutex<Option<matrix::client::MatrixClient>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            matrix_client: Arc::new(Mutex::new(None)),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::matrix_login,
            commands::matrix_logout,
            commands::get_rooms,
            commands::start_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PufferChat");
}
