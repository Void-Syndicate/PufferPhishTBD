import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import styles from "./MediaGallery.module.css";

interface MediaGalleryProps {
  roomId: string;
  onClose: () => void;
}

type TabType = "all" | "images" | "videos" | "files";

interface TimelineMessage {
  id: string;
  sender: string;
  body: string;
  formattedBody: string | null;
  timestamp: number;
  isEdited: boolean;
  replyTo: string | null;
  reactions: any[];
  msgType: string;
  replaces: string | null;
  avatarUrl: string | null;
  mediaUrl: string | null;
  mediaInfo: {
    mimetype: string | null;
    size: number | null;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    thumbnailUrl: string | null;
    filename: string | null;
  } | null;
}

interface PaginationResult {
  messages: TimelineMessage[];
  endToken: string | null;
  hasMore: boolean;
}

interface MediaItem {
  eventId: string;
  msgType: string;
  body: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  size: number | null;
  sender: string;
  timestamp: number;
  filename: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaGallery({ roomId, onClose }: MediaGalleryProps) {
  const [tab, setTab] = useState<TabType>("all");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  // Fetch room messages and filter media
  useEffect(() => {
    let cancelled = false;
    async function fetchMedia() {
      setLoading(true);
      try {
        const result = await invoke<PaginationResult>("get_room_messages", {
          roomId,
          from: null,
          limit: 100,
        });
        if (cancelled) return;

        const mediaTypes = ["m.image", "m.video", "m.audio", "m.file"];
        const items: MediaItem[] = result.messages
          .filter((m) => mediaTypes.includes(m.msgType))
          .map((m) => ({
            eventId: m.id,
            msgType: m.msgType,
            body: m.body || "Untitled",
            mediaUrl: m.mediaUrl,
            thumbnailUrl: m.mediaInfo?.thumbnailUrl || null,
            size: m.mediaInfo?.size || null,
            sender: m.sender,
            timestamp: m.timestamp,
            filename: m.mediaInfo?.filename || m.body,
          }));

        setMedia(items);
      } catch (e) {
        console.error("Failed to fetch media:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchMedia();
    return () => { cancelled = true; };
  }, [roomId]);

  // Resolve mxc URLs to HTTP
  useEffect(() => {
    const urlsToResolve = media
      .filter((m) => m.mediaUrl && !resolvedUrls[m.mediaUrl])
      .map((m) => m.mediaUrl!);

    const unique = [...new Set(urlsToResolve)];
    if (unique.length === 0) return;

    unique.forEach(async (mxcUrl) => {
      try {
        const httpUrl: string = await invoke("resolve_mxc_url", {
          mxcUrl,
          width: 200,
          height: 200,
        });
        setResolvedUrls((prev) => ({ ...prev, [mxcUrl]: httpUrl }));
      } catch {
        // skip
      }
    });
  }, [media, resolvedUrls]);

  const filtered = useMemo(() => {
    switch (tab) {
      case "images": return media.filter((m) => m.msgType === "m.image");
      case "videos": return media.filter((m) => m.msgType === "m.video");
      case "files":  return media.filter((m) => m.msgType === "m.file" || m.msgType === "m.audio");
      default:       return media;
    }
  }, [media, tab]);

  const isVisual = (m: MediaItem) => m.msgType === "m.image" || m.msgType === "m.video";

  const handleThumbClick = async (item: MediaItem) => {
    if (!item.mediaUrl) return;
    try {
      const fullUrl: string = await invoke("resolve_mxc_url", {
        mxcUrl: item.mediaUrl,
        width: 1200,
        height: 1200,
      });
      setLightboxUrl(fullUrl);
    } catch {
      // fallback to thumbnail
      if (item.mediaUrl && resolvedUrls[item.mediaUrl]) {
        setLightboxUrl(resolvedUrls[item.mediaUrl]);
      }
    }
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "images", label: "Images" },
    { key: "videos", label: "Videos" },
    { key: "files", label: "Files" },
  ];

  const showGrid = tab !== "files";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.titleBar}>
          <span>&#x1F5BC; Media Gallery</span>
          <button className={styles.closeBtn} onClick={onClose}>&#x2716;</button>
        </div>

        <div className={styles.tabBar}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.empty}>Loading media...</div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>No media found in this room.</div>
          ) : showGrid ? (
            <div className={styles.grid}>
              {filtered.filter(isVisual).map((item) => (
                <img
                  key={item.eventId}
                  className={styles.thumb}
                  src={item.mediaUrl ? resolvedUrls[item.mediaUrl] || "" : ""}
                  alt={item.body}
                  title={item.body}
                  onClick={() => handleThumbClick(item)}
                  loading="lazy"
                />
              ))}
              {/* Non-visual items in "all" tab shown as list below */}
              {tab === "all" && filtered.filter((m) => !isVisual(m)).length > 0 && (
                <div className={styles.fileList} style={{ gridColumn: "1 / -1" }}>
                  {filtered.filter((m) => !isVisual(m)).map((item) => (
                    <div key={item.eventId} className={styles.fileRow}>
                      <span className={styles.fileIcon}>
                        {item.msgType === "m.audio" ? "\u{1F3B5}" : "\u{1F4C4}"}
                      </span>
                      <span className={styles.fileName}>{item.filename || item.body}</span>
                      {item.size && <span className={styles.fileSize}>{formatBytes(item.size)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.fileList}>
              {filtered.map((item) => (
                <div key={item.eventId} className={styles.fileRow}>
                  <span className={styles.fileIcon}>
                    {item.msgType === "m.audio" ? "\u{1F3B5}" : item.msgType === "m.video" ? "\u{1F3AC}" : "\u{1F4C4}"}
                  </span>
                  <span className={styles.fileName}>{item.filename || item.body}</span>
                  {item.size && <span className={styles.fileSize}>{formatBytes(item.size)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {lightboxUrl && (
        <div className={styles.lightbox} onClick={() => setLightboxUrl(null)}>
          <img
            className={styles.lightboxImg}
            src={lightboxUrl}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
