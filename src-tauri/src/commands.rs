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
    BannedUser, InvitedRoomSummary, LoginResult, MatrixClient, PaginationResult,
    PowerLevelInfo, PublicRoomInfo, RoomDetails, RoomMember, RoomSummary, TimelineMessage,
};
use crate::matrix::crypto;
use crate::matrix::media;
use crate::store::keychain;
use crate::AppState;

// ----------------------------------------------------------
// Auth commands (existing)
// ----------------------------------------------------------

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

// ----------------------------------------------------------
// Encryption & Security Commands (Phase 3)
// ----------------------------------------------------------

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

// ------------------------------------------------------------
// Media Cache Commands (Phase 4)
// ------------------------------------------------------------

/// Cache info returned to frontend
#[derive(serde::Serialize, Clone)]
pub struct CacheInfo {
    pub total_bytes: u64,
    pub file_count: u64,
    pub max_bytes: u64,
}

/// Path to the media cache directory
fn media_cache_dir() -> Result<std::path::PathBuf, AppError> {
    let base = dirs::cache_dir()
        .ok_or_else(|| AppError::Internal("Cannot determine cache directory".into()))?;
    Ok(base.join("pufferchat").join("media"))
}

/// Path to the cache config file (stores max_bytes)
fn cache_config_path() -> Result<std::path::PathBuf, AppError> {
    let base = dirs::cache_dir()
        .ok_or_else(|| AppError::Internal("Cannot determine cache directory".into()))?;
    Ok(base.join("pufferchat").join("cache_config.json"))
}

fn read_max_bytes() -> u64 {
    if let Ok(path) = cache_config_path() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Some(n) = v.get("max_bytes").and_then(|n| n.as_u64()) {
                    return n;
                }
            }
        }
    }
    0 // 0 = unlimited
}

fn write_max_bytes(max_bytes: u64) -> Result<(), AppError> {
    let path = cache_config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Internal(format!("Failed to create config dir: {}", e)))?;
    }
    let json = serde_json::json!({ "max_bytes": max_bytes });
    std::fs::write(&path, json.to_string())
        .map_err(|e| AppError::Internal(format!("Failed to write cache config: {}", e)))?;
    Ok(())
}

/// Get cache size info
#[tauri::command]
pub async fn get_cache_size() -> Result<CacheInfo, AppError> {
    let cache_dir = media_cache_dir()?;
    let mut total_bytes: u64 = 0;
    let mut file_count: u64 = 0;

    if cache_dir.exists() {
        fn walk(dir: &std::path::Path, total: &mut u64, count: &mut u64) {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        walk(&path, total, count);
                    } else if let Ok(meta) = entry.metadata() {
                        *total += meta.len();
                        *count += 1;
                    }
                }
            }
        }
        walk(&cache_dir, &mut total_bytes, &mut file_count);
    }

    Ok(CacheInfo {
        total_bytes,
        file_count,
        max_bytes: read_max_bytes(),
    })
}

/// Clear all cached media files
#[tauri::command]
pub async fn clear_media_cache() -> Result<(), AppError> {
    let cache_dir = media_cache_dir()?;
    if cache_dir.exists() {
        std::fs::remove_dir_all(&cache_dir)
            .map_err(|e| AppError::Internal(format!("Failed to clear cache: {}", e)))?;
    }
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| AppError::Internal(format!("Failed to recreate cache dir: {}", e)))?;
    log::info!("Media cache cleared");
    Ok(())
}

/// Set maximum cache size in bytes (0 = unlimited)
#[tauri::command]
pub async fn set_cache_limit(max_bytes: u64) -> Result<(), AppError> {
    write_max_bytes(max_bytes)?;
    log::info!("Cache limit set to {} bytes", max_bytes);
    Ok(())
}
// -------------------------------------------------------
// Media commands (Phase 4)
// -------------------------------------------------------

