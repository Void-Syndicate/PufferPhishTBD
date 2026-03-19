import { create } from "zustand";

export interface DeviceInfo {
  deviceId: string;
  displayName: string | null;
  isVerified: boolean;
  isCurrent: boolean;
  lastSeenIp: string | null;
  lastSeenTs: number | null;
}

export interface VerificationEmoji {
  symbol: string;
  description: string;
}

export interface VerificationState {
  flowId: string;
  otherUserId: string;
  otherDeviceId: string | null;
  state: "requested" | "ready" | "started" | "emojis" | "done" | "cancelled";
  emojis: VerificationEmoji[] | null;
  decimals: [number, number, number] | null;
}

export interface PendingVerificationRequest {
  userId: string;
  flowId: string;
  timestamp: number;
}

export interface CrossSigningStatus {
  hasMaster: boolean;
  hasSelfSigning: boolean;
  hasUserSigning: boolean;
  isComplete: boolean;
}

export interface KeyBackupStatus {
  enabled: boolean;
  version: string | null;
  backedUpKeys: number;
  totalKeys: number;
  state: string;
}

export interface UserVerificationStatus {
  userId: string;
  isVerified: boolean;
  hasCrossSigningKeys: boolean;
}

export interface RoomEncryptionStatus {
  roomId: string;
  isEncrypted: boolean;
  algorithm: string | null;
  rotationPeriodMsgs: number | null;
}

export interface EncryptionState {
  // Devices
  devices: DeviceInfo[];
  devicesLoading: boolean;

  // Active verification
  activeVerification: VerificationState | null;

  // Cross-signing
  crossSigningStatus: CrossSigningStatus | null;

  // Key backup
  keyBackupStatus: KeyBackupStatus | null;

  // Recovery
  recoveryEnabled: boolean;
  recoveryKey: string | null;

  // User verification cache
  userVerifications: Record<string, UserVerificationStatus>;

  // Pending incoming verifications
  pendingVerifications: PendingVerificationRequest[];

  // Lock
  isLocked: boolean;
  autoLockEnabled: boolean;
  lockTimeoutSecs: number;

  // Actions
  setDevices: (devices: DeviceInfo[]) => void;
  setDevicesLoading: (loading: boolean) => void;
  setActiveVerification: (v: VerificationState | null) => void;
  setCrossSigningStatus: (status: CrossSigningStatus | null) => void;
  setKeyBackupStatus: (status: KeyBackupStatus | null) => void;
  setRecoveryEnabled: (enabled: boolean) => void;
  setRecoveryKey: (key: string | null) => void;
  setUserVerification: (userId: string, status: UserVerificationStatus) => void;
  getUserVerification: (userId: string) => UserVerificationStatus | null;
  addPendingVerification: (req: PendingVerificationRequest) => void;
  removePendingVerification: (flowId: string) => void;
  clearPendingVerifications: () => void;
  setIsLocked: (locked: boolean) => void;
  setAutoLockEnabled: (enabled: boolean) => void;
  setLockTimeoutSecs: (secs: number) => void;
}

export const useEncryptionStore = create<EncryptionState>((set, get) => ({
  devices: [],
  devicesLoading: false,
  activeVerification: null,
  crossSigningStatus: null,
  keyBackupStatus: null,
  recoveryEnabled: false,
  recoveryKey: null,
  userVerifications: {},
  pendingVerifications: [],
  isLocked: false,
  autoLockEnabled: false,
  lockTimeoutSecs: 300,

  setDevices: (devices) => set({ devices }),
  setDevicesLoading: (loading) => set({ devicesLoading: loading }),
  setActiveVerification: (v) => set({ activeVerification: v }),
  setCrossSigningStatus: (status) => set({ crossSigningStatus: status }),
  setKeyBackupStatus: (status) => set({ keyBackupStatus: status }),
  setRecoveryEnabled: (enabled) => set({ recoveryEnabled: enabled }),
  setRecoveryKey: (key) => set({ recoveryKey: key }),
  setUserVerification: (userId, status) =>
    set((s) => ({
      userVerifications: { ...s.userVerifications, [userId]: status },
    })),
  getUserVerification: (userId) => get().userVerifications[userId] ?? null,
  addPendingVerification: (req) =>
    set((s) => {
      // Deduplicate by flowId
      if (s.pendingVerifications.some((p) => p.flowId === req.flowId)) return s;
      return { pendingVerifications: [...s.pendingVerifications, req] };
    }),
  removePendingVerification: (flowId) =>
    set((s) => ({
      pendingVerifications: s.pendingVerifications.filter((p) => p.flowId !== flowId),
    })),
  clearPendingVerifications: () => set({ pendingVerifications: [] }),
  setIsLocked: (locked) => set({ isLocked: locked }),
  setAutoLockEnabled: (enabled) => set({ autoLockEnabled: enabled }),
  setLockTimeoutSecs: (secs) => set({ lockTimeoutSecs: secs }),
}));
