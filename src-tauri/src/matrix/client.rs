use anyhow::Result;
use matrix_sdk::{
    config::SyncSettings,
    ruma::{
        api::client::session::login::v3::Response as LoginResponse,
        OwnedUserId,
    },
    Client,
};
use serde::Serialize;
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
    pub access_token: String,
    pub device_id: String,
}

#[derive(Serialize, Clone)]
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

impl MatrixClient {
    /// Create a new Matrix client and log in with password
    pub async fn login(
        homeserver: &str,
        username: &str,
        mut password: String,
    ) -> Result<(Self, LoginResult), AppError> {
        // Build client with SQLite store for persistence
        let data_dir = get_data_dir();
        
        let client = Client::builder()
            .homeserver_url(homeserver)
            .sqlite_store(&data_dir, None)
            .build()
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        // Login with password
        let response = client
            .matrix_auth()
            .login_username(username, &password)
            .initial_device_display_name("PufferChat")
            .await
            .map_err(|e| AppError::Auth(e.to_string()))?;

        // Zeroize password from memory immediately
        password.zeroize();

        let user_id = response.user_id.clone();

        // Get display name
        let display_name = client
            .account()
            .get_display_name()
            .await
            .ok()
            .flatten()
            .map(|n| n.to_string());

        let result = LoginResult {
            user_id: user_id.to_string(),
            display_name,
            access_token: response.access_token.to_string(),
            device_id: response.device_id.to_string(),
        };

        let matrix_client = Self {
            client,
            user_id,
        };

        Ok((matrix_client, result))
    }

    /// Restore session from stored access token
    pub async fn restore(
        homeserver: &str,
        access_token: &str,
        user_id: &str,
        device_id: &str,
    ) -> Result<Self, AppError> {
        let data_dir = get_data_dir();

        let client = Client::builder()
            .homeserver_url(homeserver)
            .sqlite_store(&data_dir, None)
            .build()
            .await
            .map_err(|e| AppError::Matrix(e.to_string()))?;

        // Restore the session
        let session = matrix_sdk::matrix_auth::MatrixSession {
            meta: matrix_sdk::SessionMeta {
                user_id: user_id.try_into().map_err(|e: matrix_sdk::ruma::IdParseError| AppError::Auth(e.to_string()))?,
                device_id: device_id.try_into().map_err(|e: matrix_sdk::ruma::IdParseError| AppError::Auth(e.to_string()))?,
            },
            tokens: matrix_sdk::matrix_auth::MatrixSessionTokens {
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

    /// Start the sync loop
    pub async fn start_sync(&self) -> Result<(), AppError> {
        let settings = SyncSettings::default();
        
        // Spawn sync in background
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
            
            let member_count = room
                .joined_members_count();

            summaries.push(RoomSummary {
                room_id: room.room_id().to_string(),
                name,
                topic,
                avatar_url: None, // TODO: resolve avatar URL
                is_direct,
                is_encrypted,
                unread_count: unread.notification_count,
                highlight_count: unread.highlight_count,
                last_message: None, // TODO: get last message from timeline
                last_message_timestamp: None,
                member_count,
            });
        }

        // Sort: unread first, then alphabetical
        summaries.sort_by(|a, b| {
            b.unread_count
                .cmp(&a.unread_count)
                .then_with(|| a.name.cmp(&b.name))
        });

        Ok(summaries)
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

/// Get the data directory for PufferChat storage
fn get_data_dir() -> PathBuf {
    let mut dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("pufferchat");
    dir.push("matrix-store");
    std::fs::create_dir_all(&dir).ok();
    dir
}