/// Send an image to a room
#[tauri::command]
pub async fn send_image(
    state: State<'_, AppState>,
    room_id: String,
    file_path: String,
    caption: Option<String>,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;

    let mime_type = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    let mxc_url = media::upload_media(client.inner(), &file_path, &mime_type).await?;
    let mxc_uri: matrix_sdk::ruma::OwnedMxcUri = mxc_url
        .as_str()
        .try_into()
        .map_err(|_| AppError::Internal("Invalid mxc URI from upload".into()))?;

    let filename = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "image".into());

    let body = caption.unwrap_or_else(|| filename.clone());

    use matrix_sdk::ruma::events::room::message::{
        ImageMessageEventContent, MessageType, RoomMessageEventContent,
    };
    use matrix_sdk::ruma::events::room::MediaSource;

    let content_msg = ImageMessageEventContent::new(body, MediaSource::Plain(mxc_uri));
    let msg = RoomMessageEventContent::new(MessageType::Image(content_msg));

    let parsed_room_id: matrix_sdk::ruma::OwnedRoomId = room_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid room ID".into()))?;

    let room = client.inner().get_room(&parsed_room_id)
        .ok_or_else(|| AppError::Matrix("Room not found".into()))?;

    let response = room.send(msg).await
        .map_err(|e| AppError::Matrix(e.to_string()))?;

    Ok(response.event_id.to_string())
}

/// Send a video to a room
#[tauri::command]
pub async fn send_video(
    state: State<'_, AppState>,
    room_id: String,
    file_path: String,
    caption: Option<String>,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;

    let mime_type = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    let mxc_url = media::upload_media(client.inner(), &file_path, &mime_type).await?;
    let mxc_uri: matrix_sdk::ruma::OwnedMxcUri = mxc_url
        .as_str()
        .try_into()
        .map_err(|_| AppError::Internal("Invalid mxc URI from upload".into()))?;

    let filename = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "video".into());

    let body = caption.unwrap_or_else(|| filename.clone());

    use matrix_sdk::ruma::events::room::message::{
        VideoMessageEventContent, MessageType, RoomMessageEventContent,
    };
    use matrix_sdk::ruma::events::room::MediaSource;

    let content_msg = VideoMessageEventContent::new(body, MediaSource::Plain(mxc_uri));
    let msg = RoomMessageEventContent::new(MessageType::Video(content_msg));

    let parsed_room_id: matrix_sdk::ruma::OwnedRoomId = room_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid room ID".into()))?;

    let room = client.inner().get_room(&parsed_room_id)
        .ok_or_else(|| AppError::Matrix("Room not found".into()))?;

    let response = room.send(msg).await
        .map_err(|e| AppError::Matrix(e.to_string()))?;

    Ok(response.event_id.to_string())
}

/// Send audio to a room
#[tauri::command]
pub async fn send_audio(
    state: State<'_, AppState>,
    room_id: String,
    file_path: String,
    caption: Option<String>,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;

    let mime_type = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    let mxc_url = media::upload_media(client.inner(), &file_path, &mime_type).await?;
    let mxc_uri: matrix_sdk::ruma::OwnedMxcUri = mxc_url
        .as_str()
        .try_into()
        .map_err(|_| AppError::Internal("Invalid mxc URI from upload".into()))?;

    let filename = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "audio".into());

    let body = caption.unwrap_or_else(|| filename.clone());

    use matrix_sdk::ruma::events::room::message::{
        AudioMessageEventContent, MessageType, RoomMessageEventContent,
    };
    use matrix_sdk::ruma::events::room::MediaSource;

    let content_msg = AudioMessageEventContent::new(body, MediaSource::Plain(mxc_uri));
    let msg = RoomMessageEventContent::new(MessageType::Audio(content_msg));

    let parsed_room_id: matrix_sdk::ruma::OwnedRoomId = room_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid room ID".into()))?;

    let room = client.inner().get_room(&parsed_room_id)
        .ok_or_else(|| AppError::Matrix("Room not found".into()))?;

    let response = room.send(msg).await
        .map_err(|e| AppError::Matrix(e.to_string()))?;

    Ok(response.event_id.to_string())
}

