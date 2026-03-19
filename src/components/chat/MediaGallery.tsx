import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import styles from "./MediaGallery.module.css";

interface MediaGalleryProps {
  roomId: string;
  onClose: () => void;
}

type TabType = "all" | "images" | "videos" | "files";

interface MediaItem {
  eventId: string;
  msgtype: string;
  body: string;
  url?: string;       // mxc:// URL
  thumbnailUrl?: string;
  size?: number;
  sender: string;
  timestamp: number;
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
        // Fetch a large batch of messages to find media
        const result: { messages: any[]; end?: string } = await invoke("get_room_messages", {
          roomId,
          from: null,
          limit: 100,
        });
        if (cancelled) return;

        const mediaTypes = ["m.image", "m.video", "m.audio", "m.file"];
        const items: MediaItem[] = result.messages
          .filter((m: any) => m.content?.msgtype && mediaTypes.includes(m.content.msgtype))
          .map((m: any) => ({
            eventId: m.event_id || m.eventId,
            msgtype: m.content.msgtype,
            body: m.content.body || "Untitled",
            url: m.content.url,
            thumbnailUrl: m.content.info?.thumbnail_url,
            size: m.content.info?.size,
            sender: m.sender,
            timestamp: m.origin_server_ts || m.timestamp || 0,
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
      .filter((m) => m.url && !resolvedUrls[m.url])
      .map((m) => m.url!);

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
      case "images": return media.filter((m) => m.msgtype === "m.image");
      case "videos": return media.filter((m) => m.msgtype === "m.video");
      case "files":  return media.filter((m) => m.msgtype === "m.file" || m.msgtype === "m.audio");
      default:       return media;
    }
  }, [media, tab]);

  const isVisual = (m: MediaItem) => m.msgtype === "m.image" || m.msgtype === "m.video";

  const handleThumbClick = async (item: MediaItem) => {
    if (!item.url) return;
    try {
      const fullUrl: string = await invoke("resolve_mxc_url", {
        mxcUrl: item.url,
        width: 1200,
        height: 1200,
      });
      setLightboxUrl(fullUrl);
    } catch {
      // fallback to thumbnail
      if (item.url && resolvedUrls[item.url]) {
        setLightboxUrl(resolvedUrls[item.url]);
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
          <span>?? Media Gallery</span>
          <button className={styles.closeBtn} onClick={onClose}>?</button>
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
                  src={item.url ? resolvedUrls[item.url] || "" : ""}
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
                        {item.msgtype === "m.audio" ? "??" : "??"}
                      </span>
                      <span className={styles.fileName}>{item.body}</span>
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
                    {item.msgtype === "m.audio" ? "??" : item.msgtype === "m.video" ? "??" : "??"}
                  </span>
                  <span className={styles.fileName}>{item.body}</span>
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
