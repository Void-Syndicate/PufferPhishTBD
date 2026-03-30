import { FormEvent, useState } from "react";
import Window from "../retro/Window";
import Button from "../retro/Button";
import styles from "./ModerationDialog.module.css";

interface ModerationDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  reasonHint?: string;
  width?: number;
}

export default function ModerationDialog({
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  reasonLabel,
  reasonPlaceholder,
  reasonRequired = false,
  reasonHint,
  width = 360,
}: ModerationDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showReasonField = Boolean(reasonLabel || reasonPlaceholder || reasonHint || reasonRequired);

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (submitting) return;

    const trimmedReason = reason.trim();
    if (reasonRequired && trimmedReason.length === 0) {
      setError("A reason is required for this action.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmedReason);
      onClose();
    } catch (dialogError) {
      setError(String(dialogError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()}>
        <Window
          title={title}
          onClose={onClose}
          showMinimize={false}
          showMaximize={false}
          width={width}
        >
          <form className={styles.dialogBody} onSubmit={handleSubmit}>
            <p className={styles.description}>{description}</p>

            {showReasonField && (
              <div className={styles.field}>
                {reasonLabel && <label className={styles.label}>{reasonLabel}</label>}
                <textarea
                  className={styles.textarea}
                  placeholder={reasonPlaceholder}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  autoFocus
                />
                {reasonHint && <div className={styles.hint}>{reasonHint}</div>}
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.buttonRow}>
              <Button type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "Working..." : confirmLabel}
              </Button>
            </div>
          </form>
        </Window>
      </div>
    </div>
  );
}
