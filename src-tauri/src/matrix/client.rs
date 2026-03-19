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
#[serde(rename_all = "camelCase")]
pub struct LoginResult {
    pub user_id: String,
    pub display_name: Option<String>,
    pub device_id: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct Reaction {
    pub emoji: String,
    pub senders: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TimelineMessage {
    pub id: String,
    pub sender: String,
    pub body: String,
    pub formatted_body: Option<String>,
    pub timestamp: i64,
    pub is_edited: bool,
    pub reply_to: Option<String>,
    pub reactions: Vec<Reaction>,
    pub msg_type: String,
    pub replaces: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RoomMember {
    pub user_id: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub power_level: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PaginationResult {
    pub messages: Vec<TimelineMessage>,
    pub end_token: Option<String>,
    pub has_more: bool,
}

/// Tauri event payloads
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEvent {
    pub room_id: String,
    pub message: TimelineMessage,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TypingEvent {
    pub room_id: String,
    pub user_ids: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReadReceiptEvent {
    pub room_id: String,
    pub user_id: String,
    pub event_id: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RoomUpdateEvent {
    pub room: RoomSummary,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PresenceUpdate {
    pub user_id: String,
    pub presence: String,
    pub status_msg: Option<String>,
    pub last_active_ago: Option<u64>,
}


#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReactionSyncEvent {
    pub room_id: String,
    pub event_id: String,
    pub reaction_event_id: String,
    pub sender: String,
    pub emoji: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VerificationRequestReceived {
    pub user_id: String,
    pub flow_id: String,
    pub timestamp: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RoomEncryptionChanged {
    pub room_id: String,
    pub is_encrypted: bool,
}


/// Public room info returned from directory search
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PublicRoomInfo {
    pub room_id: String,
    pub name: Option<String>,
    pub topic: Option<String>,
    pub member_count: u64,
    pub avatar_url: Option<String>,
    pub alias: Option<String>,
    pub world_readable: bool,
    pub guest_can_join: bool,
}

/// Detailed room info
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RoomDetails {
    pub room_id: String,
    pub name: Option<String>,
    pub topic: Option<String>,
    pub member_count: u64,
    pub is_encrypted: bool,
    pub is_direct: bool,
    pub members: Vec<RoomMember>,
}

/// Invited room summary
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InvitedRoomSummary {
    pub room_id: String,
    pub name: Option<String>,
    pub inviter: Option<String>,
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

// Reaction event handler
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::reaction::SyncReactionEvent, room: Room| {
                let handle = handle_clone.clone();
                async move {
                    if let matrix_sdk::ruma::events::SyncMessageLikeEvent::Original(original) = event {
                        let annotation = &original.content.relates_to;
                        let payload = ReactionSyncEvent {
                            room_id: room.room_id().to_string(),
                            event_id: annotation.event_id.to_string(),
                            reaction_event_id: original.event_id.to_string(),
                            sender: original.sender.to_string(),
                            emoji: annotation.key.clone(),
                        };
                        if let Err(e) = handle.emit("matrix://reaction", &payload) {
                            log::error!("Failed to emit reaction event: {}", e);
                        }
                    }
                }
            },
        );

        // Presence events
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::presence::PresenceEvent| {
                let handle = handle_clone.clone();
                async move {
                    let presence_str = match event.content.presence {
                        matrix_sdk::ruma::presence::PresenceState::Online => "online",
                        matrix_sdk::ruma::presence::PresenceState::Unavailable => "unavailable",
                        matrix_sdk::ruma::presence::PresenceState::Offline => "offline",
                        _ => "offline",
                    };
                    let payload = PresenceUpdate {
                        user_id: event.sender.to_string(),
                        presence: presence_str.to_string(),
                        status_msg: event.content.status_msg.clone(),
                        last_active_ago: event.content.last_active_ago.map(|d| u64::from(d)),
                    };
                    if let Err(e) = handle.emit("matrix://presence", &payload) {
                        log::error!("Failed to emit presence event: {}", e);
                    }
                }
            },
        );
// Verification request handler (to-device)
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::key::verification::request::ToDeviceKeyVerificationRequestEvent| {
                let handle = handle_clone.clone();
                async move {
                    let payload = VerificationRequestReceived {
                        user_id: event.sender.to_string(),
                        flow_id: event.content.transaction_id.to_string(),
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as i64,
                    };
                    if let Err(e) = handle.emit("matrix://verification-request-received", &payload) {
                        log::error!("Failed to emit verification request event: {}", e);
                    }
                }
            },
        );

        // Verification start handler (to-device)
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::key::verification::start::ToDeviceKeyVerificationStartEvent| {
                let handle = handle_clone.clone();
                async move {
                    let payload = VerificationRequestReceived {
                        user_id: event.sender.to_string(),
                        flow_id: event.content.transaction_id.to_string(),
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as i64,
                    };
                    if let Err(e) = handle.emit("matrix://verification-request-received", &payload) {
                        log::error!("Failed to emit verification start event: {}", e);
                    }
                }
            },
        );

        // Room encryption state change handler
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |_event: matrix_sdk::ruma::events::room::encryption::SyncRoomEncryptionEvent, room: Room| {
                let handle = handle_clone.clone();
                async move {
                    let payload = RoomEncryptionChanged {
                        room_id: room.room_id().to_string(),
                        is_encrypted: true,
                    };
                    if let Err(e) = handle.emit("matrix://room-encryption-changed", &payload) {
                        log::error!("Failed to emit room encryption changed event: {}", e);
                    }
                }
            },
        );

        let app_handle_sync = app_handle.clone();
        tokio::spawn(async move {
            loop {
                match client.sync_once(settings.clone()).await {
                    Ok(_response) => {
                        log::debug!("Sync completed successfully");
                        if let Err(e) = app_handle_sync.emit("matrix://rooms-changed", ()) {
                            log::error!("Failed to emit rooms-changed: {}", e);
                        }
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

            // Fetch last message from room's latest event
            let (last_message, last_message_timestamp) = {
                use matrix_sdk::ruma::api::client::message::get_message_events::v3::Request;
                use matrix_sdk::ruma::api::Direction;

                let mut last_msg = None;
                let mut last_ts = None;

                let mut request = Request::new(room.room_id().to_owned(), Direction::Backward);
                request.limit = UInt::from(5u32);

                if let Ok(response) = self.client.send(request).await {
                    for raw_event in &response.chunk {
                        if let Ok(event) = raw_event.deserialize() {
                            if let Some(msg) = timeline_message_from_any_event(&event) {
                                let preview = if msg.body.len() > 100 {
                                    format!("{}...", &msg.body[..97])
                                } else {
                                    msg.body.clone()
                                };
                                last_msg = Some(preview);
                                last_ts = Some(msg.timestamp);
                                break;
                            }
                        }
                    }
                }

                (last_msg, last_ts)
            };

            summaries.push(RoomSummary {
                room_id: room.room_id().to_string(),
                name,
                topic,
                avatar_url: None,
                is_direct,
                is_encrypted,
                unread_count: unread.notification_count,
                highlight_count: unread.highlight_count,
                last_message,
                last_message_timestamp,
                member_count,
            });
        }

        // Sort by last_message_timestamp (most recent first), then by unread count, then by name
        summaries.sort_by(|a, b| {
            b.last_message_timestamp
                .unwrap_or(0)
                .cmp(&a.last_message_timestamp.unwrap_or(0))
                .then_with(|| b.unread_count.cmp(&a.unread_count))
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
        let mut reaction_map: HashMap<String, Vec<(String, String)>> = HashMap::new(); // target_event_id -> [(emoji, sender)]

        for raw_event in &response.chunk {
            if let Ok(event) = raw_event.deserialize() {
                match &event {
                    AnyTimelineEvent::MessageLike(AnyMessageLikeEvent::Reaction(
                        MessageLikeEvent::Original(reaction),
                    )) => {
                        let target = reaction.content.relates_to.event_id.to_string();
                        let emoji = reaction.content.relates_to.key.clone();
                        let sender = reaction.sender.to_string();
                        reaction_map
                            .entry(target)
                            .or_default()
                            .push((emoji, sender));
                    }
                    _ => {
                        if let Some(msg) = timeline_message_from_any_event(&event) {
                            messages.push(msg);
                        }
                    }
                }
            }
        }

        // Attach aggregated reactions to messages
        for msg in &mut messages {
            if let Some(raw_reactions) = reaction_map.remove(&msg.id) {
                let mut emoji_map: HashMap<String, Vec<String>> = HashMap::new();
                for (emoji, sender) in raw_reactions {
                    emoji_map.entry(emoji).or_default().push(sender);
                }
                msg.reactions = emoji_map
                    .into_iter()
                    .map(|(emoji, senders)| Reaction { emoji, senders })
                    .collect();
            }
        }

        messages.reverse();


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

    /// Search messages across rooms or in a specific room
    pub async fn search_messages(&self, room_id: Option<&str>, query: &str, limit: u32) -> Result<Vec<TimelineMessage>, AppError> {
        if query.is_empty() {
            return Err(AppError::InvalidInput("Search query cannot be empty".into()));
        }
        
        let query_lower = query.to_lowercase();
        
        if let Some(rid) = room_id {
            let result = self.get_room_messages(rid, None, 200).await?;
            let filtered: Vec<TimelineMessage> = result.messages
                .into_iter()
                .filter(|m| m.body.to_lowercase().contains(&query_lower))
                .take(limit as usize)
                .collect();
            Ok(filtered)
        } else {
            let rooms = self.client.joined_rooms();
            let mut results = Vec::new();
            for room in rooms {
                if let Ok(room_msgs) = self.get_room_messages(&room.room_id().to_string(), None, 100).await {
                    for msg in room_msgs.messages {
                        if msg.body.to_lowercase().contains(&query_lower) {
                            results.push(msg);
                            if results.len() >= limit as usize {
                                break;
                            }
                        }
                    }
                }
                if results.len() >= limit as usize {
                    break;
                }
            }
            Ok(results)
        }
    }


    /// Create a new room
    pub async fn create_room(
        &self,
        name: Option<String>,
        topic: Option<String>,
        is_direct: bool,
        invite_user_ids: Vec<String>,
        is_encrypted: bool,
    ) -> Result<String, AppError> {
        use matrix_sdk::ruma::api::client::room::create_room::v3::Request as CreateRoomRequest;
        use matrix_sdk::ruma::api::client::room::create_room::v3::RoomPreset;
        use matrix_sdk::ruma::events::room::encryption::RoomEncryptionEventContent;
        use matrix_sdk::ruma::events::InitialStateEvent;

        let mut request = CreateRoomRequest::new();
        request.name = name;
        if let Some(ref t) = topic {
            request.topic = Some(t.clone());
        }
        request.is_direct = is_direct;

        if is_direct {
            request.preset = Some(RoomPreset::TrustedPrivateChat);
        } else {
            request.preset = Some(RoomPreset::PrivateChat);
        }

        // Parse invite user IDs
        let mut invite_ids = Vec::new();
        for uid_str in &invite_user_ids {
            let uid: OwnedUserId = uid_str
                .as_str()
                .try_into()
                .map_err(|_| AppError::InvalidInput(format!("Invalid user ID: {}", uid_str)))?;
            invite_ids.push(uid);
        }
        request.invite = invite_ids;

        if is_encrypted {
            let encryption_content = RoomEncryptionEventContent::with_recommended_defaults();
            let raw = serde_json::to_value(&InitialStateEvent {
                content: encryption_content,
                state_key: Default::default(),
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;
            let raw_event = matrix_sdk::ruma::serde::Raw::from_json(
                serde_json::value::to_raw_value(&raw)
                    .map_err(|e| AppError::Internal(e.to_string()))?,
            );
            request.initial_state = vec![raw_event];
        }

        let response = self
            .client
            .send(request)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(response.room_id.to_string())
    }

    /// Join a room by ID or alias
    pub async fn join_room(&self, room_id_or_alias: &str) -> Result<String, AppError> {
        if room_id_or_alias.is_empty() {
            return Err(AppError::InvalidInput("Room ID or alias is required".into()));
        }

        use matrix_sdk::ruma::OwnedRoomOrAliasId;
        let room_or_alias: OwnedRoomOrAliasId = room_id_or_alias
            .try_into()
            .map_err(|_| AppError::InvalidInput("Invalid room ID or alias format".into()))?;

        let response = self
            .client
            .join_room_by_id_or_alias(room_or_alias.as_ref(), &[])
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(response.room_id().to_string())
    }

    /// Leave a room
    pub async fn leave_room(&self, room_id: &str) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        room.leave()
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Invite a user to a room
    pub async fn invite_to_room(&self, room_id: &str, user_id: &str) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let user_id: OwnedUserId = user_id
            .try_into()
            .map_err(|_| AppError::InvalidInput("Invalid user ID format".into()))?;
        let room = self.get_joined_room(&room_id)?;
        room.invite_user_by_id(&user_id)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Search public rooms
    pub async fn search_public_rooms(
        &self,
        query: Option<String>,
        limit: Option<u32>,
    ) -> Result<Vec<PublicRoomInfo>, AppError> {
        use matrix_sdk::ruma::api::client::directory::get_public_rooms_filtered::v3::Request;
        use matrix_sdk::ruma::directory::Filter;

        let mut filter = Filter::new();
        if let Some(ref q) = query {
            filter.generic_search_term = Some(q.clone());
        }

        let mut request = Request::new();
        request.filter = filter;
        request.limit = Some(UInt::from(limit.unwrap_or(20).min(50)));

        let response = self
            .client
            .send(request)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        let rooms: Vec<PublicRoomInfo> = response
            .chunk
            .iter()
            .map(|r| PublicRoomInfo {
                room_id: r.room_id.to_string(),
                name: r.name.as_ref().map(|n| n.to_string()),
                topic: r.topic.as_ref().map(|t| t.to_string()),
                member_count: r.num_joined_members.into(),
                avatar_url: r.avatar_url.as_ref().map(|u| u.to_string()),
                alias: r.canonical_alias.as_ref().map(|a| a.to_string()),
                world_readable: r.world_readable,
                guest_can_join: r.guest_can_join,
            })
            .collect();

        Ok(rooms)
    }

    /// Get detailed room info
    pub async fn get_room_info(&self, room_id: &str) -> Result<RoomDetails, AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;

        let name = room.display_name().await.ok().map(|n| n.to_string());
        let topic = room.topic().map(|t| t.to_string());
        let is_encrypted = room.is_encrypted().await.unwrap_or(false);
        let is_direct = room.is_direct().await.unwrap_or(false);
        let member_count = room.joined_members_count();

        let members = self.get_room_members(&room_id.to_string()).await?;

        Ok(RoomDetails {
            room_id: room_id.to_string(),
            name,
            topic,
            member_count,
            is_encrypted,
            is_direct,
            members,
        })
    }

    /// Get pending room invites
    pub async fn get_invited_rooms(&self) -> Result<Vec<InvitedRoomSummary>, AppError> {
        let rooms = self.client.invited_rooms();
        let mut summaries = Vec::new();

        for room in rooms {
            let name = room.display_name().await.ok().map(|n| n.to_string());
            // Try to get inviter from room details
            let inviter = room
                .invite_details()
                .await
                .ok()
                .and_then(|d| d.inviter.map(|m| m.user_id().to_string()));

            summaries.push(InvitedRoomSummary {
                room_id: room.room_id().to_string(),
                name,
                inviter,
            });
        }

        Ok(summaries)
    }

    /// Accept a room invite
    pub async fn accept_invite(&self, room_id: &str) -> Result<String, AppError> {
        let room_id = validate_room_id(room_id)?;
        let response = self
            .client
            .join_room_by_id(&room_id)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(response.room_id().to_string())
    }

    /// Reject a room invite
    pub async fn reject_invite(&self, room_id: &str) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self
            .client
            .get_room(&room_id)
            .ok_or_else(|| AppError::RoomNotFound(room_id.to_string()))?;
        room.leave()
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
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
    /// Resolve an mxc:// URL to an HTTP thumbnail URL
    pub fn resolve_mxc_url(&self, mxc_url: &str, width: u32, height: u32) -> Result<String, AppError> {
        // mxc://server_name/media_id -> /_matrix/media/v3/thumbnail/server_name/media_id
        if !mxc_url.starts_with("mxc://") {
            return Err(AppError::InvalidInput("Not an mxc:// URL".into()));
        }
        let path = &mxc_url[6..]; // strip "mxc://"
        let homeserver = self.client.homeserver().to_string();
        let homeserver = homeserver.trim_end_matches('/');
        Ok(format!(
            "{}/_matrix/media/v3/thumbnail/{}?width={}&height={}&method=crop",
            homeserver, path, width, height
        ))
    }

    /// Get a user's avatar URL (resolved to HTTP)
    pub async fn get_user_avatar(&self, user_id: &str) -> Result<Option<String>, AppError> {
        let parsed_user_id: OwnedUserId = user_id
            .try_into()
            .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;

        let request = matrix_sdk::ruma::api::client::profile::get_profile::v3::Request::new(parsed_user_id);
        let response = self.client.send(request).await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        match response.avatar_url {
            Some(mxc_url) => {
                let resolved = self.resolve_mxc_url(&mxc_url.to_string(), 96, 96)?;
                Ok(Some(resolved))
            }
            None => Ok(None),
        }
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

    let replaces = match &event.content.relates_to {
        Some(Relation::Replacement(replacement)) => Some(replacement.event_id.to_string()),
        _ => None,
    };

    TimelineMessage {
        id: event.event_id.to_string(),
        sender: event.sender.to_string(),
        body,
        formatted_body,
        timestamp: event.origin_server_ts.0.into(),
        is_edited,
        reply_to,
        reactions: Vec::new(),
        msg_type,
        replaces,
        avatar_url: None,
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

                let replaces = match &original.content.relates_to {
                    Some(Relation::Replacement(replacement)) => Some(replacement.event_id.to_string()),
                    _ => None,
                };

                Some(TimelineMessage {
                    id: original.event_id.to_string(),
                    sender: original.sender.to_string(),
                    body,
                    formatted_body,
                    timestamp: original.origin_server_ts.0.into(),
                    is_edited,
                    reply_to,
                    reactions: Vec::new(),
                    msg_type,
                    replaces,
                    avatar_url: None,
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
