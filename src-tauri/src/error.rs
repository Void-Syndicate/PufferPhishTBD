use thiserror::Error;

/// Application-level errors
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Matrix error: {0}")]
    Matrix(String),

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("Not logged in")]
    NotLoggedIn,

    #[error("Keychain error: {0}")]
    Keychain(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Room not found: {0}")]
    RoomNotFound(String),

    #[error("Event not found: {0}")]
    EventNotFound(String),
}

// Convert to string for Tauri IPC (Tauri requires serializable errors)
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<matrix_sdk::Error> for AppError {
    fn from(err: matrix_sdk::Error) -> Self {
        // Sanitize error — never leak tokens or keys in error messages
        let msg = err.to_string();
        AppError::Matrix(sanitize_error(&msg))
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(sanitize_error(&err.to_string()))
    }
}

/// Strip any potential secrets from error messages
fn sanitize_error(msg: &str) -> String {
    // Remove anything that looks like an access token
    let sanitized = regex_lite_replace(msg);
    sanitized
}

fn regex_lite_replace(msg: &str) -> String {
    // Simple heuristic: redact long base64-like strings (potential tokens)
    let mut result = String::new();
    let mut consecutive_alnum = 0;
    let mut start = 0;

    for (i, c) in msg.char_indices() {
        if c.is_alphanumeric() || c == '_' || c == '-' {
            if consecutive_alnum == 0 {
                start = i;
            }
            consecutive_alnum += 1;
        } else {
            if consecutive_alnum > 40 {
                // Likely a token — redact
                result.push_str("[REDACTED]");
            } else {
                result.push_str(&msg[start..i]);
            }
            result.push(c);
            consecutive_alnum = 0;
            start = i + c.len_utf8();
        }
    }

    // Handle trailing
    if consecutive_alnum > 40 {
        result.push_str("[REDACTED]");
    } else {
        result.push_str(&msg[start..]);
    }

    result
}
