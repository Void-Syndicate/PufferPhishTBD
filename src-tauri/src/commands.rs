/// Tauri IPC Commands
///
/// All frontend ↔ backend communication flows through these commands.
/// Each command validates input and returns structured results.
///
/// SECURITY: No secrets are logged. All errors are sanitized before
/// returning to the frontend.

use tauri::State;

use crate::error::AppError;
use crate::matrix::client::{
    LoginResult, MatrixClient, PaginationResult, RoomMember, RoomSummary, TimelineMessage,
};
use crate::store::keychain;
use crate::AppState;

/// Login to Matrix homeserver with password
#[tauri::command]
pub async fn matrix_login(
    state: State<'_, AppState>,
    homeserver: String,
    username: String,
    password: String,
) -> Result<LoginResult, AppError> {
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