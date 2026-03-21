/// Phase 8: Privacy, Proxy, Certificate Pinning, DoH, Settings Migration,
/// Multi-Account, SSO, Integrity, and Security Hardening commands.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use crate::error::AppError;

// ===================================================================
// Proxy Configuration
// ===================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
    pub proxy_type: String, // "none", "socks5", "http"
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub enabled: bool,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            proxy_type: "none".into(),
            host: String::new(),
            port: 1080,
            username: None,
            password: None,
            enabled: false,
        }
    }
}

// ===================================================================
// Certificate Pinning (TOFU)
// ===================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinnedCertificate {
    pub host: String,
    pub fingerprint_sha256: String,
    pub subject: String,
    pub issuer: String,
    pub not_after: String,
    pub pinned_at: u64,
    pub auto_pinned: bool,
}

// ===================================================================
// DoH Configuration
// ===================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DohConfig {
    pub enabled: bool,
    pub provider: String, // "cloudflare", "google", "custom"
    pub custom_url: Option<String>,
}

impl Default for DohConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: "cloudflare".into(),
            custom_url: None,
        }
    }
}

// ===================================================================
// Settings Export/Import
// ===================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportedSettings {
    pub version: u32,
    pub exported_at: u64,
    pub app_version: String,
    pub proxy: ProxyConfig,
    pub doh: DohConfig,
    pub pinned_certs: Vec<PinnedCertificate>,
    pub general: serde_json::Value,
}

// ===================================================================
// Multi-Account
// ===================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub user_id: String,
    pub homeserver: String,
    pub display_name: Option<String>,
    pub device_id: String,
    pub is_active: bool,
    pub avatar_url: Option<String>,
}

// ===================================================================
// Integrity Check
// ===================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityReport {
    pub database_ok: bool,
    pub crypto_keys_ok: bool,
    pub config_ok: bool,
    pub issues: Vec<String>,
    pub checked_at: u64,
}

// ===================================================================
// SSO/OIDC
// ===================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SsoProvider {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub brand: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SsoLoginUrl {
    pub url: String,
    pub redirect_url: String,
}

// ===================================================================
// Config file helpers
// ===================================================================

fn config_dir() -> Result<PathBuf, AppError> {
    let base = dirs::config_dir()
        .ok_or_else(|| AppError::Internal("Cannot determine config directory".into()))?;
    let dir = base.join("pufferchat");
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::Internal(format!("Failed to create config dir: {}", e)))?;
    Ok(dir)
}

fn data_dir() -> Result<PathBuf, AppError> {
    let base = dirs::data_dir()
        .ok_or_else(|| AppError::Internal("Cannot determine data directory".into()))?;
    let dir = base.join("pufferchat");
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::Internal(format!("Failed to create data dir: {}", e)))?;
    Ok(dir)
}

fn read_json_config<T: serde::de::DeserializeOwned + Default>(filename: &str) -> Result<T, AppError> {
    let path = config_dir()?.join(filename);
    if !path.exists() {
        return Ok(T::default());
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| AppError::Internal(format!("Failed to read {}: {}", filename, e)))?;
    serde_json::from_str(&data)
        .map_err(|e| AppError::Internal(format!("Failed to parse {}: {}", filename, e)))
}

fn write_json_config<T: Serialize>(filename: &str, value: &T) -> Result<(), AppError> {
    let path = config_dir()?.join(filename);
    let data = serde_json::to_string_pretty(value)
        .map_err(|e| AppError::Internal(format!("Failed to serialize config: {}", e)))?;
    std::fs::write(&path, data)
        .map_err(|e| AppError::Internal(format!("Failed to write {}: {}", filename, e)))?;
    Ok(())
}

// ===================================================================
// Proxy Config Commands
// ===================================================================

pub fn get_proxy_config_impl() -> Result<ProxyConfig, AppError> {
    read_json_config("proxy.json")
}

