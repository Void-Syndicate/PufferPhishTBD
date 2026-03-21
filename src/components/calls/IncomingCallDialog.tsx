/**
 * IncomingCallDialog — AOL-style popup for incoming calls
 */
import { useCallsStore } from "../../stores/calls";
import { useCall } from "../../hooks/useCall";
import styles from "./Calls.module.css";

export default function IncomingCallDialog() {
  const activeCall = useCallsStore((s) => s.activeCall);
  const { answerCall, declineCall } = useCall();

  if (!activeCall || activeCall.direction !== "incoming" || activeCall.state !== "ringing") {
    return null;
  }

  const initial = (activeCall.peerDisplayName || activeCall.peerUserId || "?")[0].toUpperCase();

  return (
    <div className={styles.callOverlay}>
      <div className={styles.callDialog}>
        <div className={styles.callDialogTitlebar}>
          <span className={styles.callDialogTitle}>
            {"\uD83D\uDCDE"} Incoming Call
          </span>
        </div>
        <div className={styles.callDialogBody}>
          <div className={styles.ringingIcon}>{"\uD83D\uDCDE"}</div>
          <div className={styles.callerAvatar}>{initial}</div>
          <p className={styles.callerName}>
            {activeCall.peerDisplayName || activeCall.peerUserId}
          </p>
          <p className={styles.callerUserId}>{activeCall.peerUserId}</p>
          <p className={styles.callType}>
            {activeCall.isVideo ? "\uD83C\uDFA5 Video Call" : "\uD83D\uDD0A Audio Call"}
          </p>
          <div className={styles.callActions}>
            <button
              className={`${styles.callBtn} ${styles.acceptBtn}`}
              onClick={answerCall}
            >
              {"\u2714"} Accept
            </button>
            <button
              className={`${styles.callBtn} ${styles.declineBtn}`}
              onClick={declineCall}
            >
              {"\u2716"} Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
