/**
 * CallHistory — Call log panel with AOL retro styling
 */
import { useEffect } from "react";
import { useCallsStore, CallHistoryEntry } from "../../stores/calls";
import { useCall } from "../../hooks/useCall";
import styles from "./Calls.module.css";

interface CallHistoryProps {
  onClose: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(secs: number | null): string {
  if (secs === null || secs === 0) return "--:--";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CallHistoryEntryRow({ entry }: { entry: CallHistoryEntry }) {
  // useCall hook used for loadCallHistory and clearCallHistory above

  const icon = entry.wasMissed
    ? "\u260E\uFE0F"  // missed
    : entry.direction === "outgoing"
    ? "\u2197\uFE0F"  // outgoing arrow
    : "\u2199\uFE0F"; // incoming arrow

  const displayName = entry.peerDisplayName || entry.peerUserId;

  return (
    <div className={styles.callHistoryEntry}>
      <span className={styles.callHistoryIcon}>{icon}</span>
      <div className={styles.callHistoryInfo}>
        <div className={`${styles.callHistoryPeer} ${entry.wasMissed ? styles.callHistoryMissed : ""}`}>
          {displayName}
        </div>
        <div className={styles.callHistoryMeta}>
          {entry.isVideo ? "\uD83C\uDFA5" : "\uD83D\uDD0A"} {entry.direction} — {formatTime(entry.startedAt)}
        </div>
      </div>
      <span className={styles.callHistoryDuration}>
        {formatDuration(entry.durationSecs)}
      </span>
    </div>
  );
}

export default function CallHistory({ onClose }: CallHistoryProps) {
  const callHistory = useCallsStore((s) => s.callHistory);
  const { loadCallHistory, clearCallHistory } = useCall();

  useEffect(() => {
    loadCallHistory();
  }, [loadCallHistory]);

  const sortedHistory = [...callHistory].reverse(); // Most recent first

  return (
    <div className={styles.callHistoryPanel}>
      <div className={styles.callHistoryHeader}>
        <span className={styles.callHistoryTitle}>
          {"\uD83D\uDCDE"} Call Log
        </span>
        <button className={styles.callHistoryCloseBtn} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className={styles.callHistoryBody}>
        {sortedHistory.length === 0 ? (
          <div className={styles.callHistoryEmpty}>
            {"\uD83D\uDCDE"} No call history yet
          </div>
        ) : (
          sortedHistory.map((entry) => (
            <CallHistoryEntryRow key={entry.callId} entry={entry} />
          ))
        )}
      </div>
      {sortedHistory.length > 0 && (
        <div className={styles.callHistoryActions}>
          <button className={styles.clearHistoryBtn} onClick={clearCallHistory}>
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}

