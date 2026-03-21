/**
 * CallEndedDialog — Shows call ended with duration summary
 */
import { useCallsStore } from "../../stores/calls";
import styles from "./Calls.module.css";

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CallEndedDialog() {
  const activeCall = useCallsStore((s) => s.activeCall);
  const callDuration = useCallsStore((s) => s.callDuration);

  if (!activeCall || activeCall.state !== "ended") {
    return null;
  }

  return (
    <div className={styles.callOverlay}>
      <div className={styles.callDialog}>
        <div className={styles.callDialogTitlebar}>
          <span className={styles.callDialogTitle}>
            {"\uD83D\uDCDE"} Call Ended
          </span>
        </div>
        <div className={styles.callEndedBody}>
          <div className={styles.callEndedIcon}>{"\uD83D\uDCF5"}</div>
          <p className={styles.callEndedText}>
            Call with {activeCall.peerDisplayName || activeCall.peerUserId} ended
          </p>
          {callDuration > 0 && (
            <p className={styles.callEndedDuration}>
              Duration: {formatDuration(callDuration)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
