/**
 * InCallView — Active call view with video feeds, controls, and PiP
 */
import { useEffect, useRef, useState } from "react";
import { useCallsStore } from "../../stores/calls";
import { useCall } from "../../hooks/useCall";
import DeviceSelector from "./DeviceSelector";
import styles from "./Calls.module.css";

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function InCallView() {
  const activeCall = useCallsStore((s) => s.activeCall);
  const localStream = useCallsStore((s) => s.localStream);
  const remoteStream = useCallsStore((s) => s.remoteStream);
  const isMuted = useCallsStore((s) => s.isMuted);
  const isVideoEnabled = useCallsStore((s) => s.isVideoEnabled);
  const isScreenSharing = useCallsStore((s) => s.isScreenSharing);
  const callDuration = useCallsStore((s) => s.callDuration);
  const connectionQuality = useCallsStore((s) => s.connectionQuality);
  const bitrate = useCallsStore((s) => s.bitrate);
  const isPushToTalkEnabled = useCallsStore((s) => s.isPushToTalkEnabled);
  const screenShareStream = useCallsStore((s) => s.screenShareStream);

  const { endCall, toggleMute, toggleVideo, startScreenShare, stopScreenShare, enablePushToTalk } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [showDevices, setShowDevices] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      if (isScreenSharing && screenShareStream) {
        // When WE are sharing, remote still sees our screen; we see remote video
        remoteVideoRef.current.srcObject = remoteStream;
      } else {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, isScreenSharing, screenShareStream]);

  if (!activeCall || (activeCall.state !== "connecting" && activeCall.state !== "connected")) {
    return null;
  }

  const isVideoCall = activeCall.isVideo;
  const qualityClass = connectionQuality === "excellent" ? styles.qualityExcellent
    : connectionQuality === "good" ? styles.qualityGood
    : connectionQuality === "fair" ? styles.qualityFair
    : connectionQuality === "poor" ? styles.qualityPoor
    : styles.qualityUnknown;

  const peerInitial = (activeCall.peerDisplayName || activeCall.peerUserId || "?")[0].toUpperCase();

  return (
    <div className={styles.callOverlay}>
      <div className={styles.inCallContainer}>
        {/* Status Bar */}
        <div className={styles.callStatusBar}>
          <span>
            {activeCall.state === "connecting" ? "Connecting..." : "Connected"} — {activeCall.peerDisplayName || activeCall.peerUserId}
          </span>
          <div className={styles.connectionQuality}>
            <span className={`${styles.qualityDot} ${qualityClass}`} />
            <span>{connectionQuality}</span>
            {bitrate !== null && <span>({Math.round(bitrate / 1000)} kbps)</span>}
          </div>
          <span className={styles.callTimer}>{formatDuration(callDuration)}</span>
        </div>

        {/* Screen share banner */}
        {isScreenSharing && (
          <div className={styles.screenShareBanner}>
            {"\uD83D\uDCBB"} You are sharing your screen
            <button className={styles.stopShareBtn} onClick={stopScreenShare}>
              Stop Sharing
            </button>
          </div>
        )}

        {/* Video Area */}
        <div className={styles.videoArea}>
          {isVideoCall || remoteStream?.getVideoTracks().length ? (
            <>
              <video
                ref={remoteVideoRef}
                className={styles.remoteVideo}
                autoPlay
                playsInline
              />
              {localStream && isVideoEnabled && (
                <div className={styles.localVideoPip}>
                  <video
                    ref={localVideoRef}
                    className={styles.localVideo}
                    autoPlay
                    playsInline
                    muted
                  />
                </div>
              )}
            </>
          ) : (
            <div className={styles.audioOnlyView}>
              <div className={styles.audioAvatar}>{peerInitial}</div>
              <span className={styles.audioPeerName}>
                {activeCall.peerDisplayName || activeCall.peerUserId}
              </span>
              <span style={{ color: "#aaa", fontSize: "12px", fontFamily: "var(--font-system)" }}>
                {activeCall.state === "connecting" ? "Connecting..." : "Audio Call"}
              </span>
              {/* Hidden audio element for audio-only calls */}
              <video ref={remoteVideoRef} style={{ display: "none" }} autoPlay playsInline />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className={styles.callControls}>
          <button
            className={`${styles.callControlBtn} ${isMuted ? styles.callControlBtnActive : ""}`}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? "\uD83D\uDD07" : "\uD83D\uDD0A"}
          </button>

          {isVideoCall && (
            <button
              className={`${styles.callControlBtn} ${!isVideoEnabled ? styles.callControlBtnActive : ""}`}
              onClick={toggleVideo}
              title={isVideoEnabled ? "Disable Video" : "Enable Video"}
            >
              {isVideoEnabled ? "\uD83C\uDFA5" : "\uD83D\uDEAB"}
            </button>
          )}

          <button
            className={`${styles.callControlBtn} ${isScreenSharing ? styles.callControlBtnActive : ""}`}
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
          >
            {"\uD83D\uDCBB"}
          </button>

          <button
            className={`${styles.callControlBtn} ${isPushToTalkEnabled ? styles.callControlBtnActive : ""}`}
            onClick={() => enablePushToTalk(!isPushToTalkEnabled)}
            title={isPushToTalkEnabled ? "Disable Push-to-Talk" : "Enable Push-to-Talk (Spacebar)"}
          >
            PTT
          </button>

          <button
            className={styles.callControlBtn}
            onClick={() => setShowDevices(!showDevices)}
            title="Audio/Video Devices"
          >
            {"\u2699\uFE0F"}
          </button>

          <button
            className={`${styles.callControlBtn} ${styles.callControlBtnDanger}`}
            onClick={() => endCall("user_hangup")}
            title="Hang Up"
          >
            {"\uD83D\uDCF5"}
          </button>
        </div>

        {showDevices && <DeviceSelector onClose={() => setShowDevices(false)} />}
      </div>
    </div>
  );
}
