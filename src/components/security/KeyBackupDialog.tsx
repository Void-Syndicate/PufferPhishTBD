import { useState, useEffect } from "react";
import { useEncryption } from "../../hooks/useEncryption";
import { useEncryptionStore } from "../../stores/encryption";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./Security.module.css";

interface KeyBackupDialogProps {
  onClose: () => void;
}

export default function KeyBackupDialog({ onClose }: KeyBackupDialogProps) {
  const {
    loadKeyBackupStatus,
    enableKeyBackup,
    disableKeyBackup,
    setupSecretStorage,
    checkRecoveryEnabled,
    recoverWithKey,
    resetRecoveryKey,
  } = useEncryption();

  const backupStatus = useEncryptionStore((s) => s.keyBackupStatus);
  const recoveryEnabled = useEncryptionStore((s) => s.recoveryEnabled);
  const recoveryKey = useEncryptionStore((s) => s.recoveryKey);

  const [recoveryInput, setRecoveryInput] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"backup" | "recovery">("backup");

  useEffect(() => {
    loadKeyBackupStatus();
    checkRecoveryEnabled();
  }, []);

  const handleEnableBackup = async () => {
    setLoading(true);
    setError("");
    try {
      await enableKeyBackup();
      setSuccess("Key backup enabled successfully!");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDisableBackup = async () => {
    if (!confirm("Disable key backup? You may lose access to old messages on new devices.")) return;
    setLoading(true);
    setError("");
    try {
      await disableKeyBackup();
      setSuccess("Key backup disabled.");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSetupRecovery = async () => {
    setLoading(true);
    setError("");
    try {
      const recoveryKey = await setupSecretStorage();
      setSuccess(`Recovery setup complete! Your recovery key: ${recoveryKey}. Save it securely.`);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!recoveryInput.trim()) return;
    setLoading(true);
    setError("");
    try {
      await recoverWithKey(recoveryInput.trim());
      setSuccess("Recovery successful! Keys have been restored.");
      setRecoveryInput("");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleResetKey = async () => {
    if (!confirm("Reset your recovery key? Make sure to save the new one!")) return;
    setLoading(true);
    setError("");
    try {
      await resetRecoveryKey();
      setSuccess("Recovery key has been reset. Save the new key!");
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
          title="🔑 Key Backup & Recovery"
          onClose={onClose}
          showMinimize={false}
          showMaximize={false}
          width={480}
        >
          <div className={styles.dialogBody}>
            {/* Tab bar */}
            <div className={styles.tabBar}>
              <button
                className={`${styles.tab} ${tab === "backup" ? styles.tabActive : ""}`}
                onClick={() => setTab("backup")}
              >
                🗄️ Key Backup
              </button>
              <button
                className={`${styles.tab} ${tab === "recovery" ? styles.tabActive : ""}`}
                onClick={() => setTab("recovery")}
              >
                🔑 Recovery
              </button>
            </div>

            {tab === "backup" && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Key Backup</h3>
                <p className={styles.description}>
                  Back up your encryption keys to the homeserver so you can
                  access old messages on new devices.
                </p>

                {backupStatus && (
                  <div className={styles.statusBox}>
                    <div className={styles.statusRow}>
                      <span>Status:</span>
                      <span className={backupStatus.enabled ? styles.statusGood : styles.statusWarn}>
                        {backupStatus.enabled ? "✅ Enabled" : "⚠️ Not enabled"}
                      </span>
                    </div>
                    <div className={styles.statusRow}>
                      <span>State:</span>
                      <span>{backupStatus.state}</span>
                    </div>
                  </div>
                )}

                <div className={styles.buttonRow}>
                  {!backupStatus?.enabled ? (
                    <Button variant="primary" onClick={handleEnableBackup} disabled={loading}>
                      {loading ? "Enabling..." : "Enable Key Backup"}
                    </Button>
                  ) : (
                    <Button onClick={handleDisableBackup} disabled={loading}>
                      Disable Backup
                    </Button>
                  )}
                </div>
              </div>
            )}

            {tab === "recovery" && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Secret Storage & Recovery</h3>
                <p className={styles.description}>
                  Set up a recovery key to access your encrypted messages if you
                  lose all your devices.
                </p>

                <div className={styles.statusBox}>
                  <div className={styles.statusRow}>
                    <span>Recovery:</span>
                    <span className={recoveryEnabled ? styles.statusGood : styles.statusWarn}>
                      {recoveryEnabled ? "✅ Enabled" : "⚠️ Not set up"}
                    </span>
                  </div>
                </div>

                {/* Show recovery key if just generated */}
                {recoveryKey && (
                  <div className={styles.recoveryKeyBox}>
                    <div className={styles.recoveryKeyLabel}>
                      🔑 Your Recovery Key (save this securely!):
                    </div>
                    <div className={styles.recoveryKeyValue}>
                      <code>{recoveryKey}</code>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(recoveryKey)}
                    >
                      📋 Copy to Clipboard
                    </Button>
                  </div>
                )}

                {!recoveryEnabled && (
                  <div className={styles.buttonRow}>
                    <Button variant="primary" onClick={handleSetupRecovery} disabled={loading}>
                      {loading ? "Setting up..." : "Setup Recovery"}
                    </Button>
                  </div>
                )}

                {recoveryEnabled && (
                  <>
                    <div className={styles.field}>
                      <TextInput
                        label="Enter Recovery Key"
                        value={recoveryInput}
                        onChange={(e) => setRecoveryInput(e.target.value)}
                        placeholder="Enter your recovery key..."
                      />
                    </div>
                    <div className={styles.buttonRow}>
                      <Button variant="primary" onClick={handleRecover} disabled={loading || !recoveryInput.trim()}>
                        {loading ? "Recovering..." : "Recover Keys"}
                      </Button>
                      <Button onClick={handleResetKey} disabled={loading}>
                        Reset Key
                      </Button>
                    </div>
                  </>
                )}
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
