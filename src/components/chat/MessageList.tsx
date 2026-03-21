import { useRef, useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMessagesStore, TimelineMessage } from "../../stores/messages";
import MessageBubble from "./MessageBubble";
import styles from "./MessageList.module.css";

interface MessageListProps {
  roomId: string;
}

interface GetRoomMessagesResult {
  messages: TimelineMessage[];
  endToken: string | null;
  hasMore: boolean;
}

export default function MessageList({ roomId }: MessageListProps) {
  const room = useMessagesStore((s) => s.rooms[roomId]);
  const setMessages = useMessagesStore((s) => s.setMessages);
  const prependMessages = useMessagesStore((s) => s.prependMessages);
  const setLoading = useMessagesStore((s) => s.setLoading);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);
  const isAtBottom = useRef(true);

  const messages = room?.messages ?? [];
  const hasMore = room?.hasMore ?? true;
  const isLoading = room?.isLoading ?? false;
  const endToken = room?.endToken ?? null;

  // Initial load
  useEffect(() => {
    if (room?.messages.length) return; // already loaded
    setError(null);
    loadMessages();
  }, [roomId]);

  const loadMessages = useCallback(async () => {
    setLoading(roomId, true);
    setError(null);
    try {
      const result = await invoke<GetRoomMessagesResult>("get_room_messages", {
        roomId,
        limit: 50,
      });
      setMessages(roomId, result.messages, result.endToken, result.hasMore);
    } catch (e) {
      const errMsg = String(e);
      console.error("Failed to load messages:", errMsg);
      setError(errMsg);
      setLoading(roomId, false);
    }
  }, [roomId]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setLoading(roomId, true);
    try {
      const result = await invoke<GetRoomMessagesResult>("get_room_messages", {
        roomId,
        limit: 50,
        from: endToken,
      });
      prependMessages(roomId, result.messages, result.endToken, result.hasMore);
    } catch (e) {
      console.error("Failed to load more:", e);
      setLoading(roomId, false);
    }
  }, [roomId, isLoading, hasMore, endToken]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    // Load more on scroll to top
    if (el.scrollTop < 50 && hasMore && !isLoading) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > prevMsgCount.current && isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMsgCount.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [roomId]);

  // Mark last message as read
  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      invoke("mark_read", { roomId, eventId: last.eventId }).catch(() => {});
    }
  }, [messages.length, roomId]);

  return (
    <div className={styles.messageList} ref={listRef} onScroll={handleScroll}>
      {hasMore && (
        <div className={styles.loadMore}>
          {isLoading ? (
            "Loading..."
          ) : (
            <button className={styles.loadMoreBtn} onClick={loadMore}>
              Load older messages
            </button>
          )}
        </div>
      )}

      {error && (
        <div className={styles.empty} style={{ color: "#cc0000" }}>
          {"\u26A0"} Failed to load messages: {error}
          <br />
          <button onClick={loadMessages} style={{ marginTop: 8, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {messages.length === 0 && !isLoading && !error && (
        <div className={styles.empty}>No messages yet. Say hello!</div>
      )}

      {messages.map((msg) => (
        <MessageBubble
          key={msg.eventId}
          message={msg}
          roomId={roomId}
        />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
