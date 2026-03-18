/// Sync engine for Matrix client
/// Handles initial sync, incremental sync, and event dispatching to frontend
/// 
/// SECURITY NOTE: No message content is logged. Only room IDs and event types
/// are used for debugging. All content stays in the encrypted pipeline.

/// Sync state tracking
#[derive(Debug, Clone, PartialEq)]
pub enum SyncState {
    /// Not yet started
    Idle,
    /// Performing initial sync (loading all room state)
    InitialSync,
    /// Running incremental sync loop
    Syncing,
    /// Sync error — will retry
    Error(String),
    /// Stopped (logged out or disconnected)
    Stopped,
}

impl std::fmt::Display for SyncState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SyncState::Idle => write!(f, "idle"),
            SyncState::InitialSync => write!(f, "initial_sync"),
            SyncState::Syncing => write!(f, "syncing"),
            SyncState::Error(e) => write!(f, "error: {}", e),
            SyncState::Stopped => write!(f, "stopped"),
        }
    }
}
