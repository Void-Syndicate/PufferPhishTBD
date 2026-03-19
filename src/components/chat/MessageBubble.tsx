import DOMPurify from "dompurify";
import { useMemo } from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TimelineMessage, useMessagesStore } from "../../stores/messages";
import { useAuthStore } from "../../stores/auth";
import ReactionPicker from "./ReactionPicker";
import styles from "./MessageBubble.module.css";

interface MessageBubbleProps {
  message: TimelineMessage;
  roomId: string;
  allMessages: TimelineMessage[];
}

export default function MessageBubble({ message, roomId, allMessages }: MessageBubbleProps) {
  const userId = useAuthStore((s) => s.userId);
  const setReplyingTo = useMessagesStore((s) => s.setReplyingTo);
  const setEditingMessage = useMessagesStore((s) => s.setEditingMessage);
  const isSelf = message.sender === userId;

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

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

  const replySource = message.replyTo
    ? allMessages.find((m) => m.eventId === message.replyTo)
    : null;

  const sanitizedHtml = useMemo(() => {
    if (!message.formattedBody) return null;
    return DOMPurify.sanitize(message.formattedBody, {
      ALLOWED_TAGS: ['b', 'i', 'u', 'em', 'strong', 'a', 'br', 'p', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'span'],
    });
  }, [message.formattedBody]);

  const displayName = message.senderName || message.sender;
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div
      className={`${styles.bubble} ${message.isRedacted ? styles.redacted : ""}`}
      onContextMenu={handleContextMenu}
    >
      {replySource && (
        <div className={styles.replyIndicator}>
          ? {replySource.senderName || replySource.sender}: {replySource.body.slice(0, 80)}
        </div>
      )}

      <div className={styles.header}>
        <span className={`${styles.senderName} ${isSelf ? styles.senderSelf : styles.senderOther}`}>
          {displayName}
        </span>
        <span className={styles.timestamp}>{time}</span>
        {message.isEdited && <span className={styles.editBadge}>(edited)</span>}
      </div>

      <div
        className={styles.body}
        dangerouslySetInnerHTML={
          sanitizedHtml ? { __html: sanitizedHtml } : undefined
        }
      >
        {sanitizedHtml ? undefined : message.body}
      </div>

      {message.reactions.length > 0 && (
        <div className={styles.reactions}>
          {message.reactions.map((r) => (
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

      {contextMenu && (
        <div
          ref={menuRef}
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className={styles.contextMenuItem} onClick={handleReply}>? Reply</button>
          {isSelf && (
            <button className={styles.contextMenuItem} onClick={() => { setEditingMessage(roomId, message); setContextMenu(null); }}>
              ?? Edit
            </button>
          )}
          <button className={styles.contextMenuItem} onClick={() => { setShowReactionPicker(true); setContextMenu(null); }}>
            ?? React
          </button>
          <div className={styles.contextSep} />
          {isSelf && (
            <button className={styles.contextMenuItem} onClick={handleDelete}>??? Delete</button>
          )}
        </div>
      )}

      {showReactionPicker && (
        <ReactionPicker
          onSelect={handleReaction}
          onClose={() => setShowReactionPicker(false)}
        />
      )}
    </div>
  );
}
