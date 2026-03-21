use matrix_sdk::Client;
use matrix_sdk::media::{MediaFormat, MediaRequestParameters, MediaThumbnailSettings};
use matrix_sdk::ruma::events::room::MediaSource;
use matrix_sdk::ruma::UInt;
use std::path::Path;

use crate::error::AppError;

/// Upload a file to the Matrix media repository
pub async fn upload_media(
    client: &Client,
    file_path: &str,
    mime_type: &str,
) -> Result<String, AppError> {
    let path = Path::new(file_path);
    let data = tokio::fs::read(path)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read file: {}", e)))?;

    let content_type: mime::Mime = mime_type
        .parse()
        .unwrap_or(mime::APPLICATION_OCTET_STREAM);

    let response = client
        .media()
        .upload(&content_type, data, None)
        .await
        .map_err(|e| AppError::Matrix(format!("Upload failed: {}", e)))?;

    Ok(response.content_uri.to_string())
}

/// Download media from an mxc URL to a local file
pub async fn download_media(
    client: &Client,
    mxc_url: &str,
    save_path: &str,
) -> Result<(), AppError> {
    let mxc_uri: matrix_sdk::ruma::OwnedMxcUri = mxc_url
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid mxc URL".into()))?;

    let source = MediaSource::Plain(mxc_uri);
    let request = MediaRequestParameters {
        source,
        format: MediaFormat::File,
    };

    let data = client
        .media()
        .get_media_content(&request, true)
        .await
        .map_err(|e| AppError::Matrix(format!("Download failed: {}", e)))?;

    tokio::fs::write(save_path, &data)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write file: {}", e)))?;

    Ok(())
}

/// Get thumbnail bytes for a media item
pub async fn get_media_thumbnail(
    client: &Client,
    mxc_url: &str,
    width: u32,
    height: u32,
) -> Result<Vec<u8>, AppError> {
    let mxc_uri: matrix_sdk::ruma::OwnedMxcUri = mxc_url
        .try_into()
        .map_err(|_| AppError::InvalidInput("Invalid mxc URL".into()))?;

    let source = MediaSource::Plain(mxc_uri);
    let settings = MediaThumbnailSettings::with_method(
        matrix_sdk::ruma::api::client::media::get_content_thumbnail::v3::Method::Crop,
        UInt::from(width),
        UInt::from(height),
    );
    let request = MediaRequestParameters {
        source,
        format: MediaFormat::Thumbnail(settings),
    };

    let data = client
        .media()
        .get_media_content(&request, true)
        .await
        .map_err(|e| AppError::Matrix(format!("Thumbnail fetch failed: {}", e)))?;

    Ok(data)
}

/// Resolve an mxc URL to a full-resolution HTTP download URL
pub fn resolve_mxc_to_http(client: &Client, mxc_url: &str) -> Result<String, AppError> {
    if !mxc_url.starts_with("mxc://") {
        return Err(AppError::InvalidInput("Not an mxc:// URL".into()));
    }
    let path = &mxc_url[6..];
    let homeserver = client.homeserver().to_string();
    let homeserver = homeserver.trim_end_matches('/');
    Ok(format!(
        "{}/_matrix/media/v3/download/{}",
        homeserver, path
    ))
}
