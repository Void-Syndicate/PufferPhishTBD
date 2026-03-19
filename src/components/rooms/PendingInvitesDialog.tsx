import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Window from "../retro/Window";
import Button from "../retro/Button";
import styles from "./RoomDialogs.module.css";

interface InvitedRoomSummary {
  roomId: string;
  name: string | null;
  inviter: string | null;
}

interface PendingInvitesDialogProps {
  onClose: () => void;
  onAccepted?: (roomId: string) => void;
}

export default function PendingInvitesDialog({ onClose, onAccepted }: PendingInvitesDialogProps) {
  const [invites, setInvites] = useState<InvitedRoomSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    setLoading(true);
    try {
      const result = await invoke<InvitedRoomSummary[]>("get_invited_rooms");
      setInvites(result);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (roomId: string) => {
    setActing(roomId);
    setError("");
    try {
      const joined = await invoke<string>("accept_invite", { roomId });
      setInvites((prev) => prev.filter((i) => i.roomId !== roomId));
      onAccepted?.(joined);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (roomId: string) => {
    setActing(roomId);
    setError("");
    try {
      await invoke("reject_invite", { roomId });
      setInvites((prev) => prev.filter((i) => i.roomId !== roomId));
    } catch (e: any) {
      setError(String(e));
    } finally {
      setActing(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Window
          title="?? Pending Invites"
          onClose={onClose}
          showMinimize={false}
          showMaximize={false}
          width={380}
        >
          <div className={styles.dialogBody}>
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.resultsList}>
              {loading ? (
                <div className={styles.emptyResults}>Loading invites...</div>
              ) : invites.length === 0 ? (
                <div className={styles.emptyResults}>No pending invites</div>
              ) : (
                invites.map((invite) => (
                  <div key={invite.roomId} className={styles.inviteItem}>
                    <div className={styles.inviteInfo}>
                      <span className={styles.inviteName}>
                        {invite.name || invite.roomId}
                      </span>
                      {invite.inviter && (
                        <span className={styles.inviteFrom}>
                          from {invite.inviter}
                        </span>
                      )}
                    </div>
                    <div className={styles.inviteActions}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleAccept(invite.roomId)}
                        disabled={acting === invite.roomId}
                      >
                        ?
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleReject(invite.roomId)}
                        disabled={acting === invite.roomId}
                      >
                        ?
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={styles.buttonRow}>
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}