pub fn set_proxy_config_impl(config: ProxyConfig) -> Result<(), AppError> {
    // Validate
    if config.proxy_type != "none" && config.proxy_type != "socks5" && config.proxy_type != "http" {
        return Err(AppError::InvalidInput("Invalid proxy type. Use 'none', 'socks5', or 'http'".into()));
    }
    if config.proxy_type != "none" {
        if config.host.is_empty() {
            return Err(AppError::InvalidInput("Proxy host is required".into()));
        }
        if config.port == 0 {
            return Err(AppError::InvalidInput("Proxy port must be > 0".into()));
        }
        // Validate host doesn't contain dangerous characters
        if config.host.contains(';') || config.host.contains('&') || config.host.contains('|') {
            return Err(AppError::InvalidInput("Invalid characters in proxy host".into()));
        }
    }
    write_json_config("proxy.json", &config)?;
    log::info!("Proxy configuration updated: type={}", config.proxy_type);
    Ok(())
}

pub fn test_proxy_connection_impl(config: &ProxyConfig) -> Result<bool, AppError> {
    if config.proxy_type == "none" {
        return Ok(true);
    }
    // Build a test client with the proxy to verify connectivity
    let proxy_url = match config.proxy_type.as_str() {
        "socks5" => {
            if let (Some(user), Some(pass)) = (&config.username, &config.password) {
                format!("socks5://{}:{}@{}:{}", user, pass, config.host, config.port)
            } else {
                format!("socks5://{}:{}", config.host, config.port)
            }
        }
        "http" => {
            if let (Some(user), Some(pass)) = (&config.username, &config.password) {
                format!("http://{}:{}@{}:{}", user, pass, config.host, config.port)
            } else {
                format!("http://{}:{}", config.host, config.port)
            }
        }
        _ => return Ok(true),
    };

    let rt = tokio::runtime::Handle::try_current();
    match rt {
        Ok(handle) => {
            // We're in an async context, but we can spawn a blocking task
            let proxy_url_clone = proxy_url.clone();
            let result = std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    let proxy = reqwest::Proxy::all(&proxy_url_clone)
                        .map_err(|e| AppError::Internal(format!("Invalid proxy URL: {}", e)))?;
                    let client = reqwest::Client::builder()
                        .proxy(proxy)
                        .timeout(std::time::Duration::from_secs(10))
                        .build()
                        .map_err(|e| AppError::Internal(format!("Failed to build proxy client: {}", e)))?;
                    match client.get("https://matrix.org/.well-known/matrix/client").send().await {
                        Ok(resp) => Ok(resp.status().is_success() || resp.status().as_u16() == 404),
                        Err(e) => {
                            log::warn!("Proxy test failed: {}", e);
                            Ok(false)
                        }
                    }
                })
            }).join().map_err(|_| AppError::Internal("Proxy test thread panicked".into()))?;
            result
        }
        Err(_) => Ok(false),
    }
}

// ===================================================================
// Certificate Pinning Commands
// ===================================================================

fn load_pinned_certs() -> Result<Vec<PinnedCertificate>, AppError> {
    let path = config_dir()?.join("pinned_certs.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| AppError::Internal(format!("Failed to read pinned certs: {}", e)))?;
    serde_json::from_str(&data)
        .map_err(|e| AppError::Internal(format!("Failed to parse pinned certs: {}", e)))
}

fn save_pinned_certs(certs: &[PinnedCertificate]) -> Result<(), AppError> {
    write_json_config("pinned_certs.json", &certs.to_vec())
}

pub fn pin_certificate_impl(cert: PinnedCertificate) -> Result<(), AppError> {
    if cert.host.is_empty() {
        return Err(AppError::InvalidInput("Certificate host is required".into()));
    }
    if cert.fingerprint_sha256.is_empty() {
        return Err(AppError::InvalidInput("Certificate fingerprint is required".into()));
    }
    // Validate fingerprint format (hex with colons)
    let clean = cert.fingerprint_sha256.replace(':', "");
    if clean.len() != 64 || !clean.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::InvalidInput("Invalid SHA-256 fingerprint format".into()));
    }
    let mut certs = load_pinned_certs()?;
    // Replace existing pin for this host or add new
    certs.retain(|c| c.host != cert.host);
    certs.push(cert.clone());
    save_pinned_certs(&certs)?;
    log::info!("Certificate pinned for host: {}", cert.host);
    Ok(())
}

