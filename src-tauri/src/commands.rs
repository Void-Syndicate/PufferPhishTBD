/// Tauri IPC Commands
///
/// All frontend <-> backend communication flows through these commands.
/// Each command validates input and returns structured results.
///
/// SECURITY: No secrets are logged. All errors are sanitized before
/// returning to the frontend.

use tauri::State;

use crate::error::AppError;
use crate::matrix::client::{
    InvitedRoomSummary, LoginResult, MatrixClient, PaginationResult, PublicRoomInfo,
    RoomDetails, RoomMember, RoomSummary, TimelineMessage,
};
use crate::matrix::crypto;
use crate::store::keychain;
use crate::AppState;

// ══════════════════════════════════════════════════════════
// Auth commands (existing)
// ══════════════════════════════════════════════════════════

/// Login to Matrix homeserver with password
#[tauri::command]
pub async fn matrix_login(
    state: State<'_, AppState>,
    homeserver: String,
    username: String,
    password: String,
) -> Result<LoginResult, AppError> {
    // Check if app is locked
    if *state.is_locked.lock().await {
        return Err(AppError::Locked);
    }

    log::info!("Login attempt to homeserver: {}", homeserver);

    // Validate inputs
    if homeserver.is_empty() {
        return Err(AppError::Auth("Homeserver URL is required".into()));
    }
    if username.is_empty() {
        return Err(AppError::Auth("Username is required".into()));
    }
    if password.is_empty() {
        return Err(AppError::Auth("Password is required".into()));
    }

    // Strict URL validation
    let parsed_url = url::Url::parse(&homeserver)
        .map_err(|_| AppError::Auth("Invalid homeserver URL".into()))?;

    let scheme = parsed_url.scheme();
    let host = parsed_url
        .host_str()
        .ok_or_else(|| AppError::Auth("Homeserver URL must have a valid host".into()))?;

    if !parsed_url.username().is_empty() || parsed_url.password().is_some() {
        return Err(AppError::Auth(
            "Homeserver URL must not contain credentials".into(),
        ));
    }

    let is_local = host == "localhost" || host == "127.0.0.1" || host == "::1";
    if scheme != "https" && !is_local {
        return Err(AppError::Auth(
            "Homeserver must use HTTPS for security".into(),
        ));
    }
    if scheme != "https" && scheme != "http" {
        return Err(AppError::Auth("Invalid URL scheme".into()));
    }

    let (client, result, access_token) =
        MatrixClient::login(&homeserver, &username, password).await?;

    keychain::store_session(
        &result.user_id,
        &homeserver,
        &access_token,
        &result.device_id,
    )?;

    let mut client_lock = state.matrix_client.lock().await;
    *client_lock = Some(client);

    log::info!("Login successful for user: {}", result.user_id);
    Ok(result)
}

/// Check if saved session exists and restore it
#[tauri::command]
pub async fn restore_session(
    state: State<'_, AppState>,
) -> Result<Option<LoginResult>, AppError> {
    let session = keychain::get_session()?;

    let (user_id, homeserver, access_token, device_id) = match session {
        Some(s) => s,
        None => return Ok(None),
    };

    log::info!("Restoring saved session for {}", user_id);

    match MatrixClient::restore(&homeserver, &access_token, &user_id, &device_id).await {
        Ok(client) => {
            let display_name = client
                .inner()
                .account()
                .get_display_name()
                .await
                .ok()
                .flatten()
                .map(|n| n.to_string());

            let result = LoginResult {
                user_id: user_id.clone(),
                display_name,
                device_id: device_id.clone(),
            };

            let mut client_lock = state.matrix_client.lock().await;
            *client_lock = Some(client);

            log::info!("Session restored for {}", user_id);
            Ok(Some(result))
        }
        Err(e) => {
            log::warn!("Session restore failed, clearing stale creds: {}", e);
            keychain::clear_session()?;
            Ok(None)
        }
    }
}

/// Logout from Matrix
#[tauri::command]
pub async fn matrix_logout(state: State<'_, AppState>) -> Result<(), AppError> {
    let mut client_lock = state.matrix_client.lock().await;

    if let Some(client) = client_lock.as_ref() {
        client.logout().await?;
    }

    keychain::clear_session()?;

    *client_lock = None;
    log::info!("Logout completed");
    Ok(())
}

/// Get all joined rooms
#[tauri::command]
pub async fn get_rooms(state: State<'_, AppState>) -> Result<Vec<RoomSummary>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.get_rooms().await
}

