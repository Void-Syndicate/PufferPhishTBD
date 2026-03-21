import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  useEncryptionStore,
  DeviceInfo,
  VerificationState,
  CrossSigningStatus,
  KeyBackupStatus,
  UserVerificationStatus,
  RoomEncryptionStatus,
} from "../stores/encryption";

/**
 * Hook providing all encryption operations for the frontend.
 * Each method wraps a Tauri command and updates the encryption store.
 */
export function useEncryption() {
  const store = useEncryptionStore();

  // ── Device Management ──────────────────────────────────

  const loadDevices = useCallback(async () => {
    store.setDevicesLoading(true);
    try {
      const devices = await invoke<DeviceInfo[]>("get_own_devices");
      store.setDevices(devices);
    } catch (e) {
      console.error("Failed to load devices:", e);
    } finally {
      store.setDevicesLoading(false);
    }
  }, []);

  const deleteDevice = useCallback(async (deviceId: string) => {
    await invoke("delete_device", { deviceId });
    await loadDevices();
  }, [loadDevices]);

  const renameDevice = useCallback(async (deviceId: string, newName: string) => {
    await invoke("rename_device", { deviceId, newName });
    await loadDevices();
  }, [loadDevices]);

  // ── Room Encryption ────────────────────────────────────

  const enableRoomEncryption = useCallback(async (roomId: string) => {
    await invoke("enable_room_encryption", { roomId });
  }, []);

  const getRoomEncryptionStatus = useCallback(async (roomId: string): Promise<RoomEncryptionStatus> => {
    return await invoke<RoomEncryptionStatus>("get_room_encryption_status", { roomId });
  }, []);

  // ── Verification ───────────────────────────────────────

  const requestVerification = useCallback(async (userId: string): Promise<string> => {
    const flowId = await invoke<string>("request_verification", { userId });
    store.setActiveVerification({
      flowId,
      otherUserId: userId,
      otherDeviceId: null,
      state: "requested",
      emojis: null,
      decimals: null,
    });
    return flowId;
  }, []);

  const requestDeviceVerification = useCallback(async (userId: string, deviceId: string): Promise<string> => {
    const flowId = await invoke<string>("request_device_verification", { userId, deviceId });
    store.setActiveVerification({
      flowId,
      otherUserId: userId,
      otherDeviceId: deviceId,
      state: "requested",
      emojis: null,
      decimals: null,
    });
    return flowId;
  }, []);

  const acceptVerification = useCallback(async (userId: string, flowId: string) => {
    await invoke("accept_verification", { userId, flowId });
    const current = useEncryptionStore.getState().activeVerification;
    if (current?.flowId === flowId) {
      store.setActiveVerification({ ...current, state: "ready" });
    }
  }, []);

  const startSasVerification = useCallback(async (userId: string, flowId: string) => {
    await invoke("start_sas_verification", { userId, flowId });
    const current = useEncryptionStore.getState().activeVerification;
    if (current?.flowId === flowId) {
      store.setActiveVerification({ ...current, state: "started" });
    }
  }, []);

  const getSasEmojis = useCallback(async (userId: string, flowId: string) => {
    const emojis = await invoke<any[] | null>("get_sas_emojis", { userId, flowId });
    if (emojis) {
      const current = useEncryptionStore.getState().activeVerification;
      if (current?.flowId === flowId) {
        store.setActiveVerification({ ...current, state: "emojis", emojis });
      }
    }
    return emojis;
  }, []);

  const confirmSasVerification = useCallback(async (userId: string, flowId: string) => {
    await invoke("confirm_sas_verification", { userId, flowId });
    const current = useEncryptionStore.getState().activeVerification;
    if (current?.flowId === flowId) {
      store.setActiveVerification({ ...current, state: "done" });
    }
  }, []);

  const cancelVerification = useCallback(async (userId: string, flowId: string) => {
    await invoke("cancel_verification", { userId, flowId });
    store.setActiveVerification(null);
  }, []);

  const pollVerificationState = useCallback(async (userId: string, flowId: string) => {
    try {
      const state = await invoke<VerificationState>("get_verification_state", { userId, flowId });
      store.setActiveVerification(state);
      return state;
    } catch {
      return null;
    }
  }, []);

  // ── Cross-signing ──────────────────────────────────────

  const bootstrapCrossSigning = useCallback(async () => {
    await invoke("bootstrap_cross_signing");
    await loadCrossSigningStatus();
  }, []);

  const loadCrossSigningStatus = useCallback(async () => {
    try {
      const status = await invoke<CrossSigningStatus>("get_cross_signing_status");
      store.setCrossSigningStatus(status);
    } catch (e) {
      console.error("Failed to load cross-signing status:", e);
    }
  }, []);

  const getUserVerificationStatus = useCallback(async (userId: string) => {
    try {
      const status = await invoke<UserVerificationStatus>("get_user_verification_status", { userId });
      store.setUserVerification(userId, status);
      return status;
    } catch {
      return null;
    }
  }, []);

  // ── Key Backup ─────────────────────────────────────────

  const enableKeyBackup = useCallback(async () => {
    await invoke("enable_key_backup");
    await loadKeyBackupStatus();
  }, []);

  const disableKeyBackup = useCallback(async () => {
    await invoke("disable_key_backup");
    await loadKeyBackupStatus();
  }, []);

  const loadKeyBackupStatus = useCallback(async () => {
    try {
      const status = await invoke<KeyBackupStatus>("get_key_backup_status");
      store.setKeyBackupStatus(status);
    } catch (e) {
      console.error("Failed to load key backup status:", e);
    }
  }, []);

  // ── Secret Storage / Recovery ──────────────────────────

  const setupSecretStorage = useCallback(async (): Promise<string> => {
    const key = await invoke<string>("setup_secret_storage");
    store.setRecoveryEnabled(true);
    store.setRecoveryKey(key);
    return key;
  }, []);

  const checkRecoveryEnabled = useCallback(async () => {
    const enabled = await invoke<boolean>("is_recovery_enabled");
    store.setRecoveryEnabled(enabled);
    return enabled;
  }, []);

  const recoverWithKey = useCallback(async (recoveryKey: string) => {
    await invoke("recover_with_key", { recoveryKey });
  }, []);

  const resetRecoveryKey = useCallback(async (): Promise<string> => {
    const key = await invoke<string>("reset_recovery_key");
    store.setRecoveryKey(key);
    return key;
  }, []);

  // ── Key Export/Import ──────────────────────────────────

  const exportRoomKeys = useCallback(async (passphrase: string): Promise<string> => {
    return await invoke<string>("export_room_keys", { passphrase });
  }, []);

  const importRoomKeys = useCallback(async (data: string, passphrase: string): Promise<number> => {
    return await invoke<number>("import_room_keys", { data, passphrase });
  }, []);

  // ── Auto-lock ──────────────────────────────────────────

  const setupAutoLock = useCallback(async (passphrase: string, timeoutSecs: number) => {
    await invoke("setup_auto_lock", { passphrase, timeoutSecs });
    store.setAutoLockEnabled(true);
    store.setLockTimeoutSecs(timeoutSecs);
  }, []);

  const verifyUnlockPassphrase = useCallback(async (passphrase: string): Promise<boolean> => {
    const valid = await invoke<boolean>("verify_unlock_passphrase", { passphrase });
    if (valid) store.setIsLocked(false);
    return valid;
  }, []);

  const lockApp = useCallback(async () => {
    await invoke("lock_app");
    store.setIsLocked(true);
  }, []);

  const checkLockState = useCallback(async () => {
    const locked = await invoke<boolean>("is_app_locked");
    store.setIsLocked(locked);
    const enabled = await invoke<boolean>("is_auto_lock_enabled");
    store.setAutoLockEnabled(enabled);
    if (enabled) {
      const timeout = await invoke<number>("get_lock_timeout");
      store.setLockTimeoutSecs(timeout);
    }
  }, []);

  const disableAutoLock = useCallback(async () => {
    await invoke("disable_auto_lock");
    store.setAutoLockEnabled(false);
  }, []);

  return {
    // Device management
    loadDevices,
    deleteDevice,
    renameDevice,
    // Room encryption
    enableRoomEncryption,
    getRoomEncryptionStatus,
    // Verification
    requestVerification,
    requestDeviceVerification,
    acceptVerification,
    startSasVerification,
    getSasEmojis,
    confirmSasVerification,
    cancelVerification,
    pollVerificationState,
    // Cross-signing
    bootstrapCrossSigning,
    loadCrossSigningStatus,
    getUserVerificationStatus,
    // Key backup
    enableKeyBackup,
    disableKeyBackup,
    loadKeyBackupStatus,
    // Secret storage / Recovery
    setupSecretStorage,
    checkRecoveryEnabled,
    recoverWithKey,
    resetRecoveryKey,
    // Key export/import
    exportRoomKeys,
    importRoomKeys,
    // Auto-lock
    setupAutoLock,
    verifyUnlockPassphrase,
    lockApp,
    checkLockState,
    disableAutoLock,
  };
}
