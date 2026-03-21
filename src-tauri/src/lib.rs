mod commands;
mod error;
mod link_preview;
mod matrix;
mod store;
mod phase8;

use std::sync::Arc;
use tokio::sync::Mutex;

/// Application state shared across Tauri commands
pub struct AppState {
    pub matrix_client: Arc<Mutex<Option<matrix::client::MatrixClient>>>,
    pub is_locked: Arc<Mutex<bool>>,
    pub voip_state: Arc<Mutex<matrix::voip::VoipState>>,
}

impl AppState {
    pub fn new() -> Self {
        let mut voip = matrix::voip::VoipState::new();
        voip.call_history = matrix::voip::load_history();
        Self {
            matrix_client: Arc::new(Mutex::new(None)),
            is_locked: Arc::new(Mutex::new(false)),
            voip_state: Arc::new(Mutex::new(voip)),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::restore_session,
            commands::matrix_login,
            commands::matrix_logout,
            commands::set_display_name,
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
            commands::verify_user_identity,
            commands::enable_key_backup,
            commands::disable_key_backup,
            commands::get_key_backup_status,
            commands::wait_for_backup_upload,
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
            commands::get_media_thumbnail,
            commands::get_cache_size,
            commands::clear_media_cache,
            commands::set_cache_limit,
            // Spaces (Phase 5)
            commands::create_space,
            commands::get_spaces,
            commands::get_space_children,
            commands::add_space_child,
            commands::remove_space_child,
            // Room Settings (Phase 5)
            commands::set_room_name,
            commands::set_room_topic,
            commands::set_room_avatar,
            commands::get_room_aliases,
            commands::add_room_alias,
            commands::remove_room_alias,
            commands::set_canonical_alias,
            commands::upgrade_room,
            // Power Levels & Moderation (Phase 5)
            commands::get_power_levels,
            commands::set_user_power_level,
            commands::kick_user,
            commands::ban_user,
            commands::unban_user,
            commands::get_banned_users,
            commands::set_server_acl,
            // Media (full URL resolver)
            commands::resolve_mxc_full_url,
            // Link Preview
            link_preview::fetch_link_preview,
            // VoIP / Calling (Phase 6)
            commands::call_invite,
            commands::call_answer,
            commands::call_hangup,
            commands::call_candidates,
            commands::get_call_state,
            commands::get_call_history,
            commands::clear_call_history,
            commands::get_turn_servers,
            // Plugin System (Phase 7)
            commands::install_plugin,
            commands::remove_plugin,
            commands::list_plugins,
            commands::get_plugin_config,
            commands::set_plugin_config,
            // Phase 8: Privacy, Security & Polish
            commands::get_proxy_config,
            commands::set_proxy_config,
            commands::test_proxy_connection,
            commands::pin_certificate,
            commands::get_pinned_certs,
            commands::remove_pinned_cert,
            commands::get_doh_config,
            commands::set_doh_config,
            commands::export_settings,
            commands::import_settings,
            commands::add_account,
            commands::remove_account,
            commands::switch_account,
            commands::list_accounts,
            commands::check_integrity,
            commands::repair_database,
            commands::save_draft,
            commands::get_draft,
            commands::get_all_drafts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PufferChat");
}