pub fn get_pinned_certs_impl() -> Result<Vec<PinnedCertificate>, AppError> {
    load_pinned_certs()
}

pub fn remove_pinned_cert_impl(host: String) -> Result<(), AppError> {
    if host.is_empty() {
        return Err(AppError::InvalidInput("Host is required".into()));
    }
    let mut certs = load_pinned_certs()?;
    let before = certs.len();
    certs.retain(|c| c.host != host);
    if certs.len() == before {
        return Err(AppError::InvalidInput(format!("No pinned certificate found for host: {}", host)));
    }
    save_pinned_certs(&certs)?;
    log::info!("Certificate pin removed for host: {}", host);
    Ok(())
}

// ===================================================================
// DoH Configuration Commands
// ===================================================================

pub fn get_doh_config_impl() -> Result<DohConfig, AppError> {
    read_json_config("doh.json")
}

pub fn set_doh_config_impl(config: DohConfig) -> Result<(), AppError> {
    match config.provider.as_str() {
        "cloudflare" | "google" | "custom" | "disabled" => {}
        _ => return Err(AppError::InvalidInput("Invalid DoH provider. Use 'cloudflare', 'google', 'custom', or 'disabled'".into())),
    }
    if config.provider == "custom" {
        if let Some(ref url) = config.custom_url {
            if !url.starts_with("https://") {
                return Err(AppError::InvalidInput("Custom DoH URL must use HTTPS".into()));
            }
        } else {
            return Err(AppError::InvalidInput("Custom DoH URL is required when provider is 'custom'".into()));
        }
    }
    write_json_config("doh.json", &config)?;
    log::info!("DoH configuration updated: provider={}", config.provider);
    Ok(())
}

// ===================================================================
// Settings Export/Import Commands
// ===================================================================

