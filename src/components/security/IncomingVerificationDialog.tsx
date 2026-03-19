import { useState } from "react";
import { useEncryptionStore, PendingVerificationRequest } from "../../stores/encryption";
import { useEncryption } from "../../hooks/useEncryption";
import DeviceVerificationDialog from "./DeviceVerificationDialog";
import Window from "../retro/Window";
import Button from "../retro/Button";
import styles from "./Security.module.css";

/**
 * Shows a prompt for each incoming verification request.
 * When accepted, opens the full DeviceVerificationDialog flow.
 */
export default function IncomingVerificationDialog() {
  const pendingVerifications = useEncryptionStore((s) => s.pendingVerifications);
  const removePendingVerification = useEncryptionStore((s) => s.removePendingVerification);
  const { acceptVerification, cancelVerification } = useEncryption();
  const [acceptedRequest, setAcceptedRequest] = useState<PendingVerificationRequest | null>(null);

  // Show the oldest pending request as a prompt
  const current = pendingVerifications[0] ?? null;

  const handleAccept = async () => {
    if (!current) return;
    try {
      await acceptVerification(current.userId, current.flowId);
      setAcceptedRequest(current);
      removePendingVerification(current.flowId);
    } catch (e) {
      console.error("Failed to accept verification:", e);
      removePendingVerification(current.flowId);
    }
  };

  const handleReject = async () => {
    if (!current) return;
    try {
      await cancelVerification(current.userId, current.flowId);
    } catch { /* ignore */ }
    removePendingVerification(current.flowId);
  };

  const handleVerificationClose = () => {
    setAcceptedRequest(null);
  };

  // If we accepted and are in verification flow, show the full dialog
  if (acceptedRequest) {
    return (
      <DeviceVerificationDialog
        userId={acceptedRequest.userId}
        onClose={handleVerificationClose}
      />
    );
  }

  // No pending requests
  if (!current) return null;

  return (
    <div className={styles.overlay}>
      <div onClick={(e) => e.stopPropagation()}>
        <Window
          title="?? Verification Request"
          onClose={handleReject}
          showMinimize={false}
          showMaximize={false}
          width={400}
        >
          <div className={styles.dialogBody}>
            <div className={styles.verifyHeader}>
              <div className={styles.verifyIcon}>??</div>
              <div>
                <div className={styles.verifyTitle}>Incoming Verification</div>
                <div className={styles.verifySubtitle}>
                  <strong>{current.userId}</strong> wants to verify your device.
                </div>
              </div>
            </div>
            <p style={{ margin: "12px 0", fontSize: "12px", color: "#666" }}>
              Accepting will start an emoji comparison to confirm both devices are trusted.
            </p>
            <div className={styles.buttonRow}>
              <Button onClick={handleReject}>Reject</Button>
              <Button variant="primary" onClick={handleAccept}>
                Accept ?
              </Button>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}