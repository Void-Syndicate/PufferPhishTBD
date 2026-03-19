/// Encryption & Security module for PufferChat
///
/// Implements:
/// - Megolm room encryption toggle
/// - Device verification (emoji SAS + QR code)
/// - Cross-signing bootstrap & management
/// - SSSS (Secure Secret Storage and Sharing)
/// - Key backup to homeserver
/// - Key recovery from backup
/// - Session/device management
/// - Key export/import (encrypted)
/// - Memory zeroization for crypto material
/// - Auto-lock with passphrase

use matrix_sdk::{
    encryption::backups::BackupState,
    ruma::{
        OwnedDeviceId, UserId,
        events::room::encryption::RoomEncryptionEventContent,
    },
    Client,
};
use serde::Serialize;
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::error::AppError;

// ----------------------------------------------------------
// Serializable types for frontend communication
// ----------------------------------------------------------

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub device_id: String,
    pub display_name: Option<String>,
    pub is_verified: bool,
    pub is_current: bool,
    pub last_seen_ip: Option<String>,
    pub last_seen_ts: Option<i64>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VerificationEmoji {
    pub symbol: String,
    pub description: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VerificationState {
    pub flow_id: String,
    pub other_user_id: String,
    pub other_device_id: Option<String>,
    pub state: String, // "requested", "ready", "started", "emojis", "done", "cancelled"
    pub emojis: Option<Vec<VerificationEmoji>>,
    pub decimals: Option<(u16, u16, u16)>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CrossSigningStatus {
    pub has_master: bool,
    pub has_self_signing: bool,
    pub has_user_signing: bool,
    pub is_complete: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KeyBackupStatus {
    pub enabled: bool,
    pub version: Option<String>,
    pub backed_up_keys: i64,
    pub total_keys: i64,
    pub state: String, // "unknown", "creating", "enabling", "resuming", "enabled", "downloading", "disabling"
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UserVerificationStatus {
    pub user_id: String,
    pub is_verified: bool,
    pub has_cross_signing_keys: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RoomEncryptionStatus {
    pub room_id: String,
    pub is_encrypted: bool,
    pub algorithm: Option<String>,
    pub rotation_period_msgs: Option<u64>,
}

/// Passphrase-protected wrapper for sensitive material
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecurePassphrase {
    inner: String,
}

impl SecurePassphrase {
    pub fn new(passphrase: String) -> Self {
        Self { inner: passphrase }
    }

    pub fn as_str(&self) -> &str {
        &self.inner
    }
}

// ----------------------------------------------------------
// Encryption operations on the Matrix client
// ----------------------------------------------------------

/// Enable Megolm encryption for a room that isn't already encrypted
pub async fn enable_room_encryption(
    client: &Client,
    room_id: &matrix_sdk::ruma::RoomId,
) -> Result<(), AppError> {
    let room = client
        .get_room(room_id)
        .ok_or_else(|| AppError::RoomNotFound(room_id.to_string()))?;

    let is_encrypted = room.is_encrypted().await.unwrap_or(false);
    if is_encrypted {
        return Err(AppError::InvalidInput(
            "Room is already encrypted".into(),
        ));
    }

    let content = RoomEncryptionEventContent::with_recommended_defaults();
    room.send_state_event(content)
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to enable encryption: {}", e)))?;

    Ok(())
}

/// Get encryption status for a room
pub async fn get_room_encryption_status(
    client: &Client,
    room_id: &matrix_sdk::ruma::RoomId,
) -> Result<RoomEncryptionStatus, AppError> {
    let room = client
        .get_room(room_id)
        .ok_or_else(|| AppError::RoomNotFound(room_id.to_string()))?;

    let is_encrypted = room.is_encrypted().await.unwrap_or(false);

    Ok(RoomEncryptionStatus {
        room_id: room_id.to_string(),
        is_encrypted,
        algorithm: if is_encrypted {
            Some("m.megolm.v1.aes-sha2".to_string())
        } else {
            None
        },
        rotation_period_msgs: None,
    })
}

// ----------------------------------------------------------
// Device Verification (SAS emoji comparison)
// ----------------------------------------------------------

/// Request verification with another user
pub async fn request_verification(
    client: &Client,
    user_id: &UserId,
) -> Result<String, AppError> {
    let encryption = client.encryption();
    let identity = encryption
        .get_user_identity(user_id)
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to get user identity: {}", e)))?
        .ok_or_else(|| AppError::Matrix("User identity not found".into()))?;

    let request = identity
        .request_verification()
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to request verification: {}", e)))?;

    Ok(request.flow_id().to_string())
}

/// Request verification of a specific device
pub async fn request_device_verification(
    client: &Client,
    user_id: &UserId,
    device_id: &OwnedDeviceId,
) -> Result<String, AppError> {
    let encryption = client.encryption();
    let device = encryption
        .get_device(user_id, device_id)
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to get device: {}", e)))?
        .ok_or_else(|| AppError::Matrix("Device not found".into()))?;

    let request = device
        .request_verification()
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to request verification: {}", e)))?;

    Ok(request.flow_id().to_string())
}

/// Accept a pending verification request
pub async fn accept_verification_request(
    client: &Client,
    user_id: &UserId,
    flow_id: &str,
) -> Result<(), AppError> {
    let encryption = client.encryption();
    let request = encryption
        .get_verification_request(user_id, flow_id)
        .await
        .ok_or_else(|| AppError::Matrix("Verification request not found".into()))?;

    request
        .accept()
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to accept verification: {}", e)))?;

    Ok(())
}

/// Start SAS verification (emoji comparison)
pub async fn start_sas_verification(
    client: &Client,
    user_id: &UserId,
    flow_id: &str,
) -> Result<(), AppError> {
    let encryption = client.encryption();
    let request = encryption
        .get_verification_request(user_id, flow_id)
        .await
        .ok_or_else(|| AppError::Matrix("Verification request not found".into()))?;

    request
        .start_sas()
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to start SAS: {}", e)))?;

    Ok(())
}

/// Get the SAS verification emojis for confirmation
pub async fn get_sas_emojis(
    client: &Client,
    user_id: &UserId,
    flow_id: &str,
) -> Result<Option<Vec<VerificationEmoji>>, AppError> {
    let encryption = client.encryption();

    if let Some(sas) = encryption.get_verification(user_id, flow_id).await {
        if let Some(sas) = sas.sas() {
            if let Some(emojis) = sas.emoji() {
                let result: Vec<VerificationEmoji> = emojis
                    .iter()
                    .map(|e| VerificationEmoji {
                        symbol: e.symbol.to_string(),
                        description: e.description.to_string(),
                    })
                    .collect();
                return Ok(Some(result));
            }
        }
    }

    Ok(None)
}

/// Confirm SAS verification (user confirmed emojis match)
pub async fn confirm_sas_verification(
    client: &Client,
    user_id: &UserId,
    flow_id: &str,
) -> Result<(), AppError> {
    let encryption = client.encryption();

    let verification = encryption
        .get_verification(user_id, flow_id)
        .await
        .ok_or_else(|| AppError::Matrix("Verification not found".into()))?;

    if let Some(sas) = verification.sas() {
        sas.confirm()
            .await
            .map_err(|e| AppError::Matrix(format!("Failed to confirm SAS: {}", e)))?;
    } else {
        return Err(AppError::Matrix("Not a SAS verification".into()));
    }

    Ok(())
}

/// Mismatch / cancel SAS verification
pub async fn cancel_verification(
    client: &Client,
    user_id: &UserId,
    flow_id: &str,
) -> Result<(), AppError> {
    let encryption = client.encryption();

    if let Some(request) = encryption.get_verification_request(user_id, flow_id).await {
        request
            .cancel()
            .await
            .map_err(|e| AppError::Matrix(format!("Failed to cancel verification: {}", e)))?;
    } else if let Some(verification) = encryption.get_verification(user_id, flow_id).await {
        if let Some(sas) = verification.sas() {
            sas.cancel()
                .await
                .map_err(|e| AppError::Matrix(format!("Failed to cancel SAS: {}", e)))?;
        }
    }

    Ok(())
}

/// Get current verification state for a flow
pub async fn get_verification_state(
    client: &Client,
    user_id: &UserId,
    flow_id: &str,
) -> Result<VerificationState, AppError> {
    let encryption = client.encryption();

    // Check for verification request first
    if let Some(request) = encryption.get_verification_request(user_id, flow_id).await {
        let state_str = if request.is_done() {
            "done"
        } else if request.is_cancelled() {
            "cancelled"
        } else if request.is_ready() {
            "ready"
        } else {
            "requested"
        };

        return Ok(VerificationState {
            flow_id: flow_id.to_string(),
            other_user_id: user_id.to_string(),
            other_device_id: None,
            state: state_str.to_string(),
            emojis: None,
            decimals: None,
        });
    }

    // Check for active SAS verification
    if let Some(verification) = encryption.get_verification(user_id, flow_id).await {
        if let Some(sas) = verification.sas() {
            let (state_str, emojis) = if sas.is_done() {
                ("done", None)
            } else if sas.is_cancelled() {
                ("cancelled", None)
            } else if let Some(emoji_list) = sas.emoji() {
                let emojis: Vec<VerificationEmoji> = emoji_list
                    .iter()
                    .map(|e| VerificationEmoji {
                        symbol: e.symbol.to_string(),
                        description: e.description.to_string(),
                    })
                    .collect();
                ("emojis", Some(emojis))
            } else {
                ("started", None)
            };

            return Ok(VerificationState {
                flow_id: flow_id.to_string(),
                other_user_id: user_id.to_string(),
                other_device_id: None,
                state: state_str.to_string(),
                emojis,
                decimals: None,
            });
        }
    }

    Err(AppError::Matrix("Verification flow not found".into()))
}

// ----------------------------------------------------------
// Cross-signing
// ----------------------------------------------------------

/// Bootstrap cross-signing keys (initial setup)
pub async fn bootstrap_cross_signing(client: &Client) -> Result<(), AppError> {
    client
        .encryption()
        .bootstrap_cross_signing(None)
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to bootstrap cross-signing: {}", e)))?;

    Ok(())
}

/// Get cross-signing status
pub async fn get_cross_signing_status(client: &Client) -> Result<CrossSigningStatus, AppError> {
    let encryption = client.encryption();
    let status = encryption.cross_signing_status().await
        .ok_or_else(|| AppError::Matrix("Could not retrieve cross-signing status".into()))?;

    Ok(CrossSigningStatus {
        has_master: status.has_master,
        has_self_signing: status.has_self_signing,
        has_user_signing: status.has_user_signing,
        is_complete: status.has_master && status.has_self_signing && status.has_user_signing,
    })
}

/// Verify a user's identity (cross-sign them)
pub async fn verify_user_identity(
    client: &Client,
    user_id: &UserId,
) -> Result<(), AppError> {
    let own_user_id = client.user_id().ok_or(AppError::NotLoggedIn)?;
    if user_id == own_user_id {
        return Err(AppError::InvalidInput("Cannot verify your own identity this way".into()));
    }

    let encryption = client.encryption();
    let identity = encryption
        .get_user_identity(user_id)
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to get identity: {}", e)))?
        .ok_or_else(|| AppError::Matrix("User identity not found".into()))?;

    identity
        .verify()
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to verify user: {}", e)))?;

    Ok(())
}

/// Get user verification status
pub async fn get_user_verification_status(
    client: &Client,
    user_id: &UserId,
) -> Result<UserVerificationStatus, AppError> {
    let encryption = client.encryption();
    let identity = encryption
        .get_user_identity(user_id)
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to get identity: {}", e)))?;

    match identity {
        Some(identity) => {
            let is_verified = identity.is_verified();
            Ok(UserVerificationStatus {
                user_id: user_id.to_string(),
                is_verified,
                has_cross_signing_keys: true,
            })
        }
        None => Ok(UserVerificationStatus {
            user_id: user_id.to_string(),
            is_verified: false,
            has_cross_signing_keys: false,
        }),
    }
}

// ----------------------------------------------------------
// Key Backup
// ----------------------------------------------------------

/// Enable key backup (creates backup on homeserver)
pub async fn enable_key_backup(client: &Client) -> Result<(), AppError> {
    client
        .encryption()
        .backups()
        .create()
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to enable key backup: {}", e)))?;

    Ok(())
}

/// Disable key backup
pub async fn disable_key_backup(client: &Client) -> Result<(), AppError> {
    client
        .encryption()
        .backups()
        .disable()
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to disable key backup: {}", e)))?;

    Ok(())
}

/// Get key backup status
pub async fn get_key_backup_status(client: &Client) -> Result<KeyBackupStatus, AppError> {
    let backups = client.encryption().backups();
    let state = backups.state();

    let state_str = match state {
        BackupState::Unknown => "unknown",
        BackupState::Creating => "creating",
        BackupState::Enabling => "enabling",
        BackupState::Resuming => "resuming",
        BackupState::Enabled => "enabled",
        BackupState::Downloading => "downloading",
        BackupState::Disabling => "disabling",
    };

    let enabled = matches!(state, BackupState::Enabled);

    Ok(KeyBackupStatus {
        enabled,
        version: None,
        backed_up_keys: 0,
        total_keys: 0,
        state: state_str.to_string(),
    })
}

/// Wait for backup upload to steadystate  
pub async fn wait_for_backup_upload(client: &Client) -> Result<(), AppError> {
    client
        .encryption()
        .backups()
        .wait_for_steady_state()
        .await
        .map_err(|e| AppError::Matrix(format!("Backup upload wait failed: {}", e)))?;

    Ok(())
}

// ----------------------------------------------------------
// SSSS (Secure Secret Storage and Sharing)
// ----------------------------------------------------------

/// Setup SSSS with a passphrase
pub async fn setup_secret_storage(
    client: &Client,
) -> Result<String, AppError> {
    let encryption = client.encryption();
    // The recovery module handles SSSS setup and returns a recovery key
    let enable = encryption
        .recovery()
        .enable()
        .wait_for_backups_to_upload()
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to setup secret storage: {}", e)))?;

    Ok(enable)
}

/// Check if secret storage (recovery) is set up
pub async fn is_recovery_enabled(client: &Client) -> Result<bool, AppError> {
    let recovery = client.encryption().recovery();
    Ok(matches!(
        recovery.state(),
        matrix_sdk::encryption::recovery::RecoveryState::Enabled
    ))
}

/// Recover secrets from SSSS using recovery key
pub async fn recover_with_key(
    client: &Client,
    mut recovery_key: String,
) -> Result<(), AppError> {
    let recovery = client.encryption().recovery();

    recovery
        .recover(&recovery_key)
        .await
        .map_err(|e| AppError::Matrix(format!("Recovery failed: {}", e)))?;

    recovery_key.zeroize();
    Ok(())
}

/// Reset recovery (re-generates keys)
pub async fn reset_recovery(client: &Client) -> Result<String, AppError> {
    let encryption = client.encryption();
    let key = encryption
        .recovery()
        .reset_key()
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to reset recovery: {}", e)))?;

    Ok(key)
}

// ----------------------------------------------------------
// Device Management
// ----------------------------------------------------------

/// Get all devices for the current user
pub async fn get_own_devices(client: &Client) -> Result<Vec<DeviceInfo>, AppError> {
    use matrix_sdk::ruma::api::client::device::get_devices::v3::Request;

    let response = client
        .send(Request::new())
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to get devices: {}", e)))?;

    let own_device_id = client
        .device_id()
        .ok_or(AppError::NotLoggedIn)?
        .to_string();

    let encryption = client.encryption();
    let own_user_id = client.user_id().ok_or(AppError::NotLoggedIn)?;

    let mut devices = Vec::new();
    for device in response.devices {
        let device_id_str = device.device_id.to_string();
        let is_current = device_id_str == own_device_id;

        // Check verification status via encryption
        let is_verified = if let Ok(Some(crypto_device)) = encryption
            .get_device(own_user_id, &device.device_id)
            .await
        {
            crypto_device.is_verified()
        } else {
            false
        };

        devices.push(DeviceInfo {
            device_id: device_id_str,
            display_name: device.display_name,
            is_verified,
            is_current,
            last_seen_ip: device.last_seen_ip,
            last_seen_ts: device.last_seen_ts.map(|ts| ts.0.into()),
        });
    }

    // Sort: current device first, then by name
    devices.sort_by(|a, b| {
        b.is_current
            .cmp(&a.is_current)
            .then_with(|| a.display_name.cmp(&b.display_name))
    });

    Ok(devices)
}

/// Delete a device (requires re-authentication in some cases)
pub async fn delete_device(
    client: &Client,
    device_id: &str,
) -> Result<(), AppError> {
    use matrix_sdk::ruma::api::client::device::delete_device::v3::Request;

    let parsed_device_id: OwnedDeviceId = device_id.into();
    let request = Request::new(parsed_device_id);

    client
        .send(request)
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to delete device: {}", e)))?;

    Ok(())
}

/// Rename a device
pub async fn rename_device(
    client: &Client,
    device_id: &str,
    new_name: &str,
) -> Result<(), AppError> {
    use matrix_sdk::ruma::api::client::device::update_device::v3::Request;

    let parsed_device_id: OwnedDeviceId = device_id.into();
    let mut request = Request::new(parsed_device_id);
    request.display_name = Some(new_name.to_string());

    client
        .send(request)
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to rename device: {}", e)))?;

    Ok(())
}

// ----------------------------------------------------------
// Key Export / Import
// ----------------------------------------------------------

/// Export room keys encrypted with a passphrase to a temp file, return contents
pub async fn export_room_keys(
    client: &Client,
    mut passphrase: String,
) -> Result<String, AppError> {
    let encryption = client.encryption();

    // Export to a temp file (SDK requires file path)
    let export_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("pufferchat");
    std::fs::create_dir_all(&export_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create export dir: {}", e)))?;

    let export_path = export_dir.join("keys_export.tmp");

    encryption
        .export_room_keys(export_path.clone(), &passphrase, |_| true)
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to export room keys: {}", e)))?;

    // Read the exported file contents
    let contents = std::fs::read_to_string(&export_path)
        .map_err(|e| AppError::Internal(format!("Failed to read export file: {}", e)))?;

    // Clean up temp file
    let _ = std::fs::remove_file(&export_path);

    passphrase.zeroize();
    Ok(contents)
}

/// Import room keys from encrypted export data
pub async fn import_room_keys(
    client: &Client,
    data: &str,
    mut passphrase: String,
) -> Result<u64, AppError> {
    let encryption = client.encryption();

    // Write data to temp file (SDK requires file path)
    let import_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("pufferchat");
    std::fs::create_dir_all(&import_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create import dir: {}", e)))?;

    let import_path = import_dir.join("keys_import.tmp");
    std::fs::write(&import_path, data)
        .map_err(|e| AppError::Internal(format!("Failed to write import file: {}", e)))?;

    let result = encryption
        .import_room_keys(import_path.clone(), &passphrase)
        .await
        .map_err(|e| AppError::Matrix(format!("Failed to import keys: {}", e)))?;

    // Clean up temp file
    let _ = std::fs::remove_file(&import_path);

    passphrase.zeroize();
    Ok(result.total_count as u64)
}

// ----------------------------------------------------------
// Auto-lock / passphrase
// ----------------------------------------------------------

/// Encrypted passphrase for auto-lock stored in keychain
const LOCK_PASSPHRASE_KEY: &str = "lock_passphrase_hash";
const LOCK_SALT_KEY: &str = "lock_passphrase_salt";
const LOCK_ENABLED_KEY: &str = "lock_enabled";
const LOCK_TIMEOUT_KEY: &str = "lock_timeout_secs";

/// Hash a passphrase with Argon2id using the given salt
fn argon2_hash(passphrase: &[u8], salt: &[u8]) -> Result<String, AppError> {
    use argon2::{Argon2, PasswordHasher};
    use password_hash::SaltString;

    // Encode raw salt bytes as a SaltString (base64 no-pad)
    let salt_string = SaltString::encode_b64(salt)
        .map_err(|e| AppError::Internal(format!("Invalid salt: {}", e)))?;

    let argon2 = Argon2::default(); // Argon2id v19
    let hash = argon2
        .hash_password(passphrase, &salt_string)
        .map_err(|e| AppError::Internal(format!("Argon2 hashing failed: {}", e)))?;

    Ok(hash.to_string())
}

/// Verify a passphrase against an Argon2id PHC hash string
fn argon2_verify(passphrase: &[u8], phc_hash: &str) -> Result<bool, AppError> {
    use argon2::{Argon2, PasswordVerifier};
    use password_hash::PasswordHash;

    let parsed = PasswordHash::new(phc_hash)
        .map_err(|e| AppError::Internal(format!("Invalid stored hash: {}", e)))?;

    let argon2 = Argon2::default();
    Ok(argon2.verify_password(passphrase, &parsed).is_ok())
}

/// Generate a random 16-byte salt using getrandom
fn generate_salt() -> Result<[u8; 16], AppError> {
    let mut salt = [0u8; 16];
    getrandom::getrandom(&mut salt)
        .map_err(|e| AppError::Internal(format!("Failed to generate salt: {}", e)))?;
    Ok(salt)
}

/// Set up auto-lock with passphrase (Argon2id hashed)
pub fn setup_auto_lock(
    passphrase: &str,
    timeout_secs: u64,
) -> Result<(), AppError> {
    use crate::store::keychain;

    let salt = generate_salt()?;
    let hash = argon2_hash(passphrase.as_bytes(), &salt)?;

    keychain::store_secret(LOCK_PASSPHRASE_KEY, &hash)?;
    keychain::store_secret(LOCK_SALT_KEY, &hex::encode(salt))?;
    keychain::store_secret(LOCK_ENABLED_KEY, "true")?;
    keychain::store_secret(LOCK_TIMEOUT_KEY, &timeout_secs.to_string())?;

    Ok(())
}

/// Verify unlock passphrase against stored Argon2id hash
pub fn verify_lock_passphrase(passphrase: &str) -> Result<bool, AppError> {
    use crate::store::keychain;

    let stored = keychain::get_secret(LOCK_PASSPHRASE_KEY)?;
    match stored {
        Some(stored_hash) => argon2_verify(passphrase.as_bytes(), &stored_hash),
        None => Ok(false),
    }
}

/// Check if auto-lock is enabled
pub fn is_auto_lock_enabled() -> Result<bool, AppError> {
    use crate::store::keychain;
    let enabled = keychain::get_secret(LOCK_ENABLED_KEY)?;
    Ok(enabled.as_deref() == Some("true"))
}

/// Get lock timeout
pub fn get_lock_timeout() -> Result<u64, AppError> {
    use crate::store::keychain;
    let timeout = keychain::get_secret(LOCK_TIMEOUT_KEY)?;
    Ok(timeout
        .and_then(|t| t.parse().ok())
        .unwrap_or(300)) // default 5 minutes
}

/// Disable auto-lock
pub fn disable_auto_lock() -> Result<(), AppError> {
    use crate::store::keychain;
    keychain::delete_secret(LOCK_PASSPHRASE_KEY)?;
    keychain::delete_secret(LOCK_SALT_KEY)?;
    keychain::store_secret(LOCK_ENABLED_KEY, "false")?;
    keychain::delete_secret(LOCK_TIMEOUT_KEY)?;
    Ok(())
}