/// Start the sync loop with event emission
#[tauri::command]
pub async fn start_sync(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.start_sync_with_events(app_handle).await
}

/// Get paginated messages for a room
#[tauri::command]
pub async fn get_room_messages(
    state: State<'_, AppState>,
    room_id: String,
    from: Option<String>,
    limit: Option<u32>,
) -> Result<PaginationResult, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let limit = limit.unwrap_or(50).min(100); // Cap at 100
    client.get_room_messages(&room_id, from, limit).await
}

/// Send a text message to a room
#[tauri::command]
pub async fn send_message(
    state: State<'_, AppState>,
    room_id: String,
    body: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.send_message(&room_id, &body).await
}

/// Send a reply to a specific message
#[tauri::command]
pub async fn send_reply(
    state: State<'_, AppState>,
    room_id: String,
    body: String,
    reply_to_event_id: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.send_reply(&room_id, &body, &reply_to_event_id).await
}

/// Edit an existing message
#[tauri::command]
pub async fn edit_message(
    state: State<'_, AppState>,
    room_id: String,
    event_id: String,
    new_body: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.edit_message(&room_id, &event_id, &new_body).await
}

/// Redact (delete) a message
#[tauri::command]
pub async fn delete_message(
    state: State<'_, AppState>,
    room_id: String,
    event_id: String,
    reason: Option<String>,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client
        .delete_message(&room_id, &event_id, reason.as_deref())
        .await
}

/// Send emoji reaction to a message
#[tauri::command]
pub async fn send_reaction(
    state: State<'_, AppState>,
    room_id: String,
    event_id: String,
    emoji: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.send_reaction(&room_id, &event_id, &emoji).await
}

/// Remove a reaction
#[tauri::command]
pub async fn remove_reaction(
    state: State<'_, AppState>,
    room_id: String,
    reaction_event_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client
        .remove_reaction(&room_id, &reaction_event_id)
        .await
}

/// Send typing indicator
#[tauri::command]
pub async fn send_typing(
    state: State<'_, AppState>,
    room_id: String,
    typing: bool,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.send_typing(&room_id, typing).await
}

/// Mark a room as read (send read receipt)
#[tauri::command]
pub async fn mark_read(
    state: State<'_, AppState>,
    room_id: String,
    event_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.mark_read(&room_id, &event_id).await
}

/// Get members of a room
#[tauri::command]
pub async fn get_room_members(
    state: State<'_, AppState>,
    room_id: String,
) -> Result<Vec<RoomMember>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.get_room_members(&room_id).await
}


/// Search messages in a room or globally
#[tauri::command]
pub async fn search_messages(
    state: State<'_, AppState>,
    room_id: Option<String>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<TimelineMessage>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let limit = limit.unwrap_or(50).min(200);
    client.search_messages(room_id.as_deref(), &query, limit).await
}

/// Create a new room
#[tauri::command]
pub async fn create_room(
    state: State<'_, AppState>,
    name: Option<String>,
    topic: Option<String>,
    is_direct: bool,
    invite_user_ids: Vec<String>,
    is_encrypted: bool,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.create_room(name, topic, is_direct, invite_user_ids, is_encrypted).await
}

/// Join a room by ID or alias
#[tauri::command]
pub async fn join_room(
    state: State<'_, AppState>,
    room_id_or_alias: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.join_room(&room_id_or_alias).await
}

/// Leave a room
#[tauri::command]
pub async fn leave_room(
    state: State<'_, AppState>,
    room_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.leave_room(&room_id).await
}

/// Invite a user to a room
#[tauri::command]
pub async fn invite_to_room(
    state: State<'_, AppState>,
    room_id: String,
    user_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.invite_to_room(&room_id, &user_id).await
}

/// Search public rooms in the directory
#[tauri::command]
pub async fn search_public_rooms(
    state: State<'_, AppState>,
    query: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<PublicRoomInfo>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.search_public_rooms(query, limit).await
}

/// Get detailed info for a room
#[tauri::command]
pub async fn get_room_info(
    state: State<'_, AppState>,
    room_id: String,
) -> Result<RoomDetails, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.get_room_info(&room_id).await
}

/// Get pending room invites
#[tauri::command]
pub async fn get_invited_rooms(
    state: State<'_, AppState>,
) -> Result<Vec<InvitedRoomSummary>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.get_invited_rooms().await
}

/// Accept a room invite
#[tauri::command]
pub async fn accept_invite(
    state: State<'_, AppState>,
    room_id: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.accept_invite(&room_id).await
}

