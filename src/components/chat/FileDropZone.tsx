import { useState, useRef, useCallback, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUploadsStore } from "../../stores/uploads";
import styles from "./FileDropZone.module.css";

interface FileDropZoneProps {
  roomId: string;
  children: ReactNode;
}

function getMimeCategory(mime: string): "image" | "video" | "audio" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(file: File, roomId: string) {
  const id = crypto.randomUUID();
  const { addUpload, updateProgress, completeUpload, failUpload } = useUploadsStore.getState();

  addUpload({ id, fileName: file.name, fileSize: file.size, roomId });

  try {
    const base64Data = await fileToBase64(file);
    const category = getMimeCategory(file.type || "application/octet-stream");

    // Simulate progress since Tauri invoke is single-shot
    const progressInterval = setInterval(() => {
      const current = useUploadsStore.getState().uploads[id];
      if (!current || current.status !== "uploading") {
        clearInterval(progressInterval);
        return;
      }
      if (current.progress < 90) {
        updateProgress(id, Math.min(current.progress + 10 + Math.random() * 15, 90));
      }
    }, 300);

    const command = category === "image" ? "send_image"
      : category === "video" ? "send_video"
      : category === "audio" ? "send_audio"
      : "send_file";

    await invoke(command, {
      roomId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      data: base64Data,
    });

    clearInterval(progressInterval);
    completeUpload(id);

    // Auto-remove after 3s
    setTimeout(() => useUploadsStore.getState().removeUpload(id), 3000);
  } catch (e) {
    failUpload(id, String(e));
  }
}

export default function FileDropZone({ roomId, children }: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      uploadFile(file, roomId);
    }
  }, [roomId]);

  return (
    <div
      className={styles.dropZoneWrapper}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {dragging && (
        <div className={styles.overlay}>
          <div className={styles.overlayContent}>
            <span className={styles.overlayIcon}>{"\uD83D\uDCC1"}</span>
            <div className={styles.overlayText}>Drop files here to send</div>
            <div className={styles.overlaySubtext}>Images, videos, audio, or any file</div>
          </div>
        </div>
      )}
    </div>
  );
}