/// Send a generic file to a room
#[tauri::command]
pub async fn send_file(
    state: State<'_, AppState>,
    room_id: String,
    file_path: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;

    let mime_type = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    let mxc_url = media::upload_media(client.inner(), &file_path, &mime_type).await?;
    let mxc_uri: matrix_sdk::ruma::OwnedMxcUri = mxc_url
        .as_str()
        .try_into()
        .map_err(|_| AppError::Internal("Invalid mxc URI from upload".into()))?;

    let filename = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".into());

    use matrix_sdk::ruma::events::room::message::{
        FileMessageEventContent, MessageType, RoomMessageEventContent,
    };
    use matrix_sdk::ruma::events::room::MediaSource;

    let content_msg = FileMessageEventContent::new(filename, MediaSource::Plain(mxc_uri));
    let msg = RoomMessageEventContent::new(MessageType::File(content_msg));

    let parsed_room_id: matrix_sdk::ruma::OwnedRoomId = room_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid room ID".into()))?;

    let room = client.inner().get_room(&parsed_room_id)
        .ok_or_else(|| AppError::Matrix("Room not found".into()))?;

    let response = room.send(msg).await
        .map_err(|e| AppError::Matrix(e.to_string()))?;

    Ok(response.event_id.to_string())
}

/// Download media from an mxc URL to a local file
#[tauri::command]
pub async fn download_media(
    state: State<'_, AppState>,
    mxc_url: String,
    save_path: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    media::download_media(client.inner(), &mxc_url, &save_path).await
}

/// Resolve an mxc URL to a full-resolution HTTP URL (not thumbnail)
#[tauri::command]
pub async fn resolve_mxc_full_url(
    state: State<'_, AppState>,
    mxc_url: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    media::resolve_mxc_to_http(client.inner(), &mxc_url)
}// ----------------------------------------------------------
// Spaces Commands (Phase 5)
// ----------------------------------------------------------

/// Summary of a child room/subspace in a space
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SpaceChild {
    pub room_id: String,
    pub name: Option<String>,
    pub topic: Option<String>,
    pub num_members: u64,
    pub is_space: bool,
    pub order: Option<String>,
    pub suggested: bool,
}

/// Summary of a joined space
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SpaceSummary {
    pub room_id: String,
    pub name: Option<String>,
    pub topic: Option<String>,
    pub avatar_url: Option<String>,
    pub child_count: u64,
}

/// Create a Matrix Space (room with m.space type)
#[tauri::command]
pub async fn create_space(
    state: State<'_, AppState>,
    name: String,
    topic: Option<String>,
    avatar_url: Option<String>,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;

    use matrix_sdk::ruma::api::client::room::create_room::v3::Request as CreateRoomRequest;
    use matrix_sdk::ruma::api::client::room::create_room::v3::{CreationContent, RoomPreset};
    use matrix_sdk::ruma::room::RoomType;
    use matrix_sdk::ruma::serde::Raw;

    let mut request = CreateRoomRequest::new();
    request.name = Some(name);
    request.topic = topic;
    request.preset = Some(RoomPreset::PrivateChat);

    // Set room type to m.space via creation_content
    let mut creation = CreationContent::new();
    creation.room_type = Some(RoomType::Space);
    request.creation_content = Some(Raw::new(&creation)
        .map_err(|e| AppError::Internal(e.to_string()))?);

    let mut initial_state: Vec<Raw<matrix_sdk::ruma::events::AnyInitialStateEvent>> = Vec::new();

    if let Some(ref avatar) = avatar_url {
        let avatar_json = serde_json::json!({
            "type": "m.room.avatar",
            "state_key": "",
            "content": {
                "url": avatar
            }
        });
        let raw = Raw::from_json(serde_json::value::to_raw_value(&avatar_json).unwrap());
        initial_state.push(raw);
    }

    request.initial_state = initial_state;

    let response = client.inner().send(request).await
        .map_err(|e| AppError::Matrix(e.to_string()))?;

    Ok(response.room_id.to_string())
}

/// Get all joined spaces
#[tauri::command]
pub async fn get_spaces(
    state: State<'_, AppState>,
) -> Result<Vec<SpaceSummary>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;

    let rooms = client.inner().joined_rooms();
    let mut spaces = Vec::new();

    for room in rooms {
        // Check if this room is a space by looking at room type
        let is_space = room.is_space();
        if !is_space {
            continue;
        }

        let name = room.display_name().await.ok().map(|n| n.to_string());
        let topic = room.topic().map(|t| t.to_string());

        let avatar_url = room.avatar_url().map(|u| u.to_string());

        // Count children by looking at m.space.child state events
        let child_count = {
            use matrix_sdk::ruma::events::space::child::SpaceChildEventContent;
            let events = room.get_state_events_static::<SpaceChildEventContent>().await;
            match events {
                Ok(evts) => evts.len() as u64,
                Err(_) => 0,
            }
        };

        spaces.push(SpaceSummary {
            room_id: room.room_id().to_string(),
            name,
            topic,
            avatar_url,
            child_count,
        });
    }

    Ok(spaces)
}