/// Reject a room invite
#[tauri::command]
pub async fn reject_invite(
    state: State<'_, AppState>,
    room_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.reject_invite(&room_id).await
}

/// Resolve an mxc:// URL to an HTTP thumbnail URL
#[tauri::command]
pub async fn resolve_mxc_url(
    state: State<'_, AppState>,
    mxc_url: String,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let w = width.unwrap_or(64);
    let h = height.unwrap_or(64);
    client.resolve_mxc_url(&mxc_url, w, h)
}

/// Get a user's avatar URL
#[tauri::command]
pub async fn get_user_avatar(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<Option<String>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.get_user_avatar(&user_id).await
}

// ══════════════════════════════════════════════════════════
// Encryption & Security Commands (Phase 3)
// ══════════════════════════════════════════════════════════

/// Enable Megolm encryption for a room
#[tauri::command]
pub async fn enable_room_encryption(
    state: State<'_, AppState>,
    room_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let parsed_room_id: matrix_sdk::ruma::OwnedRoomId = room_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid room ID".into()))?;
    crypto::enable_room_encryption(client.inner(), &parsed_room_id).await
}

/// Get encryption status for a room
#[tauri::command]
pub async fn get_room_encryption_status(
    state: State<'_, AppState>,
    room_id: String,
) -> Result<crypto::RoomEncryptionStatus, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let parsed_room_id: matrix_sdk::ruma::OwnedRoomId = room_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid room ID".into()))?;
    crypto::get_room_encryption_status(client.inner(), &parsed_room_id).await
}

/// Request verification with a user
#[tauri::command]
pub async fn request_verification(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let parsed_user_id: matrix_sdk::ruma::OwnedUserId = user_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
    crypto::request_verification(client.inner(), &parsed_user_id).await
}

/// Request verification for a specific device
#[tauri::command]
pub async fn request_device_verification(
    state: State<'_, AppState>,
    user_id: String,
    device_id: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let parsed_user_id: matrix_sdk::ruma::OwnedUserId = user_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
    let parsed_device_id: matrix_sdk::ruma::OwnedDeviceId = device_id.into();
    crypto::request_device_verification(client.inner(), &parsed_user_id, &parsed_device_id).await
}

/// Accept a verification request
#[tauri::command]
pub async fn accept_verification(
    state: State<'_, AppState>,
    user_id: String,
    flow_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let parsed_user_id: matrix_sdk::ruma::OwnedUserId = user_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
    crypto::accept_verification_request(client.inner(), &parsed_user_id, &flow_id).await
}

/// Start SAS verification
#[tauri::command]
pub async fn start_sas_verification(
    state: State<'_, AppState>,
    user_id: String,
    flow_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let parsed_user_id: matrix_sdk::ruma::OwnedUserId = user_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
    crypto::start_sas_verification(client.inner(), &parsed_user_id, &flow_id).await
}

/// Get SAS emojis for verification
#[tauri::command]
pub async fn get_sas_emojis(
    state: State<'_, AppState>,
    user_id: String,
    flow_id: String,
) -> Result<Option<Vec<crypto::VerificationEmoji>>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let parsed_user_id: matrix_sdk::ruma::OwnedUserId = user_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
    crypto::get_sas_emojis(client.inner(), &parsed_user_id, &flow_id).await
}

/// Confirm SAS verification (emojis match)
#[tauri::command]
pub async fn confirm_sas_verification(
    state: State<'_, AppState>,
    user_id: String,
    flow_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let parsed_user_id: matrix_sdk::ruma::OwnedUserId = user_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
    crypto::confirm_sas_verification(client.inner(), &parsed_user_id, &flow_id).await
}

/// Cancel a verification
#[tauri::command]
pub async fn cancel_verification(
    state: State<'_, AppState>,
    user_id: String,
    flow_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let parsed_user_id: matrix_sdk::ruma::OwnedUserId = user_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
    crypto::cancel_verification(client.inner(), &parsed_user_id, &flow_id).await
}

/// Get verification state
#[tauri::command]
pub async fn get_verification_state(
    state: State<'_, AppState>,
    user_id: String,
    flow_id: String,
) -> Result<crypto::VerificationState, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let parsed_user_id: matrix_sdk::ruma::OwnedUserId = user_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
    crypto::get_verification_state(client.inner(), &parsed_user_id, &flow_id).await
}

/// Bootstrap cross-signing
#[tauri::command]
pub async fn bootstrap_cross_signing(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::bootstrap_cross_signing(client.inner()).await
}

