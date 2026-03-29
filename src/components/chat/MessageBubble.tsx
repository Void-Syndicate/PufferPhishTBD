import DOMPurify from "dompurify";
import React, { useMemo, useEffect } from "react";
import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { TimelineMessage, useMessagesStore } from "../../stores/messages";
import { useAuthStore } from "../../stores/auth";
import { useReadReceiptStore } from "../../stores/readReceipts";
import { useEncryptionStore } from "../../stores/encryption";
import { useEncryption } from "../../hooks/useEncryption";
import { useModeration } from "../../hooks/useModeration";
import { useModerationStore } from "../../stores/moderation";
import ReactionPicker from "./ReactionPicker";
import Avatar from "../retro/Avatar";
import ModerationDialog from "../moderation/ModerationDialog";
import styles from "./MessageBubble.module.css";

interface MessageBubbleProps {
  message: TimelineMessage;
  roomId: string;
}

function MediaImage({ message }: { message: TimelineMessage }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (!message.mediaUrl) return;
    invoke<string>("resolve_mxc_url", { mxcUrl: message.mediaUrl, width: 320, height: 240 })
      .then(setThumbUrl)
      .catch(() => {});
  }, [message.mediaUrl]);

  const openLightbox = async () => {
    if (!message.mediaUrl) return;
    if (!fullUrl) {
      try {
        const url = await invoke<string>("resolve_mxc_full_url", { mxcUrl: message.mediaUrl });
        setFullUrl(url);
      } catch { /* ignore */ }
    }
    setLightbox(true);
  };

  return (
    <>
      <div className={styles.mediaImage} onClick={openLightbox}>
        {thumbUrl ? (
          <img src={thumbUrl} alt={message.body} className={styles.mediaThumbnail} />
        ) : (
          <div className={styles.mediaPlaceholder}>&#x1F5BC; {message.body}</div>
        )}
      </div>
      {lightbox && (
        <div className={styles.lightboxOverlay} onClick={() => setLightbox(false)}>
          <div className={styles.lightboxWindow} onClick={(e) => e.stopPropagation()}>
            <div className={styles.lightboxTitleBar}>
              <span>{message.mediaInfo?.filename || message.body}</span>
              <button className={styles.lightboxClose} onClick={() => setLightbox(false)}>&#x2716;</button>
            </div>
            <div className={styles.lightboxContent}>
              <img src={fullUrl || thumbUrl || ""} alt={message.body} className={styles.lightboxImage} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MediaVideo({ message }: { message: TimelineMessage }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!message.mediaUrl) return;
    invoke<string>("resolve_mxc_full_url", { mxcUrl: message.mediaUrl })
      .then(setVideoUrl)
      .catch(() => {});
  }, [message.mediaUrl]);

  if (!videoUrl) return <div className={styles.mediaPlaceholder}>&#x1F3AC; {message.body}</div>;

  return (
    <div className={styles.mediaVideo}>
      <video controls className={styles.videoPlayer} preload="metadata">
        <source src={videoUrl} type={message.mediaInfo?.mimetype || "video/mp4"} />
        Your browser does not support video.
      </video>
      <div className={styles.mediaLabel}>{message.body}</div>
    </div>
  );
}

function MediaAudio({ message }: { message: TimelineMessage }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!message.mediaUrl) return;
    invoke<string>("resolve_mxc_full_url", { mxcUrl: message.mediaUrl })
      .then(setAudioUrl)
      .catch(() => {});
  }, [message.mediaUrl]);

  if (!audioUrl) return <div className={styles.mediaPlaceholder}>&#x1F3B5; {message.body}</div>;

  return (
    <div className={styles.mediaAudio}>
      <div className={styles.audioHeader}>&#x1F3B5; {message.body}</div>
      <audio controls className={styles.audioPlayer} preload="metadata">
        <source src={audioUrl} type={message.mediaInfo?.mimetype || "audio/mpeg"} />
        Your browser does not support audio.
      </audio>
      {message.mediaInfo?.durationMs && (
        <div className={styles.mediaMeta}>
          Duration: {Math.round(message.mediaInfo.durationMs / 1000)}s
        </div>
      )}
    </div>
  );
}

