/**
 * GroupCallView — Multi-participant call with grid/speaker layouts
 */
import { useRef, useEffect, useState } from "react";
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

interface ParticipantVideoProps {
  stream: MediaStream | null;
  displayName: string | null;
  userId: string;
  isMuted: boolean;
  isSpeaking: boolean;
  isLocal?: boolean;
}

function ParticipantVideo({ stream, displayName, userId, isMuted, isSpeaking, isLocal }: ParticipantVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initial = (displayName || userId || "?")[0].toUpperCase();

  return (
    <div className={styles.groupCallParticipant}>
      {stream && stream.getVideoTracks().length > 0 ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={isLocal ? { transform: "scaleX(-1)" } : undefined}
        />
      ) : (
        <div className={styles.audioAvatar} style={{ width: 48, height: 48, fontSize: 20 }}>
          {initial}
        </div>
      )}
      <div className={styles.participantLabel}>
        <span>{displayName || userId}{isLocal ? " (You)" : ""}</span>
        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {isMuted && <span className={styles.mutedIndicator}>{"\uD83D\uDD07"}</span>}
          {isSpeaking && <span className={styles.speakingIndicator} />}
        </span>
      </div>
    </div>
  );
}

export default function GroupCallView() {
  const activeCall = useCallsStore((s) => s.activeCall);
  const isGroupCall = useCallsStore((s) => s.isGroupCall);
  const groupParticipants = useCallsStore((s) => s.groupParticipants);
  const groupCallLayout = useCallsStore((s) => s.groupCallLayout);
  const localStream = useCallsStore((s) => s.localStream);
  const isMuted = useCallsStore((s) => s.isMuted);
  const isVideoEnabled = useCallsStore((s) => s.isVideoEnabled);
  const callDuration = useCallsStore((s) => s.callDuration);
  const isScreenSharing = useCallsStore((s) => s.isScreenSharing);
  const connectionQuality = useCallsStore((s) => s.connectionQuality);

  const { endCall, toggleMute, toggleVideo, startScreenShare, stopScreenShare } = useCall();
  const setLayout = useCallsStore((s) => s.setGroupCallLayout);
  const [showDevices, setShowDevices] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  // Find current active speaker
  useEffect(() => {
    const speaker = groupParticipants.find((p) => p.isSpeaking);
    if (speaker) {
      setActiveSpeaker(speaker.userId);
    }
  }, [groupParticipants]);

  if (!activeCall || !isGroupCall || (activeCall.state !== "connecting" && activeCall.state !== "connected")) {
    return null;
  }

  const qualityClass = connectionQuality === "excellent" ? styles.qualityExcellent
    : connectionQuality === "good" ? styles.qualityGood
    : connectionQuality === "fair" ? styles.qualityFair
    : connectionQuality === "poor" ? styles.qualityPoor
    : styles.qualityUnknown;

  return (
    <div className={styles.callOverlay}>
      <div className={styles.inCallContainer}>
        {/* Status Bar */}
        <div className={styles.callStatusBar}>
          <span>Group Call — {groupParticipants.length + 1} participants</span>
          <div className={styles.connectionQuality}>
            <span className={`${styles.qualityDot} ${qualityClass}`} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              style={{
                background: "none", border: "1px solid rgba(255,255,255,0.4)",
                color: "white", fontSize: 9, padding: "1px 4px", cursor: "pointer",
              }}
              onClick={() => setLayout(groupCallLayout === "grid" ? "speaker" : "grid")}
            >
              {groupCallLayout === "grid" ? "Speaker View" : "Grid View"}
            </button>
            <span className={styles.callTimer}>{formatDuration(callDuration)}</span>
          </div>
        </div>

        {/* Screen share banner */}
        {isScreenSharing && (
          <div className={styles.screenShareBanner}>
            {"\uD83D\uDCBB"} You are sharing your screen
            <button className={styles.stopShareBtn} onClick={stopScreenShare}>Stop Sharing</button>
          </div>
        )}

        {/* Video Area */}
        <div className={styles.videoArea}>
          {groupCallLayout === "grid" ? (
            <div className={styles.groupCallGrid}>
              {/* Self */}
              <ParticipantVideo
                stream={localStream}
                displayName="You"
                userId="self"
                isMuted={isMuted}
                isSpeaking={false}
                isLocal
              />
              {/* Participants */}
              {groupParticipants.map((p) => (
                <ParticipantVideo
                  key={p.userId}
                  stream={p.stream}
                  displayName={p.displayName}
                  userId={p.userId}
                  isMuted={p.isMuted}
                  isSpeaking={p.isSpeaking}
                />
              ))}
            </div>
          ) : (
            <div className={styles.speakerView}>
              <div className={styles.speakerMain}>
                {(() => {
                  const speaker = activeSpeaker
                    ? groupParticipants.find((p) => p.userId === activeSpeaker)
                    : groupParticipants[0];
                  if (speaker) {
                    return (
                      <ParticipantVideo
                        stream={speaker.stream}
                        displayName={speaker.displayName}
                        userId={speaker.userId}
                        isMuted={speaker.isMuted}
                        isSpeaking={speaker.isSpeaking}
                      />
                    );
                  }
                  return (
                    <div className={styles.audioOnlyView}>
                      <span style={{ color: "#aaa" }}>Waiting for participants...</span>
                    </div>
                  );
                })()}
              </div>
              <div className={styles.speakerThumbnails}>
                <div className={styles.speakerThumb}>
                  <ParticipantVideo
                    stream={localStream}
                    displayName="You"
                    userId="self"
                    isMuted={isMuted}
                    isSpeaking={false}
                    isLocal
                  />
                </div>
                {groupParticipants.filter((p) => p.userId !== activeSpeaker).map((p) => (
                  <div
                    key={p.userId}
                    className={styles.speakerThumb}
                    onClick={() => setActiveSpeaker(p.userId)}
                  >
                    <ParticipantVideo
                      stream={p.stream}
                      displayName={p.displayName}
                      userId={p.userId}
                      isMuted={p.isMuted}
                      isSpeaking={p.isSpeaking}
                    />
                  </div>
                ))}
              </div>
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
          <button
            className={`${styles.callControlBtn} ${!isVideoEnabled ? styles.callControlBtnActive : ""}`}
            onClick={toggleVideo}
            title={isVideoEnabled ? "Disable Video" : "Enable Video"}
          >
            {isVideoEnabled ? "\uD83C\uDFA5" : "\uD83D\uDEAB"}
          </button>
          <button
            className={`${styles.callControlBtn} ${isScreenSharing ? styles.callControlBtnActive : ""}`}
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            title="Screen Share"
          >
            {"\uD83D\uDCBB"}
          </button>
          <button
            className={styles.callControlBtn}
            onClick={() => setShowDevices(!showDevices)}
            title="Devices"
          >
            {"\u2699\uFE0F"}
          </button>
          <button
            className={`${styles.callControlBtn} ${styles.callControlBtnDanger}`}
            onClick={() => endCall("user_hangup")}
            title="Leave Call"
          >
            {"\uD83D\uDCF5"}
          </button>
        </div>

        {showDevices && <DeviceSelector onClose={() => setShowDevices(false)} />}
      </div>
    </div>
  );
}

