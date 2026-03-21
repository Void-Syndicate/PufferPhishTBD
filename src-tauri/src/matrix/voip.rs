// VoIP Signaling Layer for Matrix Call Events
// Handles m.call.invite, m.call.answer, m.call.candidates, m.call.hangup
// WebRTC runs in the webview — Rust side handles Matrix signaling only.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Call state machine
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CallState {
    Idle,
    Ringing,
    Connecting,
    Connected,
    Ended,
}

impl Default for CallState {
    fn default() -> Self {
        CallState::Idle
    }
}

/// Direction of the call
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CallDirection {
    Outgoing,
    Incoming,
}

/// ICE candidate from Matrix signaling
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IceCandidate {
    pub candidate: String,
    pub sdp_mid: Option<String>,
    pub sdp_m_line_index: Option<u32>,
}

/// Active call info tracked by the backend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallInfo {
    pub call_id: String,
    pub room_id: String,
    pub state: CallState,
    pub direction: CallDirection,
    pub peer_user_id: String,
    pub peer_display_name: Option<String>,
    pub started_at: Option<i64>,
    pub ended_at: Option<i64>,
    pub is_video: bool,
    pub party_id: String,
}

/// Call history entry stored locally
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallHistoryEntry {
    pub call_id: String,
    pub room_id: String,
    pub peer_user_id: String,
    pub peer_display_name: Option<String>,
    pub direction: CallDirection,
    pub is_video: bool,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration_secs: Option<u64>,
    pub was_missed: bool,
}

/// Global VoIP state shared across commands
pub struct VoipState {
    pub active_calls: HashMap<String, CallInfo>,
    pub call_history: Vec<CallHistoryEntry>,
}

impl VoipState {
    pub fn new() -> Self {
        Self {
            active_calls: HashMap::new(),
            call_history: Vec::new(),
        }
    }

    /// Get current active call for a room (if any)
    pub fn get_call_for_room(&self, room_id: &str) -> Option<&CallInfo> {
        self.active_calls.values().find(|c| c.room_id == room_id && c.state != CallState::Ended)
    }

    /// Get active call by call_id
    pub fn get_call(&self, call_id: &str) -> Option<&CallInfo> {
        self.active_calls.get(call_id)
    }

    /// Get mutable active call by call_id
    pub fn get_call_mut(&mut self, call_id: &str) -> Option<&mut CallInfo> {
        self.active_calls.get_mut(call_id)
    }

    /// Create a new outgoing call
    pub fn create_outgoing_call(
        &mut self,
        call_id: String,
        room_id: String,
        peer_user_id: String,
        peer_display_name: Option<String>,
        is_video: bool,
        party_id: String,
    ) -> CallInfo {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let info = CallInfo {
            call_id: call_id.clone(),
            room_id,
            state: CallState::Ringing,
            direction: CallDirection::Outgoing,
            peer_user_id,
            peer_display_name,
            started_at: Some(now),
            ended_at: None,
            is_video,
            party_id,
        };
        self.active_calls.insert(call_id, info.clone());
        info
    }

    /// Register an incoming call
    pub fn register_incoming_call(
        &mut self,
        call_id: String,
        room_id: String,
        peer_user_id: String,
        peer_display_name: Option<String>,
        is_video: bool,
        party_id: String,
    ) -> CallInfo {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let info = CallInfo {
            call_id: call_id.clone(),
            room_id,
            state: CallState::Ringing,
            direction: CallDirection::Incoming,
            peer_user_id,
            peer_display_name,
            started_at: Some(now),
            ended_at: None,
            is_video,
            party_id,
        };
        self.active_calls.insert(call_id, info.clone());
        info
    }

    /// Transition call to connecting
    pub fn set_connecting(&mut self, call_id: &str) -> Option<CallInfo> {
        if let Some(call) = self.active_calls.get_mut(call_id) {
            call.state = CallState::Connecting;
            Some(call.clone())
        } else {
            None
        }
    }

