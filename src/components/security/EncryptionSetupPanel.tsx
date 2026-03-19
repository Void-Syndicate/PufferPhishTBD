import { useState, useEffect } from "react";
import { useEncryption } from "../../hooks/useEncryption";
import { useEncryptionStore } from "../../stores/encryption";
import Window from "../retro/Window";
import Button from "../retro/Button";
import styles from "./Security.module.css";

interface EncryptionSetupPanelProps {
  onClose: () => void;
  onOpenDevices: () => void;
  onOpenKeyBackup: () => void;
  onOpenKeyExport: () => void;
  onOpenAutoLock: () => void;
}

export default function EncryptionSetupPanel({
  onClose,
  onOpenDevices,
  onOpenKeyBackup,
  onOpenKeyExport,
  onOpenAutoLock,
}: EncryptionSetupPanelProps) {
  const {
    bootstrapCrossSigning,
    loadCrossSigningStatus,
    loadKeyBackupStatus,
    checkRecoveryEnabled,
    checkLockState,
  } = useEncryption();

  const crossSigningStatus = useEncryptionStore((s) => s.crossSigningStatus);
  const keyBackupStatus = useEncryptionStore((s) => s.keyBackupStatus);
  const recoveryEnabled = useEncryptionStore((s) => s.recoveryEnabled);
  const autoLockEnabled = useEncryptionStore((s) => s.autoLockEnabled);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadCrossSigningStatus();
    loadKeyBackupStatus();
    checkRecoveryEnabled();
    checkLockState();
  }, []);

  const handleBootstrap = async () => {
    setLoading(true);
    setError("");
    try {
      await bootstrapCrossSigning();
      setSuccess("Cross-signing keys created!");
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
          title="🛡️ Encryption & Security"
          onClose={onClose}
          showMinimize={false}
          showMaximize={false}
          width={480}
        >
          <div className={styles.dialogBody}>
            <p className={styles.description}>
              Manage your encryption settings, device verification, key backup,
              and security preferences.
            </p>

            {/* Cross-signing status */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>🔏 Cross-Signing</h3>
              {crossSigningStatus ? (
                <div className={styles.statusBox}>
                  <div className={styles.statusRow}>
                    <span>Master Key:</span>
                    <span className={crossSigningStatus.hasMaster ? styles.statusGood : styles.statusWarn}>
                      {crossSigningStatus.hasMaster ? "✅" : "❌"}
                    </span>
                  </div>
                  <div className={styles.statusRow}>
                    <span>Self-signing Key:</span>
                    <span className={crossSigningStatus.hasSelfSigning ? styles.statusGood : styles.statusWarn}>
                      {crossSigningStatus.hasSelfSigning ? "✅" : "❌"}
                    </span>
                  </div>
                  <div className={styles.statusRow}>
                    <span>User-signing Key:</span>
                    <span className={crossSigningStatus.hasUserSigning ? styles.statusGood : styles.statusWarn}>
                      {crossSigningStatus.hasUserSigning ? "✅" : "❌"}
                    </span>
                  </div>
                </div>
              ) : (
                <p>Loading...</p>
              )}
              {crossSigningStatus && !crossSigningStatus.isComplete && (
                <Button variant="primary" onClick={handleBootstrap} disabled={loading}>
                  {loading ? "Setting up..." : "Setup Cross-Signing"}
                </Button>
              )}
            </div>

            {/* Quick status overview */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>📊 Security Overview</h3>
              <div className={styles.statusBox}>
                <div className={styles.statusRow}>
                  <span>Key Backup:</span>
                  <span className={keyBackupStatus?.enabled ? styles.statusGood : styles.statusWarn}>
                    {keyBackupStatus?.enabled ? "✅ Enabled" : "⚠️ Not enabled"}
                  </span>
                </div>
                <div className={styles.statusRow}>
                  <span>Recovery:</span>
                  <span className={recoveryEnabled ? styles.statusGood : styles.statusWarn}>
                    {recoveryEnabled ? "✅ Enabled" : "⚠️ Not set up"}
                  </span>
                </div>
                <div className={styles.statusRow}>
                  <span>Auto-lock:</span>
                  <span className={autoLockEnabled ? styles.statusGood : styles.statusWarn}>
                    {autoLockEnabled ? "✅ Enabled" : "❌ Disabled"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>⚙️ Security Tools</h3>
              <div className={styles.toolGrid}>
                <button className={styles.toolCard} onClick={onOpenDevices}>
                  <span className={styles.toolIcon}>💻</span>
                  <span className={styles.toolLabel}>Devices</span>
                </button>
                <button className={styles.toolCard} onClick={onOpenKeyBackup}>
                  <span className={styles.toolIcon}>🗄️</span>
                  <span className={styles.toolLabel}>Key Backup</span>
                </button>
                <button className={styles.toolCard} onClick={onOpenKeyExport}>
                  <span className={styles.toolIcon}>📦</span>
                  <span className={styles.toolLabel}>Export/Import</span>
                </button>
                <button className={styles.toolCard} onClick={onOpenAutoLock}>
                  <span className={styles.toolIcon}>🔒</span>
                  <span className={styles.toolLabel}>Auto-Lock</span>
                </button>
              </div>
            </div>

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
