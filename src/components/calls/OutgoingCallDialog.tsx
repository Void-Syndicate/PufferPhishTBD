/**
 * OutgoingCallDialog — "Dialing..." AOL phone animation
 */
import { useCallsStore } from "../../stores/calls";
import { useCall } from "../../hooks/useCall";
import styles from "./Calls.module.css";

export default function OutgoingCallDialog() {
  const activeCall = useCallsStore((s) => s.activeCall);
  const { endCall } = useCall();

  if (!activeCall || activeCall.direction !== "outgoing" || activeCall.state !== "ringing") {
    return null;
  }

  const initial = (activeCall.peerDisplayName || activeCall.peerUserId || "?")[0].toUpperCase();

  return (
    <div className={styles.callOverlay}>
      <div className={styles.callDialog}>
        <div className={styles.callDialogTitlebar}>
          <span className={styles.callDialogTitle}>
            {"\uD83D\uDCDE"} Outgoing Call
          </span>
        </div>
        <div className={styles.callDialogBody}>
          <div className={styles.ringingIcon}>{"\uD83D\uDCF1"}</div>
          <div className={styles.callerAvatar}>{initial}</div>
          <p className={styles.callerName}>
            {activeCall.peerDisplayName || activeCall.peerUserId}
          </p>
          <p className={styles.callerUserId}>{activeCall.peerUserId}</p>
          <p className={styles.callType}>
            {activeCall.isVideo ? "\uD83C\uDFA5 Video Call" : "\uD83D\uDD0A Audio Call"}
          </p>
          <p className={styles.dialingText}>Dialing</p>
          <div className={styles.callActions}>
            <button
              className={`${styles.callBtn} ${styles.hangupBtn}`}
              onClick={() => endCall("user_hangup")}
            >
              {"\uD83D\uDCF5"} Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
