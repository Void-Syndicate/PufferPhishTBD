import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMessagesStore } from "../../stores/messages";
import { useTypingStore } from "../../stores/typing";
import { useAuthStore } from "../../stores/auth";
import styles from "./MessageComposer.module.css";

interface MessageComposerProps {
  roomId: string;
}

const COLORS = ["#CC0000", "#0000CC", "#008800", "#FF6600", "#9900CC", "#CC6600", "#000000"];
const SIZES: { label: string; prefix: string; suffix: string }[] = [
  { label: "Small", prefix: "<font size=\"1\">", suffix: "</font>" },
  { label: "Medium", prefix: "", suffix: "" },
  { label: "Large", prefix: "## ", suffix: "" },
];

function wrapSelection(
  textarea: HTMLTextAreaElement,
  text: string,
  setText: (v: string) => void,
  before: string,
  after: string,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = text.slice(start, end);
  const newText = text.slice(0, start) + before + selected + after + text.slice(end);
  setText(newText);
  // Restore cursor after the wrapped text
  requestAnimationFrame(() => {
    textarea.focus();
    if (selected.length > 0) {
      textarea.setSelectionRange(start + before.length, end + before.length);
    } else {
      textarea.setSelectionRange(start + before.length, start + before.length);
    }
  });
}

export default function MessageComposer({ roomId }: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
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

  const applyFormat = (before: string, after: string) => {
    if (textareaRef.current) {
      wrapSelection(textareaRef.current, text, setText, before, after);
    }
    setShowColorPicker(false);
    setShowSizePicker(false);
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

  // Close pickers on outside click
  useEffect(() => {
    const handler = () => { setShowColorPicker(false); setShowSizePicker(false); };
    if (showColorPicker || showSizePicker) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [showColorPicker, showSizePicker]);

  const typingText = filteredTyping.length === 0
    ? ""
    : filteredTyping.length === 1
    ? `${filteredTyping[0]} is typing...`
    : `${filteredTyping.length} people are typing...`;

  return (
    <div className={styles.composer}>
      <div className={styles.fontToolbar}>
        <button className={styles.fontBtn} title="Bold (wrap with **)" onClick={() => applyFormat("**", "**")}><b>B</b></button>
        <button className={styles.fontBtn} title="Italic (wrap with *)" onClick={() => applyFormat("*", "*")}><i>I</i></button>
        <button className={styles.fontBtn} title="Underline" onClick={() => applyFormat("<u>", "</u>")}><u>U</u></button>
        <div className={styles.pickerContainer}>
          <button
            className={styles.fontBtn}
            title="Font Color"
            onMouseDown={(e) => { e.stopPropagation(); setShowColorPicker((v) => !v); setShowSizePicker(false); }}
          >{"\uD83C\uDFA8"}</button>
          {showColorPicker && (
            <div className={styles.pickerDropdown} onMouseDown={(e) => e.stopPropagation()}>
              {COLORS.map((color) => (
                <div
                  key={color}
                  className={styles.colorSwatch}
                  style={{ background: color }}
                  onClick={() => applyFormat(`<font color="${color}">`, "</font>")}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
        <div className={styles.pickerContainer}>
          <button
            className={styles.fontBtn}
            title="Font Size"
            onMouseDown={(e) => { e.stopPropagation(); setShowSizePicker((v) => !v); setShowColorPicker(false); }}
          >A{"\u2195"}</button>
          {showSizePicker && (
            <div className={styles.pickerDropdown} onMouseDown={(e) => e.stopPropagation()}>
              {SIZES.map((s) => (
                <div
                  key={s.label}
                  className={styles.sizeOption}
                  onClick={() => applyFormat(s.prefix, s.suffix)}
                >{s.label}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {replyingTo && (
        <div className={styles.replyPreview}>
          <span>{"\u21A9"} Replying to <b>{replyingTo.senderName || replyingTo.sender}</b>:</span>
          <span className={styles.replyText}>{replyingTo.body.slice(0, 100)}</span>
          <button className={styles.replyCancelBtn} onClick={() => setReplyingTo(roomId, null)}>{"\u2715"}</button>
        </div>
      )}

      {editingMessage && (
        <div className={styles.replyPreview}>
          <span>{"\u270F\uFE0F"} Editing message</span>
          <button className={styles.replyCancelBtn} onClick={() => { setEditingMessage(roomId, null); setText(""); }}>{"\u2715"}</button>
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