pub fn export_settings_impl(file_path: String) -> Result<(), AppError> {
    if file_path.is_empty() {
        return Err(AppError::InvalidInput("Export file path is required".into()));
    }
    let proxy = get_proxy_config_impl().unwrap_or_default();
    let doh = get_doh_config_impl().unwrap_or_default();
    let pinned_certs = get_pinned_certs_impl().unwrap_or_default();

    // Read general settings from localStorage backup
    let general_path = config_dir()?.join("general_settings.json");
    let general: serde_json::Value = if general_path.exists() {
        let data = std::fs::read_to_string(&general_path).unwrap_or_else(|_| "{}".into());
        serde_json::from_str(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let exported = ExportedSettings {
        version: 1,
        exported_at: now,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        proxy,
        doh,
        pinned_certs,
        general,
    };

    let json = serde_json::to_string_pretty(&exported)
        .map_err(|e| AppError::Internal(format!("Failed to serialize settings: {}", e)))?;
    std::fs::write(&file_path, json)
        .map_err(|e| AppError::Internal(format!("Failed to write export file: {}", e)))?;
    log::info!("Settings exported to: {}", file_path);
    Ok(())
}

pub fn import_settings_impl(file_path: String) -> Result<(), AppError> {
    if file_path.is_empty() {
        return Err(AppError::InvalidInput("Import file path is required".into()));
    }
    let data = std::fs::read_to_string(&file_path)
        .map_err(|e| AppError::Internal(format!("Failed to read import file: {}", e)))?;
    let imported: ExportedSettings = serde_json::from_str(&data)
        .map_err(|e| AppError::InvalidInput(format!("Invalid settings file: {}", e)))?;

    // Version check
    if imported.version > 1 {
        return Err(AppError::InvalidInput(
            "Settings file is from a newer version. Please update PufferChat first.".into()
        ));
    }

    // Apply settings
    set_proxy_config_impl(imported.proxy)?;
    set_doh_config_impl(imported.doh)?;
    for cert in imported.pinned_certs {
        pin_certificate_impl(cert).ok(); // Skip invalid certs
    }

    // Save general settings
    let general_path = config_dir()?.join("general_settings.json");
    let general_json = serde_json::to_string_pretty(&imported.general)
        .unwrap_or_else(|_| "{}".into());
    std::fs::write(&general_path, general_json).ok();

    log::info!("Settings imported from: {}", file_path);
    Ok(())
}

// ===================================================================
// Multi-Account Commands
// ===================================================================

fn accounts_path() -> Result<PathBuf, AppError> {
    Ok(config_dir()?.join("accounts.json"))
}

fn load_accounts() -> Result<Vec<AccountInfo>, AppError> {
    let path = accounts_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| AppError::Internal(format!("Failed to read accounts: {}", e)))?;
    serde_json::from_str(&data)
        .map_err(|e| AppError::Internal(format!("Failed to parse accounts: {}", e)))
}

fn save_accounts(accounts: &[AccountInfo]) -> Result<(), AppError> {
    let path = accounts_path()?;
    let data = serde_json::to_string_pretty(accounts)
        .map_err(|e| AppError::Internal(format!("Failed to serialize accounts: {}", e)))?;
    std::fs::write(&path, data)
        .map_err(|e| AppError::Internal(format!("Failed to write accounts: {}", e)))?;
    Ok(())
}

pub fn add_account_impl(account: AccountInfo) -> Result<(), AppError> {
    if account.user_id.is_empty() {
        return Err(AppError::InvalidInput("User ID is required".into()));
    }
    if account.homeserver.is_empty() {
        return Err(AppError::InvalidInput("Homeserver is required".into()));
    }
    let mut accounts = load_accounts()?;
    if accounts.iter().any(|a| a.user_id == account.user_id) {
        return Err(AppError::InvalidInput(format!("Account {} already exists", account.user_id)));
    }
    accounts.push(account);
    save_accounts(&accounts)?;
    log::info!("Account added");
    Ok(())
}

pub fn remove_account_impl(user_id: String) -> Result<(), AppError> {
    if user_id.is_empty() {
        return Err(AppError::InvalidInput("User ID is required".into()));
    }
    let mut accounts = load_accounts()?;
    let before = accounts.len();
    accounts.retain(|a| a.user_id != user_id);
    if accounts.len() == before {
        return Err(AppError::InvalidInput(format!("Account {} not found", user_id)));
    }
    save_accounts(&accounts)?;
    log::info!("Account removed: {}", user_id);
    Ok(())
}

pub fn switch_account_impl(user_id: String) -> Result<AccountInfo, AppError> {
    if user_id.is_empty() {
        return Err(AppError::InvalidInput("User ID is required".into()));
    }
    let mut accounts = load_accounts()?;
    let mut found = false;
    for account in accounts.iter_mut() {
        if account.user_id == user_id {
            account.is_active = true;
            found = true;
        } else {
            account.is_active = false;
        }
    }
    if !found {
        return Err(AppError::InvalidInput(format!("Account {} not found", user_id)));
    }
    save_accounts(&accounts)?;
    let active = accounts.into_iter().find(|a| a.user_id == user_id).unwrap();
    log::info!("Switched to account: {}", user_id);
    Ok(active)
}

pub fn list_accounts_impl() -> Result<Vec<AccountInfo>, AppError> {
    load_accounts()
}

// ===================================================================
// SSO/OIDC Commands
// ===================================================================

pub async fn get_sso_providers_impl(homeserver: &str) -> Result<Vec<SsoProvider>, AppError> {
    if homeserver.is_empty() {
        return Err(AppError::InvalidInput("Homeserver URL is required".into()));
    }
    let url = format!("{}/_matrix/client/v3/login", homeserver.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let response = client.get(&url).send().await
        .map_err(|e| AppError::Matrix(format!("Failed to query login flows: {}", e)))?;
    let body: serde_json::Value = response.json().await
        .map_err(|e| AppError::Matrix(format!("Failed to parse login flows: {}", e)))?;

    let mut providers = Vec::new();
    if let Some(flows) = body.get("flows").and_then(|f| f.as_array()) {
        for flow in flows {
            if flow.get("type").and_then(|t| t.as_str()) == Some("m.login.sso") {
                if let Some(idps) = flow.get("identity_providers").and_then(|i| i.as_array()) {
                    for idp in idps {
                        providers.push(SsoProvider {
                            id: idp.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            name: idp.get("name").and_then(|v| v.as_str()).unwrap_or("SSO").to_string(),
                            icon: idp.get("icon").and_then(|v| v.as_str()).map(|s| s.to_string()),
                            brand: idp.get("brand").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        });
                    }
                }
                if providers.is_empty() {
                    providers.push(SsoProvider {
                        id: "default".into(),
                        name: "Single Sign-On".into(),
                        icon: None,
                        brand: None,
                    });
                }
            }
        }
    }
    Ok(providers)
}

pub fn get_sso_login_url_impl(homeserver: &str, provider_id: &str, redirect_url: &str) -> Result<SsoLoginUrl, AppError> {
    if homeserver.is_empty() {
        return Err(AppError::InvalidInput("Homeserver URL is required".into()));
    }
    let hs = homeserver.trim_end_matches('/');
    let encoded_redirect = urlencoding::encode(redirect_url);
    let url = if provider_id == "default" || provider_id.is_empty() {
        format!("{}/_matrix/client/v3/login/sso/redirect?redirectUrl={}", hs, encoded_redirect)
    } else {
        format!("{}/_matrix/client/v3/login/sso/redirect/{}?redirectUrl={}", hs, provider_id, encoded_redirect)
    };
    Ok(SsoLoginUrl {
        url,
        redirect_url: redirect_url.to_string(),
    })
}

// ===================================================================
// Integrity Check Commands
// ===================================================================

pub fn check_integrity_impl() -> Result<IntegrityReport, AppError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let mut issues = Vec::new();
    let mut database_ok = true;
    let mut crypto_keys_ok = true;
    let mut config_ok = true;

    // Check database directory exists
    let db_dir = data_dir()?.join("matrix-store");
    if !db_dir.exists() {
        issues.push("Matrix store directory not found".into());
        database_ok = false;
    } else {
        // Check for SQLite files
        let has_db = std::fs::read_dir(&db_dir)
            .map(|entries| entries.filter_map(|e| e.ok()).any(|e| {
                e.path().extension().map(|ext| ext == "sqlite" || ext == "db").unwrap_or(false)
                    || e.file_name().to_string_lossy().contains("matrix")
            }))
            .unwrap_or(false);
        if !has_db {
            // Not necessarily an error - might be first launch
            issues.push("No database files found (may be first launch)".into());
        }
    }

    // Check crypto key storage (keychain access)
    match crate::store::keychain::get_secret("db_passphrase") {
        Ok(Some(_)) => {}
        Ok(None) => {
            issues.push("Database passphrase not found in keychain".into());
            crypto_keys_ok = false;
        }
        Err(e) => {
            issues.push(format!("Keychain access error: {}", e));
            crypto_keys_ok = false;
        }
    }

    // Check config directory
    if let Ok(dir) = config_dir() {
        if !dir.exists() {
            issues.push("Config directory not found".into());
            config_ok = false;
        }
    } else {
        issues.push("Cannot determine config directory".into());
        config_ok = false;
    }

    Ok(IntegrityReport {
        database_ok,
        crypto_keys_ok,
        config_ok,
        issues,
        checked_at: now,
    })
}

pub fn repair_database_impl() -> Result<bool, AppError> {
    // Attempt to repair by clearing potentially corrupted cache
    let cache_dir = dirs::cache_dir()
        .ok_or_else(|| AppError::Internal("Cannot determine cache directory".into()))?
        .join("pufferchat");

    if cache_dir.exists() {
        // Only clear cache, not the main store
        let media_cache = cache_dir.join("media");
        if media_cache.exists() {
            std::fs::remove_dir_all(&media_cache).ok();
            std::fs::create_dir_all(&media_cache).ok();
        }
    }

    // Verify database can be accessed after repair
    let report = check_integrity_impl()?;
    log::info!("Database repair attempted. Status: db={}, crypto={}, config={}",
        report.database_ok, report.crypto_keys_ok, report.config_ok);
    Ok(report.database_ok && report.crypto_keys_ok)
}

// ===================================================================
// Draft Persistence
// ===================================================================

pub fn save_draft_impl(room_id: &str, draft: &str) -> Result<(), AppError> {
    if room_id.is_empty() {
        return Err(AppError::InvalidInput("Room ID is required".into()));
    }
    let drafts_path = config_dir()?.join("drafts.json");
    let mut drafts: HashMap<String, String> = if drafts_path.exists() {
        let data = std::fs::read_to_string(&drafts_path).unwrap_or_else(|_| "{}".into());
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        HashMap::new()
    };

    if draft.is_empty() {
        drafts.remove(room_id);
    } else {
        drafts.insert(room_id.to_string(), draft.to_string());
    }

    let json = serde_json::to_string(&drafts)
        .map_err(|e| AppError::Internal(format!("Failed to serialize drafts: {}", e)))?;
    std::fs::write(&drafts_path, json)
        .map_err(|e| AppError::Internal(format!("Failed to write drafts: {}", e)))?;
    Ok(())
}

pub fn get_draft_impl(room_id: &str) -> Result<Option<String>, AppError> {
    if room_id.is_empty() {
        return Err(AppError::InvalidInput("Room ID is required".into()));
    }
    let drafts_path = config_dir()?.join("drafts.json");
    if !drafts_path.exists() {
        return Ok(None);
    }
    let data = std::fs::read_to_string(&drafts_path).unwrap_or_else(|_| "{}".into());
    let drafts: HashMap<String, String> = serde_json::from_str(&data).unwrap_or_default();
    Ok(drafts.get(room_id).cloned())
}

pub fn get_all_drafts_impl() -> Result<HashMap<String, String>, AppError> {
    let drafts_path = config_dir()?.join("drafts.json");
    if !drafts_path.exists() {
        return Ok(HashMap::new());
    }
    let data = std::fs::read_to_string(&drafts_path).unwrap_or_else(|_| "{}".into());
    let drafts: HashMap<String, String> = serde_json::from_str(&data).unwrap_or_default();
    Ok(drafts)
}

// ===================================================================
// Rate Limiting
// ===================================================================

use std::sync::Mutex;
use std::time::Instant;

lazy_static::lazy_static! {
    static ref AUTH_ATTEMPTS: Mutex<Vec<Instant>> = Mutex::new(Vec::new());
}

pub fn check_rate_limit() -> Result<(), AppError> {
    let mut attempts = AUTH_ATTEMPTS.lock()
        .map_err(|_| AppError::Internal("Rate limiter lock poisoned".into()))?;

    // Remove attempts older than 5 minutes
    let cutoff = Instant::now() - std::time::Duration::from_secs(300);
    attempts.retain(|&t| t > cutoff);

    // Max 10 attempts per 5 minutes
    if attempts.len() >= 10 {
        return Err(AppError::Auth(
            "Too many login attempts. Please wait 5 minutes before trying again.".into()
        ));
    }

    attempts.push(Instant::now());
    Ok(())
}
