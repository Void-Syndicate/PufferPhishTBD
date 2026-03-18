use matrix_sdk::{
    config::SyncSettings,
    room::Room,
    ruma::{
        api::client::receipt::create_receipt::v3::ReceiptType,
        events::{
            reaction::ReactionEventContent,
            receipt::ReceiptThread,
            relation::Annotation,
            room::message::{
                MessageType, OriginalSyncRoomMessageEvent,
                Relation, RoomMessageEventContent,
            },
            AnyMessageLikeEvent, AnyTimelineEvent, MessageLikeEvent,
        },
        OwnedEventId, OwnedRoomId, OwnedUserId, RoomId, UInt,
    },
    Client, SessionMeta,
};
use tauri::Emitter;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use zeroize::Zeroize;

use crate::error::AppError;

/// Wrapper around matrix-sdk Client
pub struct MatrixClient {
    client: Client,
    user_id: OwnedUserId,
}

#[derive(Serialize, Clone)]
pub struct LoginResult {
    pub user_id: String,
    pub display_name: Option<String>,
    pub device_id: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct RoomSummary {
    pub room_id: String,
    pub name: Option<String>,
    pub topic: Option<String>,
    pub avatar_url: Option<String>,
    pub is_direct: bool,
    pub is_encrypted: bool,
    pub unread_count: u64,
    pub highlight_count: u64,
    pub last_message: Option<String>,
    pub last_message_timestamp: Option<i64>,
    pub member_count: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TimelineMessage {
    pub id: String,
    pub sender: String,
    pub body: String,
    pub formatted_body: Option<String>,
    pub timestamp: i64,
    pub is_edited: bool,
    pub reply_to: Option<String>,
    pub reactions: HashMap<String, Vec<String>>,
    pub msg_type: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RoomMember {
    pub user_id: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub power_level: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct PaginationResult {
    pub messages: Vec<TimelineMessage>,
    pub end_token: Option<String>,
    pub has_more: bool,
}

/// Tauri event payloads
#[derive(Serialize, Clone, Debug)]
pub struct TimelineEvent {
    pub room_id: String,
    pub message: TimelineMessage,
}

#[derive(Serialize, Clone, Debug)]
pub struct TypingEvent {
    pub room_id: String,
    pub user_ids: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ReadReceiptEvent {
    pub room_id: String,
    pub user_id: String,
    pub event_id: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct RoomUpdateEvent {
    pub room: RoomSummary,
}

/// Validate room_id format
fn validate_room_id(room_id: &str) -> Result<OwnedRoomId, AppError> {
    if room_id.is_empty() {
        return Err(AppError::InvalidInput("Room ID is required".into()));
    }
    let parsed: OwnedRoomId = room_id
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid room ID format".into()))?;
    Ok(parsed)
}

/// Validate event_id format
fn validate_event_id(event_id: &str) -> Result<OwnedEventId, AppError> {
    if event_id.is_empty() {
        return Err(AppError::InvalidInput("Event ID is required".into()));
    }
    let parsed: OwnedEventId = event_id
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid event ID format".into()))?;
    Ok(parsed)
}

impl MatrixClient {
    /// Create a new Matrix client and log in with password
    pub async fn login(
        homeserver: &str,
        username: &str,
        mut password: String,
    ) -> Result<(Self, LoginResult, String), AppError> {
        let data_dir = get_data_dir();
        let db_passphrase = get_or_create_db_passphrase()?;

        let client = Client::builder()
            .homeserver_url(homeserver)
            .sqlite_store(&data_dir, Some(&db_passphrase))
            .build()
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        let response = client
            .matrix_auth()
            .login_username(username, &password)
            .initial_device_display_name("PufferChat")
            .await
            .map_err(|e| AppError::Auth(e.to_string()))?;

        password.zeroize();

        let user_id = response.user_id.clone();

        let display_name = client
            .account()
            .get_display_name()
            .await
            .ok()
            .flatten()
            .map(|n| n.to_string());

        let access_token_str = response.access_token.to_string();
        let device_id_str = response.device_id.to_string();

        let result = LoginResult {
            user_id: user_id.to_string(),
            display_name,
            device_id: device_id_str.clone(),
        };

        let matrix_client = Self { client, user_id };

        Ok((matrix_client, result, access_token_str))
    }

    /// Restore session from stored access token
    pub async fn restore(
        homeserver: &str,
        access_token: &str,
        user_id: &str,
        device_id: &str,
    ) -> Result<Self, AppError> {
        let data_dir = get_data_dir();
        let db_passphrase = get_or_create_db_passphrase()?;

        let client = Client::builder()
            .homeserver_url(homeserver)
            .sqlite_store(&data_dir, Some(&db_passphrase))
            .build()
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        let parsed_user_id: OwnedUserId = user_id
            .try_into()
            .map_err(|e: matrix_sdk::ruma::IdParseError| AppError::Auth(e.to_string()))?;
        let parsed_device_id: matrix_sdk::ruma::OwnedDeviceId = device_id.into();

        let session = matrix_sdk::authentication::matrix::MatrixSession {
            meta: SessionMeta {
                user_id: parsed_user_id,
                device_id: parsed_device_id,
            },
            tokens: matrix_sdk::authentication::matrix::MatrixSessionTokens {
                access_token: access_token.to_string(),
                refresh_token: None,
            },
        };

        client
            .matrix_auth()
            .restore_session(session)
            .await
            .map_err(|e| AppError::Auth(e.to_string()))?;

        let user_id = client.user_id().ok_or(AppError::NotLoggedIn)?.to_owned();

        Ok(Self { client, user_id })
    }

    /// Get inner client reference
    pub fn inner(&self) -> &Client {
        &self.client
    }

    /// Start the sync loop with Tauri event emission
    pub async fn start_sync_with_events(
        &self,
        app_handle: tauri::AppHandle,
    ) -> Result<(), AppError> {
        let settings = SyncSettings::default();
        let client = self.client.clone();

        // Timeline message handler
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: OriginalSyncRoomMessageEvent, room: Room| {
                let handle = handle_clone.clone();
                async move {
                    let room_id = room.room_id().to_string();
                    let msg = timeline_message_from_sync_event(&event);
                    let payload = TimelineEvent {
                        room_id,
                        message: msg,
                    };
                    if let Err(e) = handle.emit("matrix://timeline", &payload) {
                        log::error!("Failed to emit timeline event: {}", e);
                    }
                }
            },
        );

        // Typing indicators
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::typing::SyncTypingEvent, room: Room| {
                let handle = handle_clone.clone();
                async move {
                    let room_id = room.room_id().to_string();
                    let user_ids: Vec<String> =
                        event.content.user_ids.iter().map(|u| u.to_string()).collect();
                    let payload = TypingEvent { room_id, user_ids };
                    if let Err(e) = handle.emit("matrix://typing", &payload) {
                        log::error!("Failed to emit typing event: {}", e);
                    }
                }
            },
        );

        // Read receipts
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::receipt::SyncReceiptEvent, room: Room| {
                let handle = handle_clone.clone();
                async move {
                    let room_id = room.room_id().to_string();
                    for (event_id, receipts) in &event.content.0 {
                        if let Some(read_receipts) = receipts
                            .get(&matrix_sdk::ruma::events::receipt::ReceiptType::Read)
                        {
                            for (user_id, _receipt) in read_receipts {
                                let payload = ReadReceiptEvent {
                                    room_id: room_id.clone(),
                                    user_id: user_id.to_string(),
                                    event_id: event_id.to_string(),
                                };
                                if let Err(e) = handle.emit("matrix://read-receipt", &payload) {
                                    log::error!("Failed to emit read receipt event: {}", e);
                                }
                            }
                        }
                    }
                }
            },
        );

        // Spawn sync loop
        tokio::spawn(async move {
            loop {
                match client.sync_once(settings.clone()).await {
                    Ok(_response) => {
                        log::debug!("Sync completed successfully");
                    }
                    Err(e) => {
                        log::error!("Sync error: {}", e);
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    }
                }
            }
        });

        Ok(())
    }

    /// Start the sync loop (legacy, no events)
    pub async fn start_sync(&self) -> Result<(), AppError> {
        let settings = SyncSettings::default();
        let client = self.client.clone();
        tokio::spawn(async move {
            loop {
                match client.sync_once(settings.clone()).await {
                    Ok(_response) => {
                        log::debug!("Sync completed successfully");
                    }
                    Err(e) => {
                        log::error!("Sync error: {}", e);
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    }
                }
            }
        });
        Ok(())
    }

    /// Get all joined rooms as summaries
    pub async fn get_rooms(&self) -> Result<Vec<RoomSummary>, AppError> {
        let rooms = self.client.joined_rooms();
        let mut summaries = Vec::new();

        for room in rooms {
            let name = room.display_name().await.ok().map(|n| n.to_string());
            let topic = room.topic().map(|t| t.to_string());
            let is_direct = room.is_direct().await.unwrap_or(false);
            let is_encrypted = room.is_encrypted().await.unwrap_or(false);

            let unread = room.unread_notification_counts();
            let member_count = room.joined_members_count();

            summaries.push(RoomSummary {
                room_id: room.room_id().to_string(),
                name,
                topic,
                avatar_url: None,
                is_direct,
                is_encrypted,
                unread_count: unread.notification_count,
                highlight_count: unread.highlight_count,
                last_message: None,
                last_message_timestamp: None,
                member_count,
            });
        }

        summaries.sort_by(|a, b| {
            b.unread_count
                .cmp(&a.unread_count)
                .then_with(|| a.name.cmp(&b.name))
        });

        Ok(summaries)
    }

    /// Get the joined room or return an error
    fn get_joined_room(&self, room_id: &RoomId) -> Result<Room, AppError> {
        self.client
            .get_room(room_id)
            .ok_or_else(|| AppError::RoomNotFound(room_id.to_string()))
    }

    /// Get paginated messages for a room
    pub async fn get_room_messages(
        &self,
        room_id: &str,
        from: Option<String>,
        limit: u32,
    ) -> Result<PaginationResult, AppError> {
        let room_id = validate_room_id(room_id)?;
        let _room = self.get_joined_room(&room_id)?;

        use matrix_sdk::ruma::api::client::message::get_message_events::v3::Request;
        use matrix_sdk::ruma::api::Direction;

        let mut request = Request::new(room_id.clone(), Direction::Backward);
        request.limit = UInt::from(limit);
        if let Some(ref token) = from {
            request.from = Some(token.clone());
        }

        let response = self
            .client
            .send(request)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        let mut messages = Vec::new();
        for raw_event in &response.chunk {
            if let Ok(event) = raw_event.deserialize() {
                if let Some(msg) = timeline_message_from_any_event(&event) {
                    messages.push(msg);
                }
            }
        }

        let has_more = response.end.is_some();
        Ok(PaginationResult {
            messages,
            end_token: response.end,
            has_more,
        })
    }

    /// Send a text message to a room
    pub async fn send_message(&self, room_id: &str, body: &str) -> Result<String, AppError> {
        if body.is_empty() {
            return Err(AppError::InvalidInput("Message body cannot be empty".into()));
        }
        if body.len() > 65536 {
            return Err(AppError::InvalidInput("Message body too long".into()));
        }
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;

        let content = RoomMessageEventContent::text_plain(body);
        let response = room
            .send(content)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(response.event_id.to_string())
    }

    /// Send a reply to a specific message in a room.
    /// Uses the Matrix `m.relates_to` / `m.in_reply_to` relation.
    pub async fn send_reply(
        &self,
        room_id: &str,
        body: &str,
        reply_to_event_id: &str,
    ) -> Result<String, AppError> {
        if body.is_empty() {
            return Err(AppError::InvalidInput("Reply body cannot be empty".into()));
        }
        if body.len() > 65536 {
            return Err(AppError::InvalidInput("Reply body too long".into()));
        }
        let room_id = validate_room_id(room_id)?;
        let reply_to_id = validate_event_id(reply_to_event_id)?;
        let room = self.get_joined_room(&room_id)?;

        // Fetch the original event to build a proper reply
        let original_event = room
            .event(&reply_to_id, None)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        // Use the SDK's reply builder
        let content = RoomMessageEventContent::text_plain(body)
            .make_reply_to_raw(
                &original_event.into_raw(),
                reply_to_id,
                &room_id,
                matrix_sdk::ruma::events::room::message::ForwardThread::Yes,
                matrix_sdk::ruma::events::room::message::AddMentions::Yes,
            );

        let response = room
            .send(content)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(response.event_id.to_string())
    }

    /// Edit an existing message
    pub async fn edit_message(
        &self,
        room_id: &str,
        event_id: &str,
        new_body: &str,
    ) -> Result<String, AppError> {
        if new_body.is_empty() {
            return Err(AppError::InvalidInput("New message body cannot be empty".into()));
        }
        if new_body.len() > 65536 {
            return Err(AppError::InvalidInput("Message body too long".into()));
        }
        let room_id = validate_room_id(room_id)?;
        let original_event_id = validate_event_id(event_id)?;
        let room = self.get_joined_room(&room_id)?;

        // Build replacement content using the SDK's make_replacement
        let replacement = RoomMessageEventContent::text_plain(new_body).make_replacement(
            matrix_sdk::ruma::events::room::message::ReplacementMetadata::new(
                original_event_id.clone(),
                None,
            ),
            None,
        );

        let response = room
            .send(replacement)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(response.event_id.to_string())
    }

    /// Redact (delete) a message
    pub async fn delete_message(
        &self,
        room_id: &str,
        event_id: &str,
        reason: Option<&str>,
    ) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let event_id = validate_event_id(event_id)?;
        let room = self.get_joined_room(&room_id)?;

        room.redact(&event_id, reason, None)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(())
    }

    /// Send an emoji reaction to a message
    pub async fn send_reaction(
        &self,
        room_id: &str,
        event_id: &str,
        emoji: &str,
    ) -> Result<String, AppError> {
        if emoji.is_empty() {
            return Err(AppError::InvalidInput("Emoji cannot be empty".into()));
        }
        if emoji.len() > 64 {
            return Err(AppError::InvalidInput("Emoji too long".into()));
        }
        let room_id = validate_room_id(room_id)?;
        let event_id = validate_event_id(event_id)?;
        let room = self.get_joined_room(&room_id)?;

        let annotation = Annotation::new(event_id, emoji.to_string());
        let content = ReactionEventContent::new(annotation);

        let response = room
            .send(content)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(response.event_id.to_string())
    }

    /// Remove a reaction (redact the reaction event)
    pub async fn remove_reaction(
        &self,
        room_id: &str,
        reaction_event_id: &str,
    ) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let event_id = validate_event_id(reaction_event_id)?;
        let room = self.get_joined_room(&room_id)?;

        room.redact(&event_id, Some("Reaction removed"), None)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(())
    }

    /// Send typing indicator
    pub async fn send_typing(&self, room_id: &str, typing: bool) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;

        room.typing_notice(typing)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(())
    }

