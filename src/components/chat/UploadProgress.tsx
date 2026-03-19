import { useUploadsStore } from "../../stores/uploads";
import type { Upload } from "../../stores/uploads";
import styles from "./UploadProgress.module.css";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateTime(upload: Upload): string {
  if (upload.progress <= 0) return "Estimating...";
  const elapsed = (Date.now() - upload.startedAt) / 1000;
  const rate = upload.progress / elapsed;
  if (rate <= 0) return "Estimating...";
  const remaining = (100 - upload.progress) / rate;
  if (remaining < 60) return `${Math.ceil(remaining)}s remaining`;
  return `${Math.ceil(remaining / 60)}m remaining`;
}

function UploadItem({ upload }: { upload: Upload }) {
  const cancelUpload = useUploadsStore((s) => s.cancelUpload);
  const removeUpload = useUploadsStore((s) => s.removeUpload);

  return (
    <div className={styles.uploadItem}>
      <div className={styles.fileInfo}>
        <span className={styles.fileName} title={upload.fileName}>{upload.fileName}</span>
        <span className={styles.fileSize}>{formatSize(upload.fileSize)}</span>
      </div>
      <div className={styles.progressBarOuter}>
        <div
          className={styles.progressBarInner}
          style={{ width: `${upload.progress}%` }}
        />
        <div className={styles.progressText}>
          <span>{Math.round(upload.progress)}%</span>
        </div>
      </div>
      <div className={styles.statusRow}>
        {upload.status === "uploading" && (
          <>
            <span className={styles.estimatedTime}>{estimateTime(upload)}</span>
            <button className={styles.cancelBtn} onClick={() => cancelUpload(upload.id)}>Cancel</button>
          </>
        )}
        {upload.status === "complete" && (
          <span className={styles.statusComplete}>✓ Transfer Complete</span>
        )}
        {upload.status === "failed" && (
          <>
            <span className={styles.statusFailed}>✗ {upload.error || "Transfer Failed"}</span>
            <button className={styles.cancelBtn} onClick={() => removeUpload(upload.id)}>Dismiss</button>
          </>
        )}
        {upload.status === "cancelled" && (
          <>
            <span className={styles.statusFailed}>Cancelled</span>
            <button className={styles.cancelBtn} onClick={() => removeUpload(upload.id)}>Dismiss</button>
          </>
        )}
      </div>
    </div>
  );
}

interface UploadProgressProps {
  roomId: string;
}

export default function UploadProgress({ roomId }: UploadProgressProps) {
  const uploads = useUploadsStore((s) =>
    Object.values(s.uploads).filter((u) => u.roomId === roomId)
  );

  if (uploads.length === 0) return null;

  return (
    <div className={styles.uploadContainer}>
      <div className={styles.titleBar}>
        <span className={styles.titleBarText}>📦 File Transfer</span>
      </div>
      <div className={styles.uploadList}>
        {uploads.map((u) => (
          <UploadItem key={u.id} upload={u} />
        ))}
      </div>
    </div>
  );
}
