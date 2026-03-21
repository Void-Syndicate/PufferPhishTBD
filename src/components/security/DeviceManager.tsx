import { useState, useEffect } from "react";
import { useEncryption } from "../../hooks/useEncryption";
import { useEncryptionStore, DeviceInfo } from "../../stores/encryption";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import DeviceVerificationDialog from "./DeviceVerificationDialog";
import { useAuthStore } from "../../stores/auth";
import styles from "./Security.module.css";

interface DeviceManagerProps {
  onClose: () => void;
}

export default function DeviceManager({ onClose }: DeviceManagerProps) {
  const { loadDevices, deleteDevice, renameDevice } = useEncryption();
  const devices = useEncryptionStore((s) => s.devices);
  const devicesLoading = useEncryptionStore((s) => s.devicesLoading);
  const userId = useAuthStore((s) => s.userId);

  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [verifyingDevice, setVerifyingDevice] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDevices();
  }, []);

  const handleDelete = async (deviceId: string) => {
    if (!confirm(`Remove device "${deviceId}"? This will log it out.`)) return;
    try {
      await deleteDevice(deviceId);
    } catch (e: any) {
      setError(String(e));
    }
  };

  const handleRename = async (deviceId: string) => {
    if (!newName.trim()) return;
    try {
      await renameDevice(deviceId, newName.trim());
      setEditingDevice(null);
      setNewName("");
    } catch (e: any) {
      setError(String(e));
    }
  };

  const startEditing = (device: DeviceInfo) => {
    setEditingDevice(device.deviceId);
    setNewName(device.displayName || "");
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}>
          <Window
            title="💻 Device Manager"
            onClose={onClose}
            showMinimize={false}
            showMaximize={false}
            width={500}
          >
            <div className={styles.dialogBody}>
              <p className={styles.description}>
                Manage your sessions across all devices. Verify devices to
                ensure end-to-end encryption is secure.
              </p>

              {devicesLoading ? (
                <div className={styles.loading}>Loading devices...</div>
              ) : (
                <div className={styles.deviceList}>
                  {devices.map((device) => (
                    <div
                      key={device.deviceId}
                      className={`${styles.deviceItem} ${
                        device.isCurrent ? styles.deviceCurrent : ""
                      }`}
                    >
                      <div className={styles.deviceIcon}>
                        {device.isCurrent ? "🖥️" : "📱"}
                      </div>
                      <div className={styles.deviceInfo}>
                        {editingDevice === device.deviceId ? (
                          <div className={styles.editRow}>
                            <TextInput
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              placeholder="Device name"
                            />
                            <Button size="sm" onClick={() => handleRename(device.deviceId)}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setEditingDevice(null)}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className={styles.deviceName}>
                              {device.displayName || device.deviceId}
                              {device.isCurrent && (
                                <span className={styles.currentBadge}>
                                  (this device)
                                </span>
                              )}
                            </div>
                            <div className={styles.deviceId}>
                              {device.deviceId}
                            </div>
                            {device.lastSeenIp && (
                              <div className={styles.deviceMeta}>
                                Last seen: {device.lastSeenIp}
                                {device.lastSeenTs &&
                                  ` at ${new Date(device.lastSeenTs).toLocaleString()}`}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className={styles.deviceStatus}>
                        {device.isVerified ? (
                          <span className={styles.verified} title="Verified">
                            ✅
                          </span>
                        ) : (
                          <span className={styles.unverified} title="Unverified">
                            ⚠️
                          </span>
                        )}
                      </div>
                      <div className={styles.deviceActions}>
                        {!device.isVerified && userId && (
                          <Button
                            size="sm"
                            onClick={() =>
                              setVerifyingDevice(device.deviceId)
                            }
                          >
                            Verify
                          </Button>
                        )}
                        {!device.isCurrent && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => startEditing(device)}
                            >
                              ✏️
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDelete(device.deviceId)}
                            >
                              🗑️
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && <div className={styles.error}>⚠️ {error}</div>}

              <div className={styles.buttonRow}>
                <Button onClick={loadDevices}>Refresh</Button>
                <Button onClick={onClose}>Close</Button>
              </div>
            </div>
          </Window>
        </div>
      </div>

      {verifyingDevice && userId && (
        <DeviceVerificationDialog
          userId={userId}
          deviceId={verifyingDevice}
          onClose={() => {
            setVerifyingDevice(null);
            loadDevices(); // Refresh after verification
          }}
        />
      )}
    </>
  );
}
