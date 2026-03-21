/**
 * CallButton — Audio/Video call buttons for room header
 */
import { useState } from "react";
import { useCallsStore } from "../../stores/calls";
import { useCall } from "../../hooks/useCall";
import styles from "./Calls.module.css";

interface CallButtonProps {
  roomId: string;
}

export default function CallButton({ roomId }: CallButtonProps) {
  const activeCall = useCallsStore((s) => s.activeCall);
  const { startCall } = useCall();
  const [showMenu, setShowMenu] = useState(false);

  const isInCall = activeCall !== null && activeCall.state !== "ended";

  const handleAudioCall = () => {
    setShowMenu(false);
    if (!isInCall) {
      startCall(roomId, false);
    }
  };

  const handleVideoCall = () => {
    setShowMenu(false);
    if (!isInCall) {
      startCall(roomId, true);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        className={`${styles.callButton} ${isInCall ? styles.callButtonActive : ""}`}
        onClick={() => setShowMenu(!showMenu)}
        title={isInCall ? "In Call" : "Start Call"}
        disabled={isInCall}
      >
        {"\uD83D\uDCDE"} Call
      </button>
      {showMenu && !isInCall && (
        <div style={{
          position: "absolute",
          top: "100%",
          right: 0,
          zIndex: 300,
          background: "var(--win-bg)",
          border: "2px solid",
          borderColor: "var(--win-border-light) var(--win-border-dark) var(--win-border-dark) var(--win-border-light)",
          boxShadow: "2px 2px 0 var(--win-border-shadow)",
          minWidth: 120,
          fontFamily: "var(--font-system)",
          fontSize: "11px",
        }}>
          <div
            style={{
              padding: "4px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={handleAudioCall}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "var(--aol-blue)"; (e.target as HTMLElement).style.color = "white"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = ""; (e.target as HTMLElement).style.color = ""; }}
          >
            {"\uD83D\uDD0A"} Audio Call
          </div>
          <div
            style={{
              padding: "4px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={handleVideoCall}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "var(--aol-blue)"; (e.target as HTMLElement).style.color = "white"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = ""; (e.target as HTMLElement).style.color = ""; }}
          >
            {"\uD83C\uDFA5"} Video Call
          </div>
        </div>
      )}
    </div>
  );
}