    /// Mark a room as read by sending a read receipt
    pub async fn mark_read(&self, room_id: &str, event_id: &str) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let event_id = validate_event_id(event_id)?;
        let room = self.get_joined_room(&room_id)?;

        room.send_single_receipt(ReceiptType::Read, ReceiptThread::Unthreaded, event_id)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(())
    }

    /// Get room members with metadata
    pub async fn get_room_members(&self, room_id: &str) -> Result<Vec<RoomMember>, AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;

        let members = room
            .members(matrix_sdk::RoomMemberships::JOIN)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        let mut result = Vec::new();
        for member in members {
            let power_level = member.power_level();
            result.push(RoomMember {
                user_id: member.user_id().to_string(),
                display_name: member.display_name().map(|n| n.to_string()),
                avatar_url: member.avatar_url().map(|u| u.to_string()),
                power_level,
            });
        }

        result.sort_by(|a, b| {
            b.power_level
                .cmp(&a.power_level)
                .then_with(|| a.display_name.cmp(&b.display_name))
        });

        Ok(result)
    }

    /// Logout and cleanup
    pub async fn logout(&self) -> Result<(), AppError> {
        self.client
            .matrix_auth()
            .logout()
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    pub fn user_id(&self) -> &OwnedUserId {
        &self.user_id
    }
}