    /// Transition call to connected
    pub fn set_connected(&mut self, call_id: &str) -> Option<CallInfo> {
        if let Some(call) = self.active_calls.get_mut(call_id) {
            call.state = CallState::Connected;
            Some(call.clone())
        } else {
            None
        }
    }

    /// End a call and add to history
    pub fn end_call(&mut self, call_id: &str, was_missed: bool) -> Option<CallInfo> {
        if let Some(call) = self.active_calls.get_mut(call_id) {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;

            call.state = CallState::Ended;
            call.ended_at = Some(now);

            let duration_secs = call.started_at.map(|s| ((now - s) / 1000) as u64);

            let history_entry = CallHistoryEntry {
                call_id: call.call_id.clone(),
                room_id: call.room_id.clone(),
                peer_user_id: call.peer_user_id.clone(),
                peer_display_name: call.peer_display_name.clone(),
                direction: call.direction.clone(),
                is_video: call.is_video,
                started_at: call.started_at.unwrap_or(now),
                ended_at: Some(now),
                duration_secs,
                was_missed,
            };
            self.call_history.push(history_entry);

            // Keep history bounded
            if self.call_history.len() > 500 {
                self.call_history.drain(0..100);
            }

            Some(call.clone())
        } else {
            None
        }
    }

    /// Clean up ended calls from active map
    pub fn cleanup_ended(&mut self) {
        self.active_calls.retain(|_, c| c.state != CallState::Ended);
    }

    /// Get all call history
    pub fn get_history(&self) -> Vec<CallHistoryEntry> {
        self.call_history.clone()
    }
}

/// Tauri event payloads for call events emitted from sync
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallInviteEvent {
    pub room_id: String,
    pub call_id: String,
    pub sender: String,
    pub sender_display_name: Option<String>,
    pub sdp: String,
    pub is_video: bool,
    pub lifetime_ms: u64,
    pub party_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallAnswerEvent {
    pub room_id: String,
    pub call_id: String,
    pub sender: String,
    pub sdp: String,
    pub party_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallCandidatesEvent {
    pub room_id: String,
    pub call_id: String,
    pub sender: String,
    pub candidates: Vec<IceCandidate>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallHangupEvent {
    pub room_id: String,
    pub call_id: String,
    pub sender: String,
    pub reason: Option<String>,
}

/// Payload for sending call invite via Matrix room event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallInviteContent {
    pub call_id: String,
    pub party_id: String,
    pub offer: SdpContent,
    pub version: u32,
    pub lifetime: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SdpContent {
    #[serde(rename = "type")]
    pub sdp_type: String,
    pub sdp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallAnswerContent {
    pub call_id: String,
    pub party_id: String,
    pub answer: SdpContent,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallCandidatesContent {
    pub call_id: String,
    pub party_id: String,
    pub candidates: Vec<IceCandidate>,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallHangupContent {
    pub call_id: String,
    pub party_id: String,
    pub version: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// Generate a unique call ID
pub fn generate_call_id() -> String {
    let mut bytes = [0u8; 16];
    getrandom::getrandom(&mut bytes).unwrap_or_default();
    hex::encode(bytes)
}

/// Generate a party ID (device identifier for call)
pub fn generate_party_id() -> String {
    let mut bytes = [0u8; 8];
    getrandom::getrandom(&mut bytes).unwrap_or_default();
    hex::encode(bytes)
}

/// Get call history file path
fn history_path() -> Option<std::path::PathBuf> {
    dirs::data_dir().map(|d| d.join("pufferchat").join("call_history.json"))
}

/// Save call history to disk
pub fn save_history(history: &[CallHistoryEntry]) {
    if let Some(path) = history_path() {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        if let Ok(json) = serde_json::to_string(history) {
            std::fs::write(&path, json).ok();
        }
    }
}

/// Load call history from disk
pub fn load_history() -> Vec<CallHistoryEntry> {
    if let Some(path) = history_path() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(history) = serde_json::from_str::<Vec<CallHistoryEntry>>(&data) {
                return history;
            }
        }
    }
    Vec::new()
}
