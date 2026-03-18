/// Tauri IPC Commands
/// 
/// All frontend ↔ backend communication flows through these commands.
/// Each command validates input and returns structured results.
/// 
/// SECURITY: No secrets are logged. All errors are sanitized before
/// returning to the frontend.

use tauri::State;

use crate::error::AppError;
use crate::matrix::client::{LoginResult, MatrixClient, RoomSummary};
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

    // Ensure HTTPS (no plaintext connections)
    if !homeserver.starts_with("https://") {
        // Allow localhost for development
        if !homeserver.contains("localhost") && !homeserver.contains("127.0.0.1") {
            return Err(AppError::Auth(
                "Homeserver must use HTTPS for security".into(),
            ));
        }
    }

    // Perform login
    let (client, result) = MatrixClient::login(&homeserver, &username, password).await?;

    // Store session in OS keychain
    keychain::store_session(
        &result.user_id,
        &homeserver,
        &result.access_token,
        &result.device_id,
    )?;

    // Store client in app state
    let mut client_lock = state.matrix_client.lock().await;
    *client_lock = Some(client);

    log::info!("Login successful for user: {}", result.user_id);
    Ok(result)
}

/// Logout from Matrix
#[tauri::command]
pub async fn matrix_logout(state: State<'_, AppState>) -> Result<(), AppError> {
    let mut client_lock = state.matrix_client.lock().await;

    if let Some(client) = client_lock.as_ref() {
        client.logout().await?;
    }

    // Clear stored session
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

/// Start the sync loop
#[tauri::command]
pub async fn start_sync(state: State<'_, AppState>) -> Result<(), AppError> {
    let client_lock = state.matrix_client.lock().await;
    let client = client_lock.as_ref().ok_or(AppError::NotLoggedIn)?;
    client.start_sync().await
}
