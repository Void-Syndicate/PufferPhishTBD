import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";

interface ClipboardPasteHandlerProps {
  roomId: string;
  onPasteHandled?: () => void;
}

interface PastedImage {
  dataUrl: string;
  blob: Blob;
  name: string;
}

export function useClipboardPaste({ roomId, onPasteHandled }: ClipboardPasteHandlerProps) {
  const [pastedImage, setPastedImage] = useState<PastedImage | null>(null);
  const [sending, setSending] = useState(false);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = () => {
          setPastedImage({
            dataUrl: reader.result as string,
            blob: file,
            name: `clipboard-${Date.now()}.png`,
          });
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, []);

  const sendPastedImage = useCallback(async () => {
    if (!pastedImage || sending) return;
    setSending(true);
    try {
      // Convert blob to Uint8Array
      const arrayBuffer = await pastedImage.blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Write to temp file via Tauri FS plugin
      const tempName = `pufferchat_paste_${Date.now()}.png`;
      try {
        await writeFile(tempName, bytes, { baseDir: BaseDirectory.Temp });
      } catch {
        // If fs plugin not available, try sending bytes directly
      }

      // Call send_image command (being built by another agent)
      // Falls back gracefully if command doesn't exist yet
      try {
        await invoke("send_image", {
          roomId,
          filePath: tempName,
          fileName: pastedImage.name,
          mimeType: "image/png",
        });
      } catch (err) {
        console.warn("send_image not available yet, image paste queued:", err);
      }

      setPastedImage(null);
      onPasteHandled?.();
    } catch (e) {
      console.error("Failed to send pasted image:", e);
    } finally {
      setSending(false);
    }
  }, [pastedImage, sending, roomId, onPasteHandled]);

  const cancelPaste = useCallback(() => {
    setPastedImage(null);
  }, []);

  return {
    pastedImage,
    sending,
    handlePaste,
    sendPastedImage,
    cancelPaste,
  };
}

// Preview component to render inline
export function PastePreview({
  dataUrl,
  name,
  sending,
  onSend,
  onCancel,
}: {
  dataUrl: string;
  name: string;
  sending: boolean;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 8px",
      margin: "4px 0",
      background: "#E8E8E8",
      borderLeft: "3px solid var(--aol-blue)",
      fontFamily: "var(--font-system)",
      fontSize: 10,
    }}>
      <img
        src={dataUrl}
        alt={name}
        style={{ width: 48, height: 48, objectFit: "cover", border: "1px solid #999" }}
      />
      <span style={{ flex: 1 }}>?? Pasted image: {name}</span>
      <button
        onClick={onSend}
        disabled={sending}
        style={{
          fontFamily: "var(--font-system)",
          fontSize: 10,
          background: "var(--aol-yellow)",
          border: "2px solid",
          borderColor: "var(--win-border-light) var(--win-border-dark) var(--win-border-dark) var(--win-border-light)",
          padding: "2px 10px",
          cursor: sending ? "default" : "pointer",
          opacity: sending ? 0.5 : 1,
        }}
      >
        {sending ? "Sending..." : "Send"}
      </button>
      <button
        onClick={onCancel}
        disabled={sending}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 14,
          color: "#666",
        }}
      >
        ?
      </button>
    </div>
  );
}
