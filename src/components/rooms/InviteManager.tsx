import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRoomsStore, RoomSummary } from "../../stores/rooms";
import styles from "./InviteManager.module.css";

interface InvitedRoom {
  roomId: string;
  name: string | null;
  topic: string | null;
  inviter: string | null;
  memberCount: number;
}

interface HistoryEntry {
  roomId: string;
  name: string;
  action: "accepted" | "rejected";
  timestamp: number;
}

const HISTORY_KEY = "pufferchat-invite-history";

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 50)));
}

interface InviteManagerProps {
  onClose: () => void;
}

export default function InviteManager({ onClose }: InviteManagerProps) {
  const [invites, setInvites] = useState<InvitedRoom[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"pending" | "history">("pending");

  const fetchInvites = useCallback(async () => {
    try {
      setLoading(true);
      const data = await invoke<InvitedRoom[]>("get_invited_rooms");
      setInvites(data);
    } catch (e) {
      console.error("Failed to fetch invites:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const addToHistory = (roomId: string, name: string, action: "accepted" | "rejected") => {
    const entry: HistoryEntry = { roomId, name, action, timestamp: Date.now() };
    const next = [entry, ...history].slice(0, 50);
    setHistory(next);
    saveHistory(next);
  };

  const handleAccept = async (invite: InvitedRoom) => {
    setProcessing((p) => new Set(p).add(invite.roomId));
    try {
      await invoke("accept_invite", { roomId: invite.roomId });
      addToHistory(invite.roomId, invite.name || invite.roomId, "accepted");
      setInvites((prev) => prev.filter((i) => i.roomId !== invite.roomId));
      // Refresh rooms
      const rooms = await invoke<RoomSummary[]>("get_rooms");
      useRoomsStore.getState().setRooms(rooms);
    } catch (e) {
      console.error("Failed to accept invite:", e);
    } finally {
      setProcessing((p) => {
        const next = new Set(p);
        next.delete(invite.roomId);
        return next;
      });
    }
  };

  const handleReject = async (invite: InvitedRoom) => {
    setProcessing((p) => new Set(p).add(invite.roomId));
    try {
      await invoke("reject_invite", { roomId: invite.roomId });
      addToHistory(invite.roomId, invite.name || invite.roomId, "rejected");
      setInvites((prev) => prev.filter((i) => i.roomId !== invite.roomId));
    } catch (e) {
      console.error("Failed to reject invite:", e);
    } finally {
      setProcessing((p) => {
        const next = new Set(p);
        next.delete(invite.roomId);
        return next;
      });
    }
  };

  const handleAcceptAll = async () => {
    for (const invite of invites) {
      await handleAccept(invite);
    }
  };

  const handleRejectAll = async () => {
    for (const invite of invites) {
      await handleReject(invite);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div className={styles.titleBar}>
          <span className={styles.titleIcon}>{"\u2709\uFE0F"}</span>
          <span className={styles.titleText}>
            {invites.length > 0 ? "You've Got Invites!" : "Invite Manager"}
          </span>
          <button className={styles.closeBtn} onClick={onClose}>
            {"\u2715"}
          </button>
        </div>

        {/* Notification banner */}
        {invites.length > 0 && (
          <div className={styles.notifBanner}>
            {"\uD83D\uDCE8"} You have {invites.length} pending invite
            {invites.length !== 1 ? "s" : ""}!
          </div>
        )}

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === "pending" ? styles.activeTab : ""}`}
            onClick={() => setTab("pending")}
          >
            Pending ({invites.length})
          </button>
          <button
            className={`${styles.tab} ${tab === "history" ? styles.activeTab : ""}`}
            onClick={() => setTab("history")}
          >
            History
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {tab === "pending" && (
            <>
              {loading ? (
                <div className={styles.emptyState}>Loading invites...</div>
              ) : invites.length === 0 ? (
                <div className={styles.emptyState}>
                  {"\uD83D\uDCED"} No pending invites
                </div>
              ) : (
                <>
                  {/* Batch actions */}
                  <div className={styles.batchActions}>
                    <button className={styles.batchBtn} onClick={handleAcceptAll}>
                      {"\u2713"} Accept All
                    </button>
                    <button
                      className={`${styles.batchBtn} ${styles.batchReject}`}
                      onClick={handleRejectAll}
                    >
                      {"\u2715"} Reject All
                    </button>
                  </div>

                  {invites.map((invite) => (
                    <div key={invite.roomId} className={styles.inviteCard}>
                      <div className={styles.inviteInfo}>
                        <div className={styles.inviteName}>
                          {invite.name || invite.roomId}
                        </div>
                        {invite.topic && (
                          <div className={styles.inviteTopic}>{invite.topic}</div>
                        )}
                        <div className={styles.inviteMeta}>
                          {invite.inviter && (
                            <span>From: {invite.inviter}</span>
                          )}
                          {invite.memberCount > 0 && (
                            <span>
                              {"\uD83D\uDC64"} {invite.memberCount} members
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.inviteActions}>
                        <button
                          className={styles.acceptBtn}
                          onClick={() => handleAccept(invite)}
                          disabled={processing.has(invite.roomId)}
                        >
                          {processing.has(invite.roomId) ? "..." : "\u2713 Accept"}
                        </button>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => handleReject(invite)}
                          disabled={processing.has(invite.roomId)}
                        >
                          {processing.has(invite.roomId) ? "..." : "\u2715 Reject"}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {tab === "history" && (
            <>
              {history.length === 0 ? (
                <div className={styles.emptyState}>No invite history</div>
              ) : (
                history.map((entry, i) => (
                  <div key={`${entry.roomId}-${i}`} className={styles.historyItem}>
                    <span
                      className={
                        entry.action === "accepted"
                          ? styles.historyAccepted
                          : styles.historyRejected
                      }
                    >
                      {entry.action === "accepted" ? "\u2713" : "\u2715"}
                    </span>
                    <span className={styles.historyName}>{entry.name}</span>
                    <span className={styles.historyTime}>
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