function MediaFile({ message }: { message: TimelineMessage }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!message.mediaUrl) return;
    setDownloading(true);
    try {
      const filename = message.mediaInfo?.filename || message.body || "file";
      const savePath = await save({ defaultPath: filename, title: "Save File" });
      if (!savePath) return; // User cancelled
      await invoke("download_media", { mxcUrl: message.mediaUrl, savePath });
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setDownloading(false);
    }
  };

  const sizeStr = message.mediaInfo?.size
    ? message.mediaInfo.size > 1048576
      ? `${(message.mediaInfo.size / 1048576).toFixed(1)} MB`
      : `${(message.mediaInfo.size / 1024).toFixed(1)} KB`
    : "";

  return (
    <div className={styles.mediaFile}>
      <div className={styles.fileIcon}>&#x1F4C4;</div>
      <div className={styles.fileDetails}>
        <div className={styles.fileName}>{message.mediaInfo?.filename || message.body}</div>
        {sizeStr && <div className={styles.fileMeta}>{sizeStr}</div>}
      </div>
      <button
        className={styles.downloadButton}
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? "Receiving..." : "&#x2B07; Get File"}
      </button>
    </div>
  );
}

function MessageBubbleInner({ message, roomId }: MessageBubbleProps) {
  const userId = useAuthStore((s) => s.userId);
  const setReplyingTo = useMessagesStore((s) => s.setReplyingTo);
  const setEditingMessage = useMessagesStore((s) => s.setEditingMessage);
  const getReadBy = useReadReceiptStore((s) => s.getReadBy);
  const userVerifications = useEncryptionStore((s) => s.userVerifications);
  const { getUserVerificationStatus } = useEncryption();
  const { ignoreUser, unignoreUser, reportMessage } = useModeration();
  const ignoredUsers = useModerationStore((s) => s.ignoredUsers);
  const isSelf = message.sender === userId;
  const isIgnoredSender = ignoredUsers.includes(message.sender);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showIgnoreDialog, setShowIgnoreDialog] = useState(false);
  const [showUnignoreDialog, setShowUnignoreDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch verification status for sender if not cached
  useEffect(() => {
    if (!userVerifications[message.sender]) {
      getUserVerificationStatus(message.sender).catch(() => {});
    }
  }, [message.sender]);

  const senderVerification = userVerifications[message.sender];
  const isVerified = senderVerification?.isVerified ?? false;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const menuWidth = 180;
    const menuHeight = isSelf ? 160 : 240;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight);
    setContextMenu({ x, y });
  }, [isSelf]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  const handleReply = () => {
    setReplyingTo(roomId, message);
    setContextMenu(null);
  };

  const handleDelete = async () => {
    setContextMenu(null);
    try {
      await invoke("delete_message", { roomId, eventId: message.eventId });
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const handleReaction = async (emoji: string) => {
    try {
      await invoke("send_reaction", { roomId, eventId: message.eventId, emoji });
    } catch (e) {
      console.error("Failed to react:", e);
    }
  };

  const replySource = useMessagesStore((s) => {
    if (!message.replyTo) return null;
    const msgs = s.rooms[roomId]?.messages;
    if (!msgs) return null;
    return msgs.find((m) => m.eventId === message.replyTo) ?? null;
  });

  const sanitizedHtml = useMemo(() => {
    if (!message.formattedBody) return null;
    return DOMPurify.sanitize(message.formattedBody, {
      ALLOWED_TAGS: ['b', 'i', 'u', 'em', 'strong', 'a', 'br', 'p', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'span'],
    });
  }, [message.formattedBody]);

  const readBy = getReadBy(roomId, message.eventId).filter(
    (uid) => uid !== userId && !ignoredUsers.includes(uid),
  );

  const displayName = message.senderName || message.sender;
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const bubbleClass = [styles.bubble, message.isRedacted ? styles.redacted : ""].filter(Boolean).join(" ");
  const visibleReactions = message.reactions
    .map((reaction) => ({
      ...reaction,
      senders: reaction.senders.filter((sender) => !ignoredUsers.includes(sender)),
    }))
    .filter((reaction) => reaction.senders.length > 0);

  // Render media content based on message type
  const renderMediaContent = () => {
    switch (message.msgType) {
      case "m.image":
        return <MediaImage message={message} />;
      case "m.video":
        return <MediaVideo message={message} />;
      case "m.audio":
        return <MediaAudio message={message} />;
      case "m.file":
        return <MediaFile message={message} />;
      default:
        return null;
    }
  };

  const isMediaMessage = ["m.image", "m.video", "m.audio", "m.file"].includes(message.msgType);

  return (
    <div
      className={bubbleClass}
      onContextMenu={handleContextMenu}
    >
      {replySource && (
        <div className={styles.replyIndicator}>
          &#x21A9; {replySource.senderName || replySource.sender}: {replySource.body.slice(0, 80)}
        </div>
      )}

      <div className={styles.messageRow}>
      <Avatar
        name={displayName}
        avatarUrl={message.avatarUrl}
        size="medium"
        shape="circle"
      />
      <div className={styles.messageContent}>
      <div className={styles.header}>
        <span className={isSelf ? styles.senderSelf : styles.senderOther}>
          {displayName}
        </span>
        {isVerified && (
          <span className={styles.verifiedBadge} title="Verified user">&#x2713;</span>
        )}
        <span className={styles.timestamp}>{time}</span>
        {message.isEdited && <span className={styles.editBadge}>(edited)</span>}
      </div>

      {isMediaMessage ? (
        renderMediaContent()
      ) : (
        <div
          className={styles.body}
          dangerouslySetInnerHTML={
            sanitizedHtml ? { __html: sanitizedHtml } : undefined
          }
        >
          {sanitizedHtml ? undefined : message.body}
        </div>
      )}

      {visibleReactions.length > 0 && (
        <div className={styles.reactions}>
          {visibleReactions.map((r) => (
            <span
              key={r.emoji}
              className={styles.reactionBadge}
              onClick={() => handleReaction(r.emoji)}
              title={r.senders.join(", ")}
            >
              {r.emoji} {r.senders.length}
            </span>
          ))}
        </div>
      )}

      {readBy.length > 0 && (
        <div className={styles.readReceipts}>
          &#x2713; Read by {readBy.map((uid) => {
            const parts = uid.split(':');
            return parts[0].replace('@', '');
          }).join(', ')}
        </div>
      )}

      </div>
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className={styles.contextMenuItem} onClick={handleReply}>&#x21A9; Reply</button>
          {isSelf && (
            <button className={styles.contextMenuItem} onClick={() => { setEditingMessage(roomId, message); setContextMenu(null); }}>
              &#x270F; Edit
            </button>
          )}
          <button className={styles.contextMenuItem} onClick={() => { setShowReactionPicker(true); setContextMenu(null); }}>
            &#x1F600; React
          </button>
          <div className={styles.contextSep} />
          {!isSelf && (
            <>
              <button
                className={styles.contextMenuItem}
                onClick={() => {
                  setShowIgnoreDialog(!isIgnoredSender);
                  setShowUnignoreDialog(isIgnoredSender);
                  setContextMenu(null);
                }}
              >
                {isIgnoredSender ? "&#x267B; Unblock / Unignore User" : "&#x1F6AB; Block / Ignore User"}
              </button>
              <button
                className={styles.contextMenuItem}
                onClick={() => {
                  setShowReportDialog(true);
                  setContextMenu(null);
                }}
              >
                &#x26A0; Report Message
              </button>
              <div className={styles.contextSep} />
            </>
          )}
          {isSelf && (
            <button className={styles.contextMenuItem} onClick={handleDelete}>&#x2716; Delete</button>
          )}
        </div>
      )}

      {showReactionPicker && (
        <ReactionPicker
          onSelect={handleReaction}
          onClose={() => setShowReactionPicker(false)}
        />
      )}

      {showIgnoreDialog && (
        <ModerationDialog
          title="Block / Ignore User"
          description={`Hide messages, reactions, and other chat activity from ${displayName}?`}
          confirmLabel="Block User"
          onClose={() => setShowIgnoreDialog(false)}
          onConfirm={async () => { await ignoreUser(message.sender); }}
        />
      )}

      {showUnignoreDialog && (
        <ModerationDialog
          title="Unblock / Unignore User"
          description={`Allow ${displayName} to appear in the timeline again?`}
          confirmLabel="Unblock User"
          onClose={() => setShowUnignoreDialog(false)}
          onConfirm={async () => { await unignoreUser(message.sender); }}
        />
      )}

      {showReportDialog && (
        <ModerationDialog
          title="Report Message"
          description={`Send a moderation report for the selected message from ${displayName}.`}
          confirmLabel="Report Message"
          onClose={() => setShowReportDialog(false)}
          onConfirm={(reason) => reportMessage(roomId, message.eventId, reason)}
          reasonLabel="Reason"
          reasonPlaceholder="Describe what is wrong with this message."
          reasonHint="PufferChat submits Matrix event reports with a strong abuse score by default."
        />
      )}
    </div>
  );
}



export default React.memo(MessageBubbleInner);
