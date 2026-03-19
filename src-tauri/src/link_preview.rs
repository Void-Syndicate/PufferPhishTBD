use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkPreview {
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub site_name: Option<String>,
}

fn extract_og_tag(html: &str, property: &str) -> Option<String> {
    let pattern = format!(r#"property="{property}""#);
    let alt_pattern = format!(r#"property='{property}'"#);

    let find_content = |start_pos: usize| -> Option<String> {
        let after = &html[start_pos..];
        // Find the enclosing <meta ... > tag content attribute
        let content_markers = ["content=\"", "content='"];
        for marker in content_markers {
            if let Some(c_pos) = after.find(marker) {
                // Make sure we're still within the same tag (before next >)
                let tag_end = after.find('>')?;
                if c_pos < tag_end {
                    let val_start = c_pos + marker.len();
                    let quote = marker.chars().last().unwrap();
                    let val_end = after[val_start..].find(quote)?;
                    let value = &after[val_start..val_start + val_end];
                    if !value.is_empty() {
                        return Some(html_escape_decode(value));
                    }
                }
            }
        }
        None
    };

    if let Some(pos) = html.find(&pattern) {
        if let Some(v) = find_content(pos.saturating_sub(200).max(html[..pos].rfind('<').unwrap_or(0))) {
            return Some(v);
        }
    }
    if let Some(pos) = html.find(&alt_pattern) {
        if let Some(v) = find_content(pos.saturating_sub(200).max(html[..pos].rfind('<').unwrap_or(0))) {
            return Some(v);
        }
    }

    // Try content before property (common ordering: <meta content="..." property="og:...">)
    None
}

fn html_escape_decode(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
}

#[tauri::command]
pub async fn fetch_link_preview(url: String) -> Result<LinkPreview, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .header("User-Agent", "PufferChat/1.0 LinkPreview Bot")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let html = resp.text().await.map_err(|e| e.to_string())?;

    // Limit parsing to first 50KB
    let html = if html.len() > 50_000 {
        &html[..50_000]
    } else {
        &html
    };

    let title = extract_og_tag(html, "og:title").or_else(|| {
        // Fallback: extract <title>
        html.find("<title>").and_then(|start| {
            let s = start + 7;
            html[s..].find("</title>").map(|end| html_escape_decode(&html[s..s + end]))
        })
    });

    let description = extract_og_tag(html, "og:description");
    let image_url = extract_og_tag(html, "og:image");
    let site_name = extract_og_tag(html, "og:site_name");

    Ok(LinkPreview {
        url,
        title,
        description,
        image_url,
        site_name,
    })
}