/// Convert a sync room message event to our TimelineMessage
fn timeline_message_from_sync_event(event: &OriginalSyncRoomMessageEvent) -> TimelineMessage {
    let (body, formatted_body, msg_type) = extract_message_content(&event.content.msgtype);

    let reply_to = match &event.content.relates_to {
        Some(Relation::Reply { in_reply_to }) => Some(in_reply_to.event_id.to_string()),
        _ => None,
    };

    let is_edited = matches!(&event.content.relates_to, Some(Relation::Replacement(_)));

    TimelineMessage {
        id: event.event_id.to_string(),
        sender: event.sender.to_string(),
        body,
        formatted_body,
        timestamp: event.origin_server_ts.0.into(),
        is_edited,
        reply_to,
        reactions: HashMap::new(),
        msg_type,
    }
}

/// Convert any timeline event to TimelineMessage (for pagination)
fn timeline_message_from_any_event(event: &AnyTimelineEvent) -> Option<TimelineMessage> {
    match event {
        AnyTimelineEvent::MessageLike(msg_event) => match msg_event {
            AnyMessageLikeEvent::RoomMessage(MessageLikeEvent::Original(original)) => {
                let (body, formatted_body, msg_type) =
                    extract_message_content(&original.content.msgtype);

                let reply_to = match &original.content.relates_to {
                    Some(Relation::Reply { in_reply_to }) => {
                        Some(in_reply_to.event_id.to_string())
                    }
                    _ => None,
                };

                let is_edited =
                    matches!(&original.content.relates_to, Some(Relation::Replacement(_)));

                Some(TimelineMessage {
                    id: original.event_id.to_string(),
                    sender: original.sender.to_string(),
                    body,
                    formatted_body,
                    timestamp: original.origin_server_ts.0.into(),
                    is_edited,
                    reply_to,
                    reactions: HashMap::new(),
                    msg_type,
                })
            }
            _ => None,
        },
        _ => None,
    }
}