/// Get children of a space
#[tauri::command]
pub async fn get_space_children(
    state: State<'_, AppState>,
    space_id: String,
) -> Result<Vec<SpaceChild>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;

    let parsed_space_id: matrix_sdk::ruma::OwnedRoomId = space_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid space ID".into()))?;

    let space_room = client.inner().get_room(&parsed_space_id)
        .ok_or_else(|| AppError::RoomNotFound(space_id.clone()))?;

    use matrix_sdk::ruma::events::space::child::SpaceChildEventContent;
    let child_events = space_room.get_state_events_static::<SpaceChildEventContent>().await
        .map_err(|e| AppError::Matrix(e.to_string()))?;

    let mut children = Vec::new();

    for raw_event in child_events {
        if let Ok(event) = raw_event.deserialize() {
            let child_room_id = event.state_key().to_string();
            if child_room_id.is_empty() {
                continue;
            }

            use matrix_sdk::deserialized_responses::SyncOrStrippedState;
            let content = match &event {
                SyncOrStrippedState::Sync(sync_event) => sync_event.as_original().map(|e| &e.content),
                SyncOrStrippedState::Stripped(_stripped) => None,
            };

            let order = content.and_then(|c| c.order.clone());
            let suggested = content.map(|c| c.suggested).unwrap_or(false);

            // Check if via is empty (removed child)
            let via = content.map(|c| &c.via);
            if via.map(|v: &Vec<_>| v.is_empty()).unwrap_or(true) {
                // Redacted or removed child, skip
                if content.is_none() {
                    continue;
                }
            }

            let parsed_child_id: Result<matrix_sdk::ruma::OwnedRoomId, _> = child_room_id
                .as_str()
                .try_into();

            let (name, topic, num_members, is_space) = if let Ok(ref cid) = parsed_child_id {
                if let Some(child_room) = client.inner().get_room(cid) {
                    let n = child_room.display_name().await.ok().map(|n| n.to_string());
                    let t = child_room.topic().map(|t| t.to_string());
                    let m = child_room.joined_members_count();
                    let s = child_room.is_space();
                    (n, t, m, s)
                } else {
                    (None, None, 0, false)
                }
            } else {
                (None, None, 0, false)
            };

            children.push(SpaceChild {
                room_id: child_room_id,
                name,
                topic,
                num_members,
                is_space,
                order,
                suggested,
            });
        }
    }

    // Sort by order, then name
    children.sort_by(|a, b| {
        a.order.cmp(&b.order).then_with(|| a.name.cmp(&b.name))
    });

    Ok(children)
}

/// Add a room as a child of a space
#[tauri::command]
pub async fn add_space_child(
    state: State<'_, AppState>,
    space_id: String,
    child_room_id: String,
    order: Option<String>,
    suggested: Option<bool>,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;

    let parsed_space_id: matrix_sdk::ruma::OwnedRoomId = space_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid space ID".into()))?;

    let space_room = client.inner().get_room(&parsed_space_id)
        .ok_or_else(|| AppError::RoomNotFound(space_id.clone()))?;

    use matrix_sdk::ruma::events::space::child::SpaceChildEventContent;
    use matrix_sdk::ruma::OwnedServerName;

    // Get homeserver from child room ID
    let server_name: OwnedServerName = child_room_id
        .split(':')
        .nth(1)
        .unwrap_or("matrix.org")
        .try_into()
        .map_err(|_| AppError::InvalidInput("Cannot parse server from room ID".into()))?;

    let mut content = SpaceChildEventContent::new(vec![server_name]);
    content.order = order;
    content.suggested = suggested.unwrap_or(false);

    let child_id: matrix_sdk::ruma::OwnedRoomId = child_room_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid child room ID".into()))?;

    space_room.send_state_event_for_key(&child_id, content).await
        .map_err(|e| AppError::Matrix(e.to_string()))?;

    Ok(())
}

