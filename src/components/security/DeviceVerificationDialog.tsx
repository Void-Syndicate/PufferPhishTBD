import { useState, useEffect } from "react";
import { useEncryption } from "../../hooks/useEncryption";
import { useEncryptionStore } from "../../stores/encryption";
import Window from "../retro/Window";
import Button from "../retro/Button";
import styles from "./Security.module.css";

interface DeviceVerificationDialogProps {
  userId: string;
  deviceId?: string;
  onClose: () => void;
}

export default function DeviceVerificationDialog({
  userId,
  deviceId,
  onClose,
}: DeviceVerificationDialogProps) {
  const {
    requestVerification,
    requestDeviceVerification,
    acceptVerification,
    startSasVerification,
    getSasEmojis,
    confirmSasVerification,
    cancelVerification,
    pollVerificationState,
  } = useEncryption();

  const activeVerification = useEncryptionStore((s) => s.activeVerification);
  const [error, setError] = useState("");

  // Start verification on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (deviceId) {
          await requestDeviceVerification(userId, deviceId);
        } else {
          await requestVerification(userId);
        }
      } catch (e: any) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [userId, deviceId]);

  // Poll verification state
  useEffect(() => {
    if (!activeVerification?.flowId) return;
    const interval = setInterval(async () => {
      const state = await pollVerificationState(
        activeVerification.otherUserId,
        activeVerification.flowId
      );
      if (state?.state === "done" || state?.state === "cancelled") {
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [activeVerification?.flowId]);

  const handleAccept = async () => {
    if (!activeVerification) return;
    try {
      await acceptVerification(activeVerification.otherUserId, activeVerification.flowId);
      await startSasVerification(activeVerification.otherUserId, activeVerification.flowId);
      // Wait a moment then fetch emojis
      setTimeout(async () => {
        await getSasEmojis(activeVerification.otherUserId, activeVerification.flowId);
      }, 2000);
    } catch (e: any) {
      setError(String(e));
    }
  };

  const handleConfirm = async () => {
    if (!activeVerification) return;
    try {
      await confirmSasVerification(activeVerification.otherUserId, activeVerification.flowId);
    } catch (e: any) {
      setError(String(e));
    }
  };

  const handleCancel = async () => {
    if (activeVerification) {
      try {
        await cancelVerification(activeVerification.otherUserId, activeVerification.flowId);
      } catch {}
    }
    onClose();
  };

  const state = activeVerification?.state ?? "requested";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Window
          title={`🔐 Verify ${deviceId ? "Device" : "User"}`}
          onClose={handleCancel}
          showMinimize={false}
          showMaximize={false}
          width={420}
        >
          <div className={styles.dialogBody}>
            <div className={styles.verifyHeader}>
              <div className={styles.verifyIcon}>🔐</div>
              <div>
                <div className={styles.verifyTitle}>
                  Verifying {deviceId ? `device ${deviceId}` : userId}
                </div>
                <div className={styles.verifySubtitle}>
                  {state === "requested" && "Waiting for the other side to accept..."}
                  {state === "ready" && "Ready to start verification"}
                  {state === "started" && "Verification in progress..."}
                  {state === "emojis" && "Compare these emoji with the other device:"}
                  {state === "done" && "✅ Verification complete!"}
                  {state === "cancelled" && "❌ Verification was cancelled"}
                </div>
              </div>
            </div>

            {/* Emoji display */}
            {state === "emojis" && activeVerification?.emojis && (
              <div className={styles.emojiGrid}>
                {activeVerification.emojis.map((emoji, i) => (
                  <div key={i} className={styles.emojiItem}>
                    <span className={styles.emojiSymbol}>{emoji.symbol}</span>
                    <span className={styles.emojiDesc}>{emoji.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Waiting spinner */}
            {(state === "requested" || state === "started") && (
              <div className={styles.waitingSpinner}>
                <div className={styles.spinner} />
                <span>Waiting...</span>
              </div>
            )}

            {/* Success */}
            {state === "done" && (
              <div className={styles.successMessage}>
                <span className={styles.successIcon}>✅</span>
                <span>Device verified successfully! Messages are now trusted.</span>
              </div>
            )}

            {error && <div className={styles.error}>⚠️ {error}</div>}

            <div className={styles.buttonRow}>
              {state === "ready" && (
                <Button variant="primary" onClick={handleAccept}>
                  Start Emoji Verification
                </Button>
              )}
              {state === "emojis" && (
                <>
                  <Button onClick={handleCancel}>They Don't Match</Button>
                  <Button variant="primary" onClick={handleConfirm}>
                    They Match ✓
                  </Button>
                </>
              )}
              {(state === "done" || state === "cancelled") && (
                <Button variant="primary" onClick={onClose}>
                  Close
                </Button>
              )}
              {state !== "done" && state !== "cancelled" && (
                <Button onClick={handleCancel}>Cancel</Button>
              )}
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}