/// Extract body, formatted_body, and msg_type from MessageType
fn extract_message_content(msgtype: &MessageType) -> (String, Option<String>, String) {
    match msgtype {
        MessageType::Text(text) => {
            let formatted = text.formatted.as_ref().map(|f| f.body.clone());
            (text.body.clone(), formatted, "m.text".into())
        }
        MessageType::Notice(notice) => {
            let formatted = notice.formatted.as_ref().map(|f| f.body.clone());
            (notice.body.clone(), formatted, "m.notice".into())
        }
        MessageType::Emote(emote) => {
            let formatted = emote.formatted.as_ref().map(|f| f.body.clone());
            (emote.body.clone(), formatted, "m.emote".into())
        }
        MessageType::Image(img) => (img.body.clone(), None, "m.image".into()),
        MessageType::File(file) => (file.body.clone(), None, "m.file".into()),
        MessageType::Audio(audio) => (audio.body.clone(), None, "m.audio".into()),
        MessageType::Video(video) => (video.body.clone(), None, "m.video".into()),
        _ => ("Unsupported message type".into(), None, "unknown".into()),
    }
}

/// Get the data directory for PufferChat storage
fn get_data_dir() -> PathBuf {
    let mut dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("pufferchat");
    dir.push("matrix-store");
    std::fs::create_dir_all(&dir).ok();
    dir
}

/// Get or generate a passphrase for SQLite encryption.
fn get_or_create_db_passphrase() -> Result<String, AppError> {
    use crate::store::keychain;
    use zeroize::Zeroize;

    const KEY: &str = "db_passphrase";

    if let Some(passphrase) = keychain::get_secret(KEY)? {
        return Ok(passphrase);
    }

    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes)
        .map_err(|e| AppError::Internal(format!("RNG failure: {}", e)))?;
    let passphrase = hex::encode(bytes);
    bytes.zeroize();

    keychain::store_secret(KEY, &passphrase)?;
    Ok(passphrase)
}
