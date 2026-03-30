use matrix_sdk::{
    authentication::matrix::{MatrixSession, MatrixSessionTokens},
    config::SyncSettings,
    room::{ReportedContentScore, Room},
    ruma::{
        api::client::{
            account::register,
            receipt::create_receipt::v3::ReceiptType,
            reporting::report_user,
            room::report_room,
            uiaa::{AuthData, AuthFlow, AuthType, Dummy, RegistrationToken},
        },
        events::room::MediaSource,
        events::{
            ignored_user_list::{IgnoredUser, IgnoredUserListEventContent},
            reaction::ReactionEventContent,
            receipt::ReceiptThread,
            relation::Annotation,
            room::message::{
                MessageType, OriginalSyncRoomMessageEvent, Relation, RoomMessageEventContent,
            },
            AnyGlobalAccountDataEvent, AnyMessageLikeEvent, AnyTimelineEvent,
            GlobalAccountDataEventType, MessageLikeEvent,
        },
        OwnedEventId, OwnedRoomId, OwnedUserId, RoomId, UInt,
    },
    Client, SessionMeta,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::RwLock;
use zeroize::Zeroize;

use crate::error::AppError;

/// Wrapper around matrix-sdk Client
pub struct MatrixClient {
    client: Client,
    user_id: OwnedUserId,
    ignored_users: Arc<RwLock<HashSet<String>>>,
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
pub struct MediaInfo {
    pub mimetype: Option<String>,
    pub size: Option<u64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_ms: Option<u64>,
    pub thumbnail_url: Option<String>,
    pub filename: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TimelineMessage {
    pub event_id: String,
    pub sender: String,
    pub sender_name: Option<String>,
    pub body: String,
    pub formatted_body: Option<String>,
    pub timestamp: i64,
    pub is_edited: bool,
    pub is_redacted: bool,
    pub reply_to: Option<String>,
    pub reactions: Vec<Reaction>,
    pub msg_type: String,
    pub replaces: Option<String>,
    pub avatar_url: Option<String>,
    pub media_url: Option<String>,
    pub media_info: Option<MediaInfo>,
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
pub struct PresenceUpdate {
    pub user_id: String,
    pub presence: String,
    pub status_msg: Option<String>,
    pub last_active_ago: Option<u64>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RedactionSyncEvent {
    pub room_id: String,
    pub redacted_event_id: String,
    pub sender: String,
    pub reason: Option<String>,
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

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct IgnoredUsersChanged {
    pub user_ids: Vec<String>,
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

/// Validate user_id format
fn validate_user_id(user_id: &str) -> Result<OwnedUserId, AppError> {
    if user_id.is_empty() {
        return Err(AppError::InvalidInput("User ID is required".into()));
    }
    let parsed: OwnedUserId = user_id
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid user ID format".into()))?;
    Ok(parsed)
}

impl MatrixClient {
    async fn fetch_ignored_user_list_event_content(
        client: &Client,
    ) -> Result<IgnoredUserListEventContent, AppError> {
        let raw_content = client
            .account()
            .fetch_account_data(GlobalAccountDataEventType::IgnoredUserList)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        let content = raw_content
            .map(|raw| raw.deserialize_as::<IgnoredUserListEventContent>())
            .transpose()
            .map_err(|e| AppError::Matrix(e.to_string()))?
            .unwrap_or_default();

        Ok(content)
    }

    fn ignored_user_ids_from_content(content: &IgnoredUserListEventContent) -> HashSet<String> {
        content
            .ignored_users
            .keys()
            .map(|user_id| user_id.to_string())
            .collect()
    }

    fn sorted_ignored_user_ids(content: &IgnoredUserListEventContent) -> Vec<String> {
        let mut user_ids: Vec<String> = content
            .ignored_users
            .keys()
            .map(|user_id| user_id.to_string())
            .collect();
        user_ids.sort();
        user_ids
    }

    async fn build_with_loaded_moderation_state(client: Client, user_id: OwnedUserId) -> Self {
        let ignored_users = match Self::fetch_ignored_user_list_event_content(&client).await {
            Ok(content) => Self::ignored_user_ids_from_content(&content),
            Err(error) => {
                log::warn!(
                    "Failed to load ignored users for moderation cache, continuing with empty list: {}",
                    error
                );
                HashSet::new()
            }
        };

        Self {
            client,
            user_id,
            ignored_users: Arc::new(RwLock::new(ignored_users)),
        }
    }

    async fn current_ignored_user_ids(&self) -> HashSet<String> {
        self.ignored_users.read().await.clone()
    }

    async fn build_temp_client(homeserver: &str) -> Result<Client, AppError> {
        Client::builder()
            .homeserver_url(homeserver)
            .build()
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))
    }

    async fn finalize_logged_in_session(
        homeserver: &str,
        temp_client: Client,
        session: MatrixSession,
    ) -> Result<(Self, LoginResult, String), AppError> {
        let user_id = session.meta.user_id.clone();
        let device_id = session.meta.device_id.to_string();
        let access_token = session.tokens.access_token.clone();

        let display_name = temp_client
            .account()
            .get_display_name()
            .await
            .ok()
            .flatten()
            .map(|n| n.to_string());

        let uid_str = user_id.to_string();
        let client = match Self::build_persistent_client(homeserver, &uid_str).await {
            Ok(c) => c,
            Err(e) => {
                let err_str = format!("{}", e);
                if err_str.contains("cipher")
                    || err_str.contains("Cipher")
                    || err_str.contains("crypto")
                    || err_str.contains("database")
                    || err_str.contains("SqliteStore")
                {
                    log::warn!(
                        "Store cipher error for {}, clearing and retrying: {}",
                        uid_str,
                        e
                    );
                    let _ = clear_crypto_store_for_user(Some(&uid_str));
                    let _ = clear_db_passphrase_for_user(Some(&uid_str));
                    Self::build_persistent_client(homeserver, &uid_str).await?
                } else {
                    return Err(e);
                }
            }
        };

        client
            .matrix_auth()
            .restore_session(session)
            .await
            .map_err(|e| AppError::Auth(format!("Failed to persist session: {}", e)))?;

        let result = LoginResult {
            user_id: uid_str,
            display_name,
            device_id,
        };

        let matrix_client = Self::build_with_loaded_moderation_state(client, user_id).await;

        Ok((matrix_client, result, access_token))
    }

    fn build_registration_request(
        username: &str,
        password: &str,
        auth: Option<AuthData>,
    ) -> register::v3::Request {
        let mut request = register::v3::Request::new();
        request.username = Some(username.to_owned());
        request.password = Some(password.to_owned());
        request.initial_device_display_name = Some("PufferChat".to_owned());
        request.kind = register::RegistrationKind::User;
        request.auth = auth;
        request
    }

    fn registration_stage_label(stage: &AuthType) -> &'static str {
        match stage {
            AuthType::Dummy => "dummy confirmation",
            AuthType::RegistrationToken => "registration token",
            AuthType::Terms => "terms acceptance",
            AuthType::ReCaptcha => "CAPTCHA",
            AuthType::EmailIdentity => "email verification",
            AuthType::Msisdn => "phone verification",
            AuthType::Password => "password confirmation",
            AuthType::Sso => "browser sign-in",
            _ => "additional authentication",
        }
    }

    fn flow_can_be_completed(flow: &AuthFlow, has_registration_token: bool) -> bool {
        flow.stages.iter().all(|stage| match stage {
            AuthType::Dummy => true,
            AuthType::RegistrationToken => has_registration_token,
            _ => false,
        })
    }

    fn next_registration_auth_step(
        info: &matrix_sdk::ruma::api::client::uiaa::UiaaInfo,
        registration_token: Option<&str>,
    ) -> Result<AuthData, AppError> {
        if let Some(flow) = info
            .flows
            .iter()
            .find(|flow| Self::flow_can_be_completed(flow, registration_token.is_some()))
        {
            if let Some(next_stage) = flow
                .stages
                .iter()
                .find(|stage| !info.completed.contains(stage))
            {
                return match next_stage {
                    AuthType::Dummy => {
                        let mut auth = Dummy::new();
                        auth.session = info.session.clone();
                        Ok(AuthData::Dummy(auth))
                    }
                    AuthType::RegistrationToken => {
                        let token = registration_token.ok_or_else(|| {
                            AppError::Auth(
                                "This homeserver requires a registration token to create accounts."
                                    .into(),
                            )
                        })?;
                        let mut auth = RegistrationToken::new(token.to_owned());
                        auth.session = info.session.clone();
                        Ok(AuthData::RegistrationToken(auth))
                    }
                    _ => unreachable!("unsupported stage already filtered out"),
                };
            }
        }

        if info.flows.iter().any(|flow| {
            flow.stages
                .iter()
                .any(|stage| matches!(stage, AuthType::RegistrationToken))
        }) && registration_token.is_none()
        {
            return Err(AppError::Auth(
                "This homeserver requires a registration token to create accounts.".into(),
            ));
        }

        if let Some(unsupported_stage) = info
            .flows
            .iter()
            .flat_map(|flow| flow.stages.iter())
            .find(|stage| !matches!(stage, AuthType::Dummy | AuthType::RegistrationToken))
        {
            return Err(AppError::Auth(format!(
                "This homeserver requires {} for registration, which PufferChat does not support yet.",
                Self::registration_stage_label(unsupported_stage)
            )));
        }

        Err(AppError::Auth(
            "The homeserver requested registration steps PufferChat could not complete.".into(),
        ))
    }

    /// Create a new Matrix client and log in with password.
    /// Uses a temporary in-memory client for auth, then builds the real
    /// per-user store client with the actual user_id.
    pub async fn login(
        homeserver: &str,
        username: &str,
        mut password: String,
    ) -> Result<(Self, LoginResult, String), AppError> {
        let temp_client = Self::build_temp_client(homeserver).await?;

        let response = temp_client
            .matrix_auth()
            .login_username(username, &password)
            .initial_device_display_name("PufferChat")
            .await
            .map_err(|e| AppError::Auth(e.to_string()))?;

        password.zeroize();

        Self::finalize_logged_in_session(homeserver, temp_client, (&response).into()).await
    }

    pub async fn register(
        homeserver: &str,
        username: &str,
        mut password: String,
        registration_token: Option<String>,
    ) -> Result<(Self, LoginResult, String), AppError> {
        let temp_client = Self::build_temp_client(homeserver).await?;

        let result = async {
            let mut request = Self::build_registration_request(username, &password, None);

            let response = loop {
                match temp_client.matrix_auth().register(request).await {
                    Ok(response) => break response,
                    Err(err) => {
                        if let Some(info) = err.as_uiaa_response() {
                            let auth = Self::next_registration_auth_step(
                                info,
                                registration_token.as_deref(),
                            )?;
                            request =
                                Self::build_registration_request(username, &password, Some(auth));
                            continue;
                        }

                        return Err(AppError::Auth(format!("Failed to register: {}", err)));
                    }
                }
            };

            let access_token = response.access_token.clone().ok_or_else(|| {
                AppError::Auth(
                    "The homeserver created the account but did not return a login session.".into(),
                )
            })?;
            let device_id = response.device_id.clone().ok_or_else(|| {
                AppError::Auth(
                    "The homeserver created the account but did not return a device ID.".into(),
                )
            })?;

            let session = MatrixSession {
                meta: SessionMeta {
                    user_id: response.user_id.clone(),
                    device_id,
                },
                tokens: MatrixSessionTokens {
                    access_token,
                    refresh_token: response.refresh_token.clone(),
                },
            };

            Self::finalize_logged_in_session(homeserver, temp_client, session).await
        }
        .await;

        password.zeroize();
        result
    }

    pub async fn login_with_sso<F, Fut>(
        homeserver: &str,
        identity_provider_id: Option<&str>,
        use_sso_login_url: F,
    ) -> Result<(Self, LoginResult, String), AppError>
    where
        F: FnOnce(String) -> Fut + Send + 'static,
        Fut: Future<Output = matrix_sdk::Result<()>> + Send + 'static,
    {
        let temp_client = Self::build_temp_client(homeserver).await?;
        let mut login_builder = temp_client
            .matrix_auth()
            .login_sso(use_sso_login_url)
            .initial_device_display_name("PufferChat")
            .server_response("PufferChat sign-in is complete. You can close this page now.");

        if let Some(idp_id) = identity_provider_id {
            login_builder = login_builder.identity_provider_id(idp_id);
        }

        let response = login_builder
            .await
            .map_err(|e| AppError::Auth(format!("Browser sign-in failed: {}", e)))?;

        Self::finalize_logged_in_session(homeserver, temp_client, (&response).into()).await
    }

    /// Build a persistent client with per-user store directory
    async fn build_persistent_client(homeserver: &str, user_id: &str) -> Result<Client, AppError> {
        let data_dir = get_data_dir_for_user(Some(user_id));
        let db_passphrase = get_or_create_db_passphrase_for_user(Some(user_id))?;

        let client = Client::builder()
            .homeserver_url(homeserver)
            .sqlite_store(&data_dir, Some(&db_passphrase))
            .build()
            .await
            .map_err(|e| AppError::Matrix(format!("Failed to create persistent client: {}", e)))?;

        Ok(client)
    }

    /// Restore session from stored access token
    pub async fn restore(
        homeserver: &str,
        access_token: &str,
        user_id: &str,
        device_id: &str,
    ) -> Result<Self, AppError> {
        log::info!("[restore] Building persistent client for {}...", user_id);
        let client = match Self::build_persistent_client(homeserver, user_id).await {
            Ok(c) => {
                log::info!("[restore] Persistent client built successfully");
                c
            }
            Err(e) => {
                let err_str = format!("{}", e);
                if err_str.contains("cipher")
                    || err_str.contains("Cipher")
                    || err_str.contains("crypto")
                    || err_str.contains("database")
                    || err_str.contains("SqliteStore")
                {
                    log::warn!("[restore] Store cipher error, clearing and retrying: {}", e);
                    let _ = clear_crypto_store_for_user(Some(user_id));
                    let _ = clear_db_passphrase_for_user(Some(user_id));
                    Self::build_persistent_client(homeserver, user_id).await?
                } else {
                    return Err(e);
                }
            }
        };

        log::info!("[restore] Restoring Matrix auth session...");
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

        log::info!("[restore] Session restored successfully");
        let user_id = client.user_id().ok_or(AppError::NotLoggedIn)?.to_owned();

        Ok(Self::build_with_loaded_moderation_state(client, user_id).await)
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
        let settings = SyncSettings::default().timeout(std::time::Duration::from_secs(30));
        let client = self.client.clone();

        // Timeline message handler
        let handle_clone = app_handle.clone();
        let ignored_users = self.ignored_users.clone();
        client.add_event_handler(move |event: OriginalSyncRoomMessageEvent, room: Room| {
            let handle = handle_clone.clone();
            let ignored_users = ignored_users.clone();
            async move {
                let sender = event.sender.to_string();
                if ignored_users.read().await.contains(&sender) {
                    return;
                }

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
        });

        // Typing indicators
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::typing::SyncTypingEvent, room: Room| {
                let handle = handle_clone.clone();
                async move {
                    let room_id = room.room_id().to_string();
                    let user_ids: Vec<String> = event
                        .content
                        .user_ids
                        .iter()
                        .map(|u| u.to_string())
                        .collect();
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
                        if let Some(read_receipts) =
                            receipts.get(&matrix_sdk::ruma::events::receipt::ReceiptType::Read)
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
        let ignored_users = self.ignored_users.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::reaction::SyncReactionEvent, room: Room| {
                let handle = handle_clone.clone();
                let ignored_users = ignored_users.clone();
                async move {
                    if let matrix_sdk::ruma::events::SyncMessageLikeEvent::Original(original) =
                        event
                    {
                        let sender = original.sender.to_string();
                        if ignored_users.read().await.contains(&sender) {
                            return;
                        }

                        let annotation = &original.content.relates_to;
                        let payload = ReactionSyncEvent {
                            room_id: room.room_id().to_string(),
                            event_id: annotation.event_id.to_string(),
                            reaction_event_id: original.event_id.to_string(),
                            sender,
                            emoji: annotation.key.clone(),
                        };
                        if let Err(e) = handle.emit("matrix://reaction", &payload) {
                            log::error!("Failed to emit reaction event: {}", e);
                        }
                    }
                }
            },
        );

        // Global account data handler for moderation state such as ignored users.
        let handle_clone = app_handle.clone();
        let ignored_users = self.ignored_users.clone();
        client.add_event_handler(move |event: AnyGlobalAccountDataEvent| {
            let handle = handle_clone.clone();
            let ignored_users = ignored_users.clone();
            async move {
                if let AnyGlobalAccountDataEvent::IgnoredUserList(event) = event {
                    let mut user_ids: Vec<String> = event
                        .content
                        .ignored_users
                        .keys()
                        .map(|user_id| user_id.to_string())
                        .collect();
                    user_ids.sort();

                    let mut ignored_users_guard = ignored_users.write().await;
                    *ignored_users_guard = user_ids.iter().cloned().collect();

                    let payload = IgnoredUsersChanged { user_ids };
                    if let Err(error) = handle.emit("matrix://ignored-users-changed", &payload) {
                        log::error!("Failed to emit ignored users update: {}", error);
                    }
                }
            }
        });

        // Redaction event handler
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::room::redaction::OriginalSyncRoomRedactionEvent, room: Room| {
                let handle = handle_clone.clone();
                async move {
                    let redacted_id = event.content.redacts
                        .as_ref()
                        .map(|id: &OwnedEventId| id.to_string())
                        .unwrap_or_default();

                    if redacted_id.is_empty() {
                        log::warn!("Redaction event missing redacted event ID");
                        return;
                    }

                    let payload = RedactionSyncEvent {
                        room_id: room.room_id().to_string(),
                        redacted_event_id: redacted_id,
                        sender: event.sender.to_string(),
                        reason: event.content.reason.clone(),
                    };
                    if let Err(e) = handle.emit("matrix://redaction", &payload) {
                        log::error!("Failed to emit redaction event: {}", e);
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
            move |_event: matrix_sdk::ruma::events::room::encryption::SyncRoomEncryptionEvent,
                  room: Room| {
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

        // VoIP Call Event Handlers (Phase 6)
        // m.call.invite handler
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::call::invite::SyncCallInviteEvent,
                  room: Room| {
                let handle = handle_clone.clone();
                async move {
                    if let matrix_sdk::ruma::events::SyncMessageLikeEvent::Original(original) =
                        event
                    {
                        let sdp = original.content.offer.sdp.clone();
                        let is_video = sdp.contains("m=video");
                        let payload = crate::matrix::voip::CallInviteEvent {
                            room_id: room.room_id().to_string(),
                            call_id: original.content.call_id.to_string(),
                            sender: original.sender.to_string(),
                            sender_display_name: None,
                            sdp,
                            is_video,
                            lifetime_ms: u64::from(original.content.lifetime),
                            party_id: original
                                .content
                                .party_id
                                .as_ref()
                                .map(|p| p.to_string())
                                .unwrap_or_default(),
                        };
                        if let Err(e) = handle.emit("matrix://call-invite", &payload) {
                            log::error!("Failed to emit call invite event: {}", e);
                        }
                    }
                }
            },
        );

        // m.call.answer handler
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::call::answer::SyncCallAnswerEvent,
                  room: Room| {
                let handle = handle_clone.clone();
                async move {
                    if let matrix_sdk::ruma::events::SyncMessageLikeEvent::Original(original) =
                        event
                    {
                        let payload = crate::matrix::voip::CallAnswerEvent {
                            room_id: room.room_id().to_string(),
                            call_id: original.content.call_id.to_string(),
                            sender: original.sender.to_string(),
                            sdp: original.content.answer.sdp.clone(),
                            party_id: original
                                .content
                                .party_id
                                .as_ref()
                                .map(|p| p.to_string())
                                .unwrap_or_default(),
                        };
                        if let Err(e) = handle.emit("matrix://call-answer", &payload) {
                            log::error!("Failed to emit call answer event: {}", e);
                        }
                    }
                }
            },
        );

        // m.call.candidates handler
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::call::candidates::SyncCallCandidatesEvent,
                  room: Room| {
                let handle = handle_clone.clone();
                async move {
                    if let matrix_sdk::ruma::events::SyncMessageLikeEvent::Original(original) =
                        event
                    {
                        let candidates: Vec<crate::matrix::voip::IceCandidate> = original
                            .content
                            .candidates
                            .iter()
                            .map(|c| crate::matrix::voip::IceCandidate {
                                candidate: c.candidate.clone(),
                                sdp_mid: c.sdp_mid.clone(),
                                sdp_m_line_index: c.sdp_m_line_index.map(|v| u64::from(v) as u32),
                            })
                            .collect();
                        let payload = crate::matrix::voip::CallCandidatesEvent {
                            room_id: room.room_id().to_string(),
                            call_id: original.content.call_id.to_string(),
                            sender: original.sender.to_string(),
                            candidates,
                        };
                        if let Err(e) = handle.emit("matrix://call-candidates", &payload) {
                            log::error!("Failed to emit call candidates event: {}", e);
                        }
                    }
                }
            },
        );

        // m.call.hangup handler
        let handle_clone = app_handle.clone();
        client.add_event_handler(
            move |event: matrix_sdk::ruma::events::call::hangup::SyncCallHangupEvent,
                  room: Room| {
                let handle = handle_clone.clone();
                async move {
                    if let matrix_sdk::ruma::events::SyncMessageLikeEvent::Original(original) =
                        event
                    {
                        let reason = Some(format!("{:?}", original.content.reason));
                        let payload = crate::matrix::voip::CallHangupEvent {
                            room_id: room.room_id().to_string(),
                            call_id: original.content.call_id.to_string(),
                            sender: original.sender.to_string(),
                            reason,
                        };
                        if let Err(e) = handle.emit("matrix://call-hangup", &payload) {
                            log::error!("Failed to emit call hangup event: {}", e);
                        }
                    }
                }
            },
        );
        // Emit rooms-changed on relevant sync events
        let app_handle_sync = app_handle.clone();
        client.add_event_handler(
            move |_event: matrix_sdk::ruma::events::room::member::SyncRoomMemberEvent| {
                let handle = app_handle_sync.clone();
                async move {
                    let _ = handle.emit("matrix://rooms-changed", ());
                }
            },
        );
        let app_handle_sync2 = app_handle.clone();
        client.add_event_handler(move |_event: OriginalSyncRoomMessageEvent| {
            let handle = app_handle_sync2.clone();
            async move {
                let _ = handle.emit("matrix://rooms-changed", ());
            }
        });
        // Use streaming sync - handles since tokens automatically
        tokio::spawn(async move {
            if let Err(e) = client.sync(settings).await {
                log::error!("Sync stream ended with error: {}", e);
            }
        });

        Ok(())
    }

    /// Start the sync loop (legacy, no events)
    pub async fn start_sync(&self) -> Result<(), AppError> {
        let settings = SyncSettings::default().timeout(std::time::Duration::from_secs(30));
        let client = self.client.clone();
        tokio::spawn(async move {
            if let Err(e) = client.sync(settings).await {
                log::error!("Sync stream ended with error: {}", e);
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

            // Skip per-room HTTP fetch for last message - populated via sync events
            let (last_message, last_message_timestamp): (Option<String>, Option<i64>) =
                (None, None);

            let avatar_url = room.avatar_url().map(|u| u.to_string());

            summaries.push(RoomSummary {
                room_id: room.room_id().to_string(),
                name,
                topic,
                avatar_url,
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

        let ignored_users = self.current_ignored_user_ids().await;
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
                        if ignored_users.contains(&sender) {
                            continue;
                        }
                        reaction_map
                            .entry(target)
                            .or_default()
                            .push((emoji, sender));
                    }
                    _ => {
                        if let Some(msg) = timeline_message_from_any_event(&event) {
                            if ignored_users.contains(&msg.sender) {
                                continue;
                            }
                            messages.push(msg);
                        }
                    }
                }
            }
        }

        // Attach aggregated reactions to messages
        for msg in &mut messages {
            if let Some(raw_reactions) = reaction_map.remove(&msg.event_id) {
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
            return Err(AppError::InvalidInput(
                "Message body cannot be empty".into(),
            ));
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
        let content = RoomMessageEventContent::text_plain(body).make_reply_to_raw(
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
            return Err(AppError::InvalidInput(
                "New message body cannot be empty".into(),
            ));
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

    /// Get the current ignored users list.
    pub async fn get_ignored_users(&self) -> Result<Vec<String>, AppError> {
        let content = Self::fetch_ignored_user_list_event_content(&self.client).await?;
        let ignored_user_ids = Self::sorted_ignored_user_ids(&content);

        let mut ignored_users = self.ignored_users.write().await;
        *ignored_users = ignored_user_ids.iter().cloned().collect();

        Ok(ignored_user_ids)
    }

    /// Add a user to the Matrix ignore list.
    pub async fn ignore_user(&self, user_id: &str) -> Result<Vec<String>, AppError> {
        let user_id = validate_user_id(user_id)?;
        if user_id == self.user_id {
            return Err(AppError::InvalidInput(
                "You cannot ignore your own account.".into(),
            ));
        }

        let mut content = Self::fetch_ignored_user_list_event_content(&self.client).await?;
        content
            .ignored_users
            .insert(user_id, IgnoredUser::new());

        self.client
            .account()
            .set_account_data(content.clone())
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        let ignored_user_ids = Self::sorted_ignored_user_ids(&content);
        let mut ignored_users = self.ignored_users.write().await;
        *ignored_users = Self::ignored_user_ids_from_content(&content);

        Ok(ignored_user_ids)
    }

    /// Remove a user from the Matrix ignore list.
    pub async fn unignore_user(&self, user_id: &str) -> Result<Vec<String>, AppError> {
        let user_id = validate_user_id(user_id)?;

        let mut content = Self::fetch_ignored_user_list_event_content(&self.client).await?;
        content.ignored_users.remove(&user_id);

        self.client
            .account()
            .set_account_data(content.clone())
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        let ignored_user_ids = Self::sorted_ignored_user_ids(&content);
        let mut ignored_users = self.ignored_users.write().await;
        *ignored_users = Self::ignored_user_ids_from_content(&content);

        Ok(ignored_user_ids)
    }

    /// Report a room to the homeserver.
    pub async fn report_room(&self, room_id: &str, reason: Option<&str>) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let mut request = report_room::v3::Request::new(room_id);
        request.reason = reason
            .map(str::trim)
            .filter(|reason| !reason.is_empty())
            .map(str::to_owned);

        self.client
            .send(request)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(())
    }

    /// Report a specific event in a room to the homeserver.
    pub async fn report_message(
        &self,
        room_id: &str,
        event_id: &str,
        reason: Option<&str>,
        score: Option<i32>,
    ) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let event_id = validate_event_id(event_id)?;
        let room = self.get_joined_room(&room_id)?;
        let score = match score {
            Some(score) => Some(ReportedContentScore::try_from(score).map_err(|_| {
                AppError::InvalidInput("Report score must be between -100 and 0.".into())
            })?),
            None => None,
        };

        room.report_content(
            event_id,
            score,
            reason
                .map(str::trim)
                .filter(|reason| !reason.is_empty())
                .map(str::to_owned),
        )
        .await
        .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(())
    }

    /// Report a user to the homeserver.
    pub async fn report_user(&self, user_id: &str, reason: Option<&str>) -> Result<(), AppError> {
        let user_id = validate_user_id(user_id)?;
        let request = report_user::v3::Request::new(
            user_id,
            reason
                .map(str::trim)
                .filter(|reason| !reason.is_empty())
                .unwrap_or_default()
                .to_owned(),
        );

        self.client
            .send(request)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        Ok(())
    }

    /// Search messages across rooms or in a specific room
    pub async fn search_messages(
        &self,
        room_id: Option<&str>,
        query: &str,
        limit: u32,
    ) -> Result<Vec<TimelineMessage>, AppError> {
        if query.is_empty() {
            return Err(AppError::InvalidInput(
                "Search query cannot be empty".into(),
            ));
        }

        let query_lower = query.to_lowercase();

        if let Some(rid) = room_id {
            let result = self.get_room_messages(rid, None, 200).await?;
            let filtered: Vec<TimelineMessage> = result
                .messages
                .into_iter()
                .filter(|m| m.body.to_lowercase().contains(&query_lower))
                .take(limit as usize)
                .collect();
            Ok(filtered)
        } else {
            let rooms = self.client.joined_rooms();
            let mut results = Vec::new();
            for room in rooms {
                if let Ok(room_msgs) = self
                    .get_room_messages(&room.room_id().to_string(), None, 100)
                    .await
                {
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
            return Err(AppError::InvalidInput(
                "Room ID or alias is required".into(),
            ));
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
    pub fn resolve_mxc_url(
        &self,
        mxc_url: &str,
        width: u32,
        height: u32,
    ) -> Result<String, AppError> {
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

        let request =
            matrix_sdk::ruma::api::client::profile::get_profile::v3::Request::new(parsed_user_id);
        let response = self
            .client
            .send(request)
            .await
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

    // ----------------------------------------------------------
    // Room Settings Commands (Phase 5)
    // ----------------------------------------------------------

    /// Set room name
    pub async fn set_room_name(&self, room_id: &str, name: &str) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        use matrix_sdk::ruma::events::room::name::RoomNameEventContent;
        let content = RoomNameEventContent::new(name.to_string());
        room.send_state_event(content)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Set room topic
    pub async fn set_room_topic(&self, room_id: &str, topic: &str) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        use matrix_sdk::ruma::events::room::topic::RoomTopicEventContent;
        let content = RoomTopicEventContent::new(topic.to_string());
        room.send_state_event(content)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Set room avatar from file path
    pub async fn set_room_avatar(&self, room_id: &str, file_path: &str) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;

        let mime_type = mime_guess::from_path(file_path)
            .first_or_octet_stream()
            .to_string();
        let mxc_url =
            crate::matrix::media::upload_media(&self.client, file_path, &mime_type).await?;
        let mxc_uri: matrix_sdk::ruma::OwnedMxcUri = mxc_url
            .as_str()
            .try_into()
            .map_err(|_| AppError::Internal("Invalid mxc URI from upload".into()))?;

        use matrix_sdk::ruma::events::room::avatar::RoomAvatarEventContent;
        let mut content = RoomAvatarEventContent::new();
        content.url = Some(mxc_uri);
        room.send_state_event(content)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Get room aliases
    pub async fn get_room_aliases(&self, room_id: &str) -> Result<Vec<String>, AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        let aliases = room.alt_aliases();
        let mut result: Vec<String> = aliases.iter().map(|a| a.to_string()).collect();
        if let Some(canonical) = room.canonical_alias() {
            if !result.contains(&canonical.to_string()) {
                result.insert(0, canonical.to_string());
            }
        }
        Ok(result)
    }

    /// Add a room alias
    pub async fn add_room_alias(&self, room_id: &str, alias: &str) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let alias_id: matrix_sdk::ruma::OwnedRoomAliasId = alias
            .try_into()
            .map_err(|_| AppError::InvalidInput("Invalid room alias format".into()))?;
        let request =
            matrix_sdk::ruma::api::client::alias::create_alias::v3::Request::new(alias_id, room_id);
        self.client
            .send(request)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Remove a room alias
    pub async fn remove_room_alias(&self, alias: &str) -> Result<(), AppError> {
        let alias_id: matrix_sdk::ruma::OwnedRoomAliasId = alias
            .try_into()
            .map_err(|_| AppError::InvalidInput("Invalid room alias format".into()))?;
        let request =
            matrix_sdk::ruma::api::client::alias::delete_alias::v3::Request::new(alias_id);
        self.client
            .send(request)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Set canonical alias for a room
    pub async fn set_canonical_alias(&self, room_id: &str, alias: &str) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        let alias_id: matrix_sdk::ruma::OwnedRoomAliasId = alias
            .try_into()
            .map_err(|_| AppError::InvalidInput("Invalid room alias format".into()))?;
        use matrix_sdk::ruma::events::room::canonical_alias::RoomCanonicalAliasEventContent;
        let mut content = RoomCanonicalAliasEventContent::new();
        content.alias = Some(alias_id);
        room.send_state_event(content)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    // ----------------------------------------------------------
    // Power Levels & Moderation (Phase 5)
    // ----------------------------------------------------------

    /// Get power levels for a room
    pub async fn get_power_levels(&self, room_id: &str) -> Result<PowerLevelInfo, AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        use matrix_sdk::ruma::events::room::power_levels::RoomPowerLevelsEventContent;
        let pl_event = room
            .get_state_event_static::<RoomPowerLevelsEventContent>()
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        if let Some(raw) = pl_event {
            let event = raw
                .deserialize()
                .map_err(|e| AppError::Matrix(e.to_string()))?;
            use matrix_sdk::deserialized_responses::SyncOrStrippedState;
            let content = match event {
                SyncOrStrippedState::Sync(ref s) => s.as_original().map(|o| o.content.clone()),
                SyncOrStrippedState::Stripped(ref s) => Some(s.content.clone()),
            };
            if let Some(c) = content {
                let user_levels: HashMap<String, i64> = c
                    .users
                    .iter()
                    .map(
                        |(uid, pl): (&matrix_sdk::ruma::OwnedUserId, &matrix_sdk::ruma::Int)| {
                            (uid.to_string(), i64::from(*pl))
                        },
                    )
                    .collect();
                return Ok(PowerLevelInfo {
                    users_default: i64::from(c.users_default),
                    events_default: i64::from(c.events_default),
                    state_default: i64::from(c.state_default),
                    ban: i64::from(c.ban),
                    kick: i64::from(c.kick),
                    invite: i64::from(c.invite),
                    redact: i64::from(c.redact),
                    user_levels,
                });
            }
        }
        Ok(PowerLevelInfo {
            users_default: 0,
            events_default: 0,
            state_default: 50,
            ban: 50,
            kick: 50,
            invite: 0,
            redact: 50,
            user_levels: HashMap::new(),
        })
    }

    /// Set a user's power level
    pub async fn set_user_power_level(
        &self,
        room_id: &str,
        user_id: &str,
        level: i64,
    ) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        let uid: OwnedUserId = user_id
            .try_into()
            .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
        use matrix_sdk::ruma::events::room::power_levels::RoomPowerLevelsEventContent;
        let pl_event = room
            .get_state_event_static::<RoomPowerLevelsEventContent>()
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        let mut content = if let Some(raw) = pl_event {
            let event = raw
                .deserialize()
                .map_err(|e| AppError::Matrix(e.to_string()))?;
            use matrix_sdk::deserialized_responses::SyncOrStrippedState;
            match event {
                SyncOrStrippedState::Sync(ref s) => s
                    .as_original()
                    .map(|o| o.content.clone())
                    .unwrap_or_default(),
                SyncOrStrippedState::Stripped(ref s) => s.content.clone(),
            }
        } else {
            RoomPowerLevelsEventContent::default()
        };
        use matrix_sdk::ruma::Int;
        content
            .users
            .insert(uid, Int::new(level).unwrap_or(Int::MIN));
        room.send_state_event(content)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Kick a user from a room
    pub async fn kick_user(
        &self,
        room_id: &str,
        user_id: &str,
        reason: Option<&str>,
    ) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        let uid: OwnedUserId = user_id
            .try_into()
            .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
        room.kick_user(&uid, reason)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Ban a user from a room
    pub async fn ban_user(
        &self,
        room_id: &str,
        user_id: &str,
        reason: Option<&str>,
    ) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        let uid: OwnedUserId = user_id
            .try_into()
            .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
        room.ban_user(&uid, reason)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Unban a user from a room
    pub async fn unban_user(&self, room_id: &str, user_id: &str) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        let uid: OwnedUserId = user_id
            .try_into()
            .map_err(|_| AppError::InvalidInput("Invalid user ID".into()))?;
        room.unban_user(&uid, None)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Get banned users in a room
    pub async fn get_banned_users(&self, room_id: &str) -> Result<Vec<BannedUser>, AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        use matrix_sdk::ruma::events::room::member::{MembershipState, RoomMemberEventContent};
        let members = room
            .get_state_events_static::<RoomMemberEventContent>()
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        let mut banned = Vec::new();
        for raw in members {
            if let Ok(event) = raw.deserialize() {
                use matrix_sdk::deserialized_responses::SyncOrStrippedState;
                let (user_id, content) = match &event {
                    SyncOrStrippedState::Sync(s) => {
                        if let Some(orig) = s.as_original() {
                            (orig.state_key.to_string(), Some(orig.content.clone()))
                        } else {
                            continue;
                        }
                    }
                    SyncOrStrippedState::Stripped(s) => {
                        (s.state_key.to_string(), Some(s.content.clone()))
                    }
                };
                if let Some(c) = content {
                    if c.membership == MembershipState::Ban {
                        banned.push(BannedUser {
                            user_id,
                            reason: c.reason.clone(),
                        });
                    }
                }
            }
        }
        Ok(banned)
    }

    /// Set server ACL for a room
    pub async fn set_server_acl(
        &self,
        room_id: &str,
        allow: Vec<String>,
        deny: Vec<String>,
    ) -> Result<(), AppError> {
        let room_id = validate_room_id(room_id)?;
        let room = self.get_joined_room(&room_id)?;
        use matrix_sdk::ruma::events::room::server_acl::RoomServerAclEventContent;
        let mut content = RoomServerAclEventContent::new(false, vec![], vec![]);
        content.allow = allow;
        content.deny = deny;
        room.send_state_event(content)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(())
    }

    /// Upgrade room to a new version
    pub async fn upgrade_room(&self, room_id: &str, new_version: &str) -> Result<String, AppError> {
        let room_id = validate_room_id(room_id)?;
        let version: matrix_sdk::ruma::RoomVersionId = new_version.try_into().map_err(|_| {
            AppError::InvalidInput(format!("Invalid room version: {}", new_version))
        })?;
        let request =
            matrix_sdk::ruma::api::client::room::upgrade_room::v3::Request::new(room_id, version);
        let response = self
            .client
            .send(request)
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;
        Ok(response.replacement_room.to_string())
    }
}

/// Convert a sync room message event to our TimelineMessage
fn timeline_message_from_sync_event(event: &OriginalSyncRoomMessageEvent) -> TimelineMessage {
    let (body, formatted_body, msg_type, media_url, media_info) =
        extract_message_content(&event.content.msgtype);

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
        event_id: event.event_id.to_string(),
        sender: event.sender.to_string(),
        sender_name: None, // Resolved by frontend or room member lookup
        body,
        formatted_body,
        timestamp: event.origin_server_ts.0.into(),
        is_edited,
        is_redacted: false,
        reply_to,
        reactions: Vec::new(),
        msg_type,
        replaces,
        avatar_url: None,
        media_url,
        media_info,
    }
}

/// Convert any timeline event to TimelineMessage (for pagination)
fn timeline_message_from_any_event(event: &AnyTimelineEvent) -> Option<TimelineMessage> {
    match event {
        AnyTimelineEvent::MessageLike(msg_event) => match msg_event {
            AnyMessageLikeEvent::RoomMessage(MessageLikeEvent::Original(original)) => {
                let (body, formatted_body, msg_type, media_url, media_info) =
                    extract_message_content(&original.content.msgtype);

                let reply_to = match &original.content.relates_to {
                    Some(Relation::Reply { in_reply_to }) => Some(in_reply_to.event_id.to_string()),
                    _ => None,
                };

                let is_edited =
                    matches!(&original.content.relates_to, Some(Relation::Replacement(_)));

                let replaces = match &original.content.relates_to {
                    Some(Relation::Replacement(replacement)) => {
                        Some(replacement.event_id.to_string())
                    }
                    _ => None,
                };

                Some(TimelineMessage {
                    event_id: original.event_id.to_string(),
                    sender: original.sender.to_string(),
                    sender_name: None,
                    body,
                    formatted_body,
                    timestamp: original.origin_server_ts.0.into(),
                    is_edited,
                    is_redacted: false,
                    reply_to,
                    reactions: Vec::new(),
                    msg_type,
                    replaces,
                    avatar_url: None,
                    media_url,
                    media_info,
                })
            }
            _ => None,
        },
        _ => None,
    }
}
/// Extract body, formatted_body, msg_type, media_url, and media_info from MessageType
fn extract_message_content(
    msgtype: &MessageType,
) -> (
    String,
    Option<String>,
    String,
    Option<String>,
    Option<MediaInfo>,
) {
    match msgtype {
        MessageType::Text(text) => {
            let formatted = text.formatted.as_ref().map(|f| f.body.clone());
            (text.body.clone(), formatted, "m.text".into(), None, None)
        }
        MessageType::Notice(notice) => {
            let formatted = notice.formatted.as_ref().map(|f| f.body.clone());
            (
                notice.body.clone(),
                formatted,
                "m.notice".into(),
                None,
                None,
            )
        }
        MessageType::Emote(emote) => {
            let formatted = emote.formatted.as_ref().map(|f| f.body.clone());
            (emote.body.clone(), formatted, "m.emote".into(), None, None)
        }
        MessageType::Image(img) => {
            let url = extract_media_source_url(&img.source);
            let thumb_url = img
                .info
                .as_ref()
                .and_then(|i| i.thumbnail_source.as_ref())
                .and_then(extract_media_source_url_opt);
            let info = img.info.as_ref().map(|i| MediaInfo {
                mimetype: i.mimetype.as_ref().map(|m| m.to_string()),
                size: i.size.map(|s| s.into()),
                width: i.width.map(|w| u64::from(w) as u32),
                height: i.height.map(|h| u64::from(h) as u32),
                duration_ms: None,
                thumbnail_url: thumb_url,
                filename: Some(img.body.clone()),
            });
            (img.body.clone(), None, "m.image".into(), url, info)
        }
        MessageType::Video(video) => {
            let url = extract_media_source_url(&video.source);
            let thumb_url = video
                .info
                .as_ref()
                .and_then(|i| i.thumbnail_source.as_ref())
                .and_then(extract_media_source_url_opt);
            let info = video.info.as_ref().map(|i| MediaInfo {
                mimetype: i.mimetype.as_ref().map(|m| m.to_string()),
                size: i.size.map(|s| s.into()),
                width: i.width.map(|w| u64::from(w) as u32),
                height: i.height.map(|h| u64::from(h) as u32),
                duration_ms: i.duration.map(|d| d.as_millis() as u64),
                thumbnail_url: thumb_url,
                filename: Some(video.body.clone()),
            });
            (video.body.clone(), None, "m.video".into(), url, info)
        }
        MessageType::Audio(audio) => {
            let url = extract_media_source_url(&audio.source);
            let info = audio.info.as_ref().map(|i| MediaInfo {
                mimetype: i.mimetype.as_ref().map(|m| m.to_string()),
                size: i.size.map(|s| s.into()),
                width: None,
                height: None,
                duration_ms: i.duration.map(|d| d.as_millis() as u64),
                thumbnail_url: None,
                filename: Some(audio.body.clone()),
            });
            (audio.body.clone(), None, "m.audio".into(), url, info)
        }
        MessageType::File(file) => {
            let url = extract_media_source_url(&file.source);
            let info = file.info.as_ref().map(|i| MediaInfo {
                mimetype: i.mimetype.as_ref().map(|m| m.to_string()),
                size: i.size.map(|s| s.into()),
                width: None,
                height: None,
                duration_ms: None,
                thumbnail_url: None,
                filename: Some(file.body.clone()),
            });
            (file.body.clone(), None, "m.file".into(), url, info)
        }
        _ => (
            "Unsupported message type".into(),
            None,
            "unknown".into(),
            None,
            None,
        ),
    }
}

fn extract_media_source_url(source: &MediaSource) -> Option<String> {
    match source {
        MediaSource::Plain(uri) => Some(uri.to_string()),
        MediaSource::Encrypted(encrypted) => Some(encrypted.url.to_string()),
    }
}

fn extract_media_source_url_opt(source: &MediaSource) -> Option<String> {
    extract_media_source_url(source)
}

fn get_data_dir_for_user(user_id: Option<&str>) -> PathBuf {
    let mut dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("pufferchat");
    dir.push("matrix-store");
    if let Some(uid) = user_id {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        uid.hash(&mut hasher);
        dir.push(format!("{:016x}", hasher.finish()));
    }
    std::fs::create_dir_all(&dir).ok();
    dir
}

fn get_or_create_db_passphrase_for_user(user_id: Option<&str>) -> Result<String, AppError> {
    use crate::store::keychain;
    use zeroize::Zeroize;

    let key = match user_id {
        Some(uid) => format!("db_passphrase_{}", uid),
        None => "db_passphrase".to_string(),
    };

    if let Some(passphrase) = keychain::get_secret(&key)? {
        return Ok(passphrase);
    }

    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes)
        .map_err(|e| AppError::Internal(format!("RNG failure: {}", e)))?;
    let passphrase = hex::encode(bytes);
    bytes.zeroize();

    keychain::store_secret(&key, &passphrase)?;
    Ok(passphrase)
}

/// Clear the local crypto/state store directory for a specific user or the shared store.
pub fn clear_crypto_store_for_user(user_id: Option<&str>) -> Result<(), AppError> {
    let dir = get_data_dir_for_user(user_id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir)
            .map_err(|e| AppError::Internal(format!("Failed to clear crypto store: {}", e)))?;
        log::info!("Cleared crypto store at {:?}", dir);
    }
    Ok(())
}

/// Clear the local crypto/state store directory (shared/default).
pub fn clear_crypto_store() -> Result<(), AppError> {
    clear_crypto_store_for_user(None)
}

/// Clear the db passphrase from keychain for a specific user or the default.
pub fn clear_db_passphrase_for_user(user_id: Option<&str>) -> Result<(), AppError> {
    use crate::store::keychain;
    let key = match user_id {
        Some(uid) => format!("db_passphrase_{}", uid),
        None => "db_passphrase".to_string(),
    };
    keychain::delete_secret(&key)?;
    Ok(())
}

/// Clear the db passphrase from keychain (default).
pub fn clear_db_passphrase() -> Result<(), AppError> {
    clear_db_passphrase_for_user(None)
}

// ----------------------------------------------------------
// Power Levels & Moderation (Phase 5)
// ----------------------------------------------------------

/// Power level information for a room
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PowerLevelInfo {
    pub users_default: i64,
    pub events_default: i64,
    pub state_default: i64,
    pub ban: i64,
    pub kick: i64,
    pub invite: i64,
    pub redact: i64,
    pub user_levels: HashMap<String, i64>,
}

/// A banned user entry
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BannedUser {
    pub user_id: String,
    pub reason: Option<String>,
}
