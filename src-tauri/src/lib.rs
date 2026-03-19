mod commands;
mod error;
mod link_preview;
mod matrix;
mod store;

use std::sync::Arc;
use tokio::sync::Mutex;

/// Application state shared across Tauri commands
pub struct AppState {
    pub matrix_client: Arc<Mutex<Option<matrix::client::MatrixClient>>>,
    pub is_locked: Arc<Mutex<bool>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            matrix_client: Arc::new(Mutex::new(None)),
            is_locked: Arc::new(Mutex::new(false)),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::restore_session,
            commands::matrix_login,
            commands::matrix_logout,
            // Rooms
            commands::get_rooms,
            commands::start_sync,
            commands::get_room_messages,
            commands::send_message,
            commands::send_reply,
            commands::edit_message,
            commands::delete_message,
            commands::send_reaction,
            commands::remove_reaction,
            commands::send_typing,
            commands::mark_read,
            commands::get_room_members,
            commands::search_messages,
            commands::resolve_mxc_url,
            commands::get_user_avatar,
            commands::create_room,
            commands::join_room,
            commands::leave_room,
            commands::invite_to_room,
            commands::search_public_rooms,
            commands::get_room_info,
            commands::get_invited_rooms,
            commands::accept_invite,
            commands::reject_invite,
            // Encryption & Security (Phase 3)
            commands::enable_room_encryption,
            commands::get_room_encryption_status,
            commands::request_verification,
            commands::request_device_verification,
            commands::accept_verification,
            commands::start_sas_verification,
            commands::get_sas_emojis,
            commands::confirm_sas_verification,
            commands::cancel_verification,
            commands::get_verification_state,
            commands::bootstrap_cross_signing,
            commands::get_cross_signing_status,
            commands::get_user_verification_status,
            commands::enable_key_backup,
            commands::disable_key_backup,
            commands::get_key_backup_status,
            commands::setup_secret_storage,
            commands::is_recovery_enabled,
            commands::recover_with_key,
            commands::reset_recovery_key,
            commands::get_own_devices,
            commands::delete_device,
            commands::rename_device,
            commands::export_room_keys,
            commands::import_room_keys,
            commands::setup_auto_lock,
            commands::verify_unlock_passphrase,
            commands::lock_app,
            commands::is_app_locked,
            commands::is_auto_lock_enabled,
            commands::get_lock_timeout,
            commands::disable_auto_lock,
            // Media & Files (Phase 4)
            commands::send_image,
            commands::send_video,
            commands::send_audio,
            commands::send_file,
            commands::download_media,
            commands::get_cache_size,
            commands::clear_media_cache,
            commands::set_cache_limit,
            // Link Preview
            link_preview::fetch_link_preview,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PufferChat");
}