/// Remove a room from a space
#[tauri::command]
pub async fn remove_space_child(
    state: State<'_, AppState>,
    space_id: String,
    child_room_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;

    let parsed_space_id: matrix_sdk::ruma::OwnedRoomId = space_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid space ID".into()))?;

    let space_room = client.inner().get_room(&parsed_space_id)
        .ok_or_else(|| AppError::RoomNotFound(space_id.clone()))?;

    use matrix_sdk::ruma::events::space::child::SpaceChildEventContent;

    // Send empty via list to remove the child
    let content = SpaceChildEventContent::new(vec![]);

    let child_id: matrix_sdk::ruma::OwnedRoomId = child_room_id
        .as_str()
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid child room ID".into()))?;

    space_room.send_state_event_for_key(&child_id, content).await
        .map_err(|e| AppError::Matrix(e.to_string()))?;

    Ok(())
}

// ----------------------------------------------------------
// Room Settings Commands (Phase 5)
// ----------------------------------------------------------

/// Set room name
#[tauri::command]
pub async fn set_room_name(
    state: State<'_, AppState>,
    room_id: String,
    name: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.set_room_name(&room_id, &name).await
}

/// Set room topic
#[tauri::command]
pub async fn set_room_topic(
    state: State<'_, AppState>,
    room_id: String,
    topic: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.set_room_topic(&room_id, &topic).await
}

/// Set room avatar
#[tauri::command]
pub async fn set_room_avatar(
    state: State<'_, AppState>,
    room_id: String,
    file_path: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.set_room_avatar(&room_id, &file_path).await
}

/// Get room aliases
#[tauri::command]
pub async fn get_room_aliases(
    state: State<'_, AppState>,
    room_id: String,
) -> Result<Vec<String>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.get_room_aliases(&room_id).await
}

/// Add room alias
#[tauri::command]
pub async fn add_room_alias(
    state: State<'_, AppState>,
    room_id: String,
    alias: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.add_room_alias(&room_id, &alias).await
}

/// Remove room alias
#[tauri::command]
pub async fn remove_room_alias(
    state: State<'_, AppState>,
    alias: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.remove_room_alias(&alias).await
}

/// Set canonical alias
#[tauri::command]
pub async fn set_canonical_alias(
    state: State<'_, AppState>,
    room_id: String,
    alias: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.set_canonical_alias(&room_id, &alias).await
}

/// Upgrade room version
#[tauri::command]
pub async fn upgrade_room(
    state: State<'_, AppState>,
    room_id: String,
    new_version: String,
) -> Result<String, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.upgrade_room(&room_id, &new_version).await
}
// ----------------------------------------------------------
// Power Levels & Moderation Commands (Phase 5)
// ----------------------------------------------------------

/// Get power levels for a room
#[tauri::command]
pub async fn get_power_levels(
    state: State<'_, AppState>,
    room_id: String,
) -> Result<PowerLevelInfo, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.get_power_levels(&room_id).await
}

/// Set a user's power level in a room
#[tauri::command]
pub async fn set_user_power_level(
    state: State<'_, AppState>,
    room_id: String,
    user_id: String,
    level: i64,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.set_user_power_level(&room_id, &user_id, level).await
}

/// Kick a user from a room
#[tauri::command]
pub async fn kick_user(
    state: State<'_, AppState>,
    room_id: String,
    user_id: String,
    reason: Option<String>,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.kick_user(&room_id, &user_id, reason.as_deref()).await
}

/// Ban a user from a room
#[tauri::command]
pub async fn ban_user(
    state: State<'_, AppState>,
    room_id: String,
    user_id: String,
    reason: Option<String>,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.ban_user(&room_id, &user_id, reason.as_deref()).await
}

/// Unban a user from a room
#[tauri::command]
pub async fn unban_user(
    state: State<'_, AppState>,
    room_id: String,
    user_id: String,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.unban_user(&room_id, &user_id).await
}

/// Get banned users in a room
#[tauri::command]
pub async fn get_banned_users(
    state: State<'_, AppState>,
    room_id: String,
) -> Result<Vec<BannedUser>, AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.get_banned_users(&room_id).await
}

/// Set server ACLs for a room
#[tauri::command]
pub async fn set_server_acl(
    state: State<'_, AppState>,
    room_id: String,
    allow: Vec<String>,
    deny: Vec<String>,
) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.set_server_acl(&room_id, allow, deny).await
}