/// Get cross-signing status
#[tauri::command]
pub async fn get_cross_signing_status(
    state: State<'_, AppState>,
) -> Result<crypto::CrossSigningStatus, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::get_cross_signing_status(client.inner()).await
}

/// Get verification status for a specific user
#[tauri::command]
pub async fn get_user_verification_status(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<crypto::UserVerificationStatus, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    let parsed_user_id: matrix_sdk::ruma::OwnedUserId = user_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
    crypto::get_user_verification_status(client.inner(), &parsed_user_id).await
}

/// Enable key backup
#[tauri::command]
pub async fn enable_key_backup(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::enable_key_backup(client.inner()).await
}

/// Disable key backup
#[tauri::command]
pub async fn disable_key_backup(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::disable_key_backup(client.inner()).await
}

/// Get key backup status
#[tauri::command]
pub async fn get_key_backup_status(
    state: State<'_, AppState>,
) -> Result<crypto::KeyBackupStatus, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::get_key_backup_status(client.inner()).await
}

/// Setup secret storage (SSSS) and get recovery key
#[tauri::command]
pub async fn setup_secret_storage(
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::setup_secret_storage(client.inner()).await
}

/// Check if recovery is enabled
#[tauri::command]
pub async fn is_recovery_enabled(
    state: State<'_, AppState>,
) -> Result<bool, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::is_recovery_enabled(client.inner()).await
}

/// Recover secrets using recovery key
#[tauri::command]
pub async fn recover_with_key(
    state: State<'_, AppState>,
    recovery_key: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::recover_with_key(client.inner(), recovery_key).await
}

/// Reset recovery key
#[tauri::command]
pub async fn reset_recovery_key(
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::reset_recovery(client.inner()).await
}

/// Get all devices for current user
#[tauri::command]
pub async fn get_own_devices(
    state: State<'_, AppState>,
) -> Result<Vec<crypto::DeviceInfo>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::get_own_devices(client.inner()).await
}

/// Delete a device
#[tauri::command]
pub async fn delete_device(
    state: State<'_, AppState>,
    device_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::delete_device(client.inner(), &device_id).await
}

/// Rename a device
#[tauri::command]
pub async fn rename_device(
    state: State<'_, AppState>,
    device_id: String,
    new_name: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::rename_device(client.inner(), &device_id, &new_name).await
}

/// Export room keys (returns encrypted data)
#[tauri::command]
pub async fn export_room_keys(
    state: State<'_, AppState>,
    passphrase: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::export_room_keys(client.inner(), passphrase).await
}

/// Import room keys (from encrypted data)
#[tauri::command]
pub async fn import_room_keys(
    state: State<'_, AppState>,
    data: String,
    passphrase: String,
) -> Result<u64, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    crypto::import_room_keys(client.inner(), &data, passphrase).await
}

/// Setup auto-lock with passphrase
#[tauri::command]
pub async fn setup_auto_lock(
    _state: State<'_, AppState>,
    passphrase: String,
    timeout_secs: u64,
) -> Result<(), AppError> {
    crypto::setup_auto_lock(&passphrase, timeout_secs)
}

/// Verify unlock passphrase
#[tauri::command]
pub async fn verify_unlock_passphrase(
    state: State<'_, AppState>,
    passphrase: String,
) -> Result<bool, AppError> {
    let valid = crypto::verify_lock_passphrase(&passphrase)?;
    if valid {
        let mut locked = state.is_locked.lock().await;
        *locked = false;
    }
    Ok(valid)
}

/// Lock the app
#[tauri::command]
pub async fn lock_app(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut locked = state.is_locked.lock().await;
    *locked = true;
    Ok(())
}

/// Check if app is locked
#[tauri::command]
pub async fn is_app_locked(
    state: State<'_, AppState>,
) -> Result<bool, AppError> {
    let locked = state.is_locked.lock().await;
    Ok(*locked)
}

/// Check if auto-lock is configured
#[tauri::command]
pub async fn is_auto_lock_enabled() -> Result<bool, AppError> {
    crypto::is_auto_lock_enabled()
}

/// Get lock timeout in seconds
#[tauri::command]
pub async fn get_lock_timeout() -> Result<u64, AppError> {
    crypto::get_lock_timeout()
}

/// Disable auto-lock
#[tauri::command]
pub async fn disable_auto_lock() -> Result<(), AppError> {
    crypto::disable_auto_lock()
}
