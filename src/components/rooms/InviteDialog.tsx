import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./RoomDialogs.module.css";

interface InviteDialogProps {
  roomId: string;
  roomName?: string;
  onClose: () => void;
}

export default function InviteDialog({ roomId, roomName, onClose }: InviteDialogProps) {
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!userId.trim()) return;
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await invoke("invite_to_room", {
        roomId,
        userId: userId.trim(),
      });
      setSuccess(`Invited ${userId.trim()} successfully!`);
      setUserId("");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Window
          title={`?? Invite to ${roomName || "Room"}`}
          onClose={onClose}
          showMinimize={false}
          showMaximize={false}
          width={340}
        >
          <div className={styles.dialogBody}>
            <div className={styles.field}>
              <TextInput
                label="User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="@user:matrix.org"
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            {success && (
              <div style={{ color: "#008800", fontFamily: "var(--font-system)", fontSize: "10px" }}>
                {success}
              </div>
            )}
            <div className={styles.buttonRow}>
              <Button onClick={onClose}>Close</Button>
              <Button variant="primary" onClick={handleInvite} disabled={loading || !userId.trim()}>
                {loading ? "Inviting..." : "Invite"}
              </Button>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}
