/// OS Keychain integration for secure credential storage
/// 
/// SECURITY: All tokens and session data stored here, never in plaintext files.
/// Uses:
/// - Windows: Credential Manager
/// - macOS: Keychain
/// - Linux: libsecret (GNOME Keyring / KDE Wallet)

use crate::error::AppError;

const SERVICE_NAME: &str = "pufferchat";

/// Store a secret in the OS keychain
pub fn store_secret(key: &str, value: &str) -> Result<(), AppError> {
    let entry = keyring::Entry::new(SERVICE_NAME, key)
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    entry
        .set_password(value)
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    Ok(())
}

/// Retrieve a secret from the OS keychain
pub fn get_secret(key: &str) -> Result<Option<String>, AppError> {
    let entry = keyring::Entry::new(SERVICE_NAME, key)
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keychain(e.to_string())),
    }
}

/// Delete a secret from the OS keychain
pub fn delete_secret(key: &str) -> Result<(), AppError> {
    let entry = keyring::Entry::new(SERVICE_NAME, key)
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already gone
        Err(e) => Err(AppError::Keychain(e.to_string())),
    }
}

/// Store Matrix session credentials
pub fn store_session(
    user_id: &str,
    homeserver: &str,
    access_token: &str,
    device_id: &str,
) -> Result<(), AppError> {
    store_secret("session_user_id", user_id)?;
    store_secret("session_homeserver", homeserver)?;
    store_secret("session_access_token", access_token)?;
    store_secret("session_device_id", device_id)?;
    Ok(())
}

/// Retrieve stored Matrix session credentials
pub fn get_session() -> Result<Option<(String, String, String, String)>, AppError> {
    let user_id = get_secret("session_user_id")?;
    let homeserver = get_secret("session_homeserver")?;
    let access_token = get_secret("session_access_token")?;
    let device_id = get_secret("session_device_id")?;

    match (user_id, homeserver, access_token, device_id) {
        (Some(u), Some(h), Some(a), Some(d)) => Ok(Some((u, h, a, d))),
        _ => Ok(None),
    }
}

/// Clear all stored session credentials
pub fn clear_session() -> Result<(), AppError> {
    delete_secret("session_user_id")?;
    delete_secret("session_homeserver")?;
    delete_secret("session_access_token")?;
    delete_secret("session_device_id")?;
    Ok(())
}
