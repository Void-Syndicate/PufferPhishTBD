import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMessagesStore } from "../../stores/messages";
import { useTypingStore } from "../../stores/typing";
import { useAuthStore } from "../../stores/auth";
import styles from "./MessageComposer.module.css";

interface MessageComposerProps {
  roomId: string;
}

export default function MessageComposer({ roomId }: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();

  const replyingTo = useMessagesStore((s) => s.replyingTo[roomId] ?? null);
  const editingMessage = useMessagesStore((s) => s.editingMessage[roomId] ?? null);
  const setEditingMessage = useMessagesStore((s) => s.setEditingMessage);
  const setReplyingTo = useMessagesStore((s) => s.setReplyingTo);
  const typingUsers = useTypingStore((s) => s.typing[roomId] ?? []);
  const userId = useAuthStore((s) => s.userId);

  const filteredTyping = typingUsers.filter((u) => u !== userId);

  const sendTyping = useCallback((typing: boolean) => {
    invoke("send_typing", { roomId, typing }).catch(() => {});
  }, [roomId]);

  const handleInput = (value: string) => {
    setText(value);
    sendTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(false), 4000);
  };

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (editingMessage) {
        await invoke("edit_message", { roomId, eventId: editingMessage.eventId, newBody: body });
        setEditingMessage(roomId, null);
      } else if (replyingTo) {
        await invoke("send_reply", { roomId, body, replyToEventId: replyingTo.eventId });
        setReplyingTo(roomId, null);
      } else {
        await invoke("send_message", { roomId, body });
      }
      setText("");
      sendTyping(false);
      clearTimeout(typingTimeout.current);
      textareaRef.current?.focus();
    } catch (e) {
      console.error("Failed to send:", e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Pre-fill when editing
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.body);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  // Focus on room change
  useEffect(() => {
    textareaRef.current?.focus();
  }, [roomId]);

  const typingText = filteredTyping.length === 0
    ? ""
    : filteredTyping.length === 1
    ? `${filteredTyping[0]} is typing...`
    : `${filteredTyping.length} people are typing...`;

  return (
    <div className={styles.composer}>
      {/* Font toolbar placeholder */}
      <div className={styles.fontToolbar}>
        <button className={styles.fontBtn} title="Bold"><b>B</b></button>
        <button className={styles.fontBtn} title="Italic"><i>I</i></button>
        <button className={styles.fontBtn} title="Underline"><u>U</u></button>
        <button className={styles.fontBtn} title="Font Color">??</button>
        <button className={styles.fontBtn} title="Font Size">A?</button>
      </div>

      {replyingTo && (
        <div className={styles.replyPreview}>
          <span>? Replying to <b>{replyingTo.senderName || replyingTo.sender}</b>:</span>
          <span className={styles.replyText}>{replyingTo.body.slice(0, 100)}</span>
          <button className={styles.replyCancelBtn} onClick={() => setReplyingTo(roomId, null)}>?</button>
        </div>
      )}

      {editingMessage && (
        <div className={styles.replyPreview}>
          <span>?? Editing message</span>
          <button className={styles.replyCancelBtn} onClick={() => { setEditingMessage(roomId, null); setText(""); }}>?</button>
        </div>
      )}

      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.textInput}
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          rows={2}
          disabled={sending}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >{editingMessage ? "Save Edit" : "Send"}</button>
      </div>

      <div className={styles.typingIndicator}>{typingText}</div>
    </div>
  );
}
