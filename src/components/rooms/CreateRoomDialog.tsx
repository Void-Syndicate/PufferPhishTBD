import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./RoomDialogs.module.css";

interface CreateRoomDialogProps {
  onClose: () => void;
  onCreated?: (roomId: string) => void;
}

export default function CreateRoomDialog({ onClose, onCreated }: CreateRoomDialogProps) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [inviteIds, setInviteIds] = useState("");
  const [isDirect, setIsDirect] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setError("");
    setLoading(true);
    try {
      const invites = inviteIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const roomId = await invoke<string>("create_room", {
        name: name || null,
        topic: topic || null,
        isDirect,
        inviteUserIds: invites,
        isEncrypted,
      });
      onCreated?.(roomId);
      onClose();
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
          title={isDirect ? "?? New Message" : "?? Create Chat Room"}
          onClose={onClose}
          showMinimize={false}
          showMaximize={false}
          width={360}
        >
          <div className={styles.dialogBody}>
            <div className={styles.field}>
              <TextInput
                label="Room Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Cool Room"
              />
            </div>
            <div className={styles.field}>
              <TextInput
                label="Topic (optional)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What's this room about?"
              />
            </div>
            <div className={styles.field}>
              <TextInput
                label="Invite Users (comma-separated)"
                value={inviteIds}
                onChange={(e) => setInviteIds(e.target.value)}
                placeholder="@user:matrix.org, @friend:server.com"
              />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isDirect}
                  onChange={(e) => setIsDirect(e.target.checked)}
                />
                Direct Message
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isEncrypted}
                  onChange={(e) => setIsEncrypted(e.target.checked)}
                />
                ?? Encrypted
              </label>
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.buttonRow}>
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleCreate} disabled={loading}>
                {loading ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}
