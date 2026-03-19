import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./RoomDialogs.module.css";

interface JoinRoomDialogProps {
  onClose: () => void;
  onJoined?: (roomId: string) => void;
}

export default function JoinRoomDialog({ onClose, onJoined }: JoinRoomDialogProps) {
  const [roomIdOrAlias, setRoomIdOrAlias] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!roomIdOrAlias.trim()) return;
    setError("");
    setLoading(true);
    try {
      const roomId = await invoke<string>("join_room", {
        roomIdOrAlias: roomIdOrAlias.trim(),
      });
      onJoined?.(roomId);
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
          title="?? Join Room"
          onClose={onClose}
          showMinimize={false}
          showMaximize={false}
          width={340}
        >
          <div className={styles.dialogBody}>
            <div className={styles.field}>
              <TextInput
                label="Room ID or Alias"
                value={roomIdOrAlias}
                onChange={(e) => setRoomIdOrAlias(e.target.value)}
                placeholder="#room:matrix.org or !abc123:matrix.org"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.buttonRow}>
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleJoin} disabled={loading || !roomIdOrAlias.trim()}>
                {loading ? "Joining..." : "Join"}
              </Button>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}
