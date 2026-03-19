import { useState, useEffect } from "react";
import { useEncryption } from "../../hooks/useEncryption";
import { useEncryptionStore } from "../../stores/encryption";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./Security.module.css";

interface AutoLockSettingsProps {
  onClose: () => void;
}

export default function AutoLockSettings({ onClose }: AutoLockSettingsProps) {
  const { setupAutoLock, disableAutoLock, checkLockState } = useEncryption();
  const autoLockEnabled = useEncryptionStore((s) => s.autoLockEnabled);
  const lockTimeoutSecs = useEncryptionStore((s) => s.lockTimeoutSecs);

  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [timeout, setTimeout_] = useState(String(lockTimeoutSecs));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkLockState();
  }, []);

  const handleEnable = async () => {
    if (passphrase.length < 4) {
      setError("Passphrase must be at least 4 characters");
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError("Passphrases do not match");
      return;
    }
    const secs = parseInt(timeout) || 300;
    setLoading(true);
    setError("");
    try {
      await setupAutoLock(passphrase, secs);
      setSuccess("Auto-lock enabled!");
      setPassphrase("");
      setConfirmPassphrase("");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    setError("");
    try {
      await disableAutoLock();
      setSuccess("Auto-lock disabled.");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Window
          title="🔒 Auto-Lock Settings"
          onClose={onClose}
          showMinimize={false}
          showMaximize={false}
          width={400}
        >
          <div className={styles.dialogBody}>
            <p className={styles.description}>
              Automatically lock PufferChat after a period of inactivity.
              A passphrase is required to unlock.
            </p>

            <div className={styles.statusBox}>
              <div className={styles.statusRow}>
                <span>Auto-lock:</span>
                <span className={autoLockEnabled ? styles.statusGood : styles.statusWarn}>
                  {autoLockEnabled ? "✅ Enabled" : "❌ Disabled"}
                </span>
              </div>
              {autoLockEnabled && (
                <div className={styles.statusRow}>
                  <span>Timeout:</span>
                  <span>{lockTimeoutSecs}s ({Math.round(lockTimeoutSecs / 60)} min)</span>
                </div>
              )}
            </div>

            {!autoLockEnabled ? (
              <>
                <div className={styles.field}>
                  <TextInput
                    label="Lock Passphrase"
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Min 4 characters"
                  />
                </div>
                <div className={styles.field}>
                  <TextInput
                    label="Confirm Passphrase"
                    type="password"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    placeholder="Repeat passphrase"
                  />
                </div>
                <div className={styles.field}>
                  <TextInput
                    label="Timeout (seconds)"
                    type="number"
                    value={timeout}
                    onChange={(e) => setTimeout_(e.target.value)}
                    placeholder="300"
                  />
                </div>
                <div className={styles.buttonRow}>
                  <Button variant="primary" onClick={handleEnable} disabled={loading}>
                    {loading ? "Setting up..." : "Enable Auto-Lock"}
                  </Button>
                </div>
              </>
            ) : (
              <div className={styles.buttonRow}>
                <Button onClick={handleDisable} disabled={loading}>
                  Disable Auto-Lock
                </Button>
              </div>
            )}

            {error && <div className={styles.error}>⚠️ {error}</div>}
            {success && <div className={styles.success}>✅ {success}</div>}

            <div className={styles.buttonRow}>
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}
