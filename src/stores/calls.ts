import { create } from "zustand";

export type CallState = "idle" | "ringing" | "connecting" | "connected" | "ended";
export type CallDirection = "outgoing" | "incoming";

export interface CallInfo {
  callId: string;
  roomId: string;
  state: CallState;
  direction: CallDirection;
  peerUserId: string;
  peerDisplayName: string | null;
  startedAt: number | null;
  endedAt: number | null;
  isVideo: boolean;
  partyId: string;
}

export interface CallHistoryEntry {
  callId: string;
  roomId: string;
  peerUserId: string;
  peerDisplayName: string | null;
  direction: CallDirection;
  isVideo: boolean;
  startedAt: number;
  endedAt: number | null;
  durationSecs: number | null;
  wasMissed: boolean;
}

export interface IceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: "audioinput" | "audiooutput" | "videoinput";
}

export interface CallsState {
  // Active call
  activeCall: CallInfo | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenShareStream: MediaStream | null;

  // UI state
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isPushToTalkEnabled: boolean;
  isPushToTalkActive: boolean;
  callDuration: number;

  // Device management
  selectedAudioInput: string | null;
  selectedAudioOutput: string | null;
  selectedVideoInput: string | null;
  availableDevices: DeviceInfo[];

  // Call history
  callHistory: CallHistoryEntry[];

  // Group call
  isGroupCall: boolean;
  groupParticipants: Array<{
    userId: string;
    displayName: string | null;
    stream: MediaStream | null;
    isMuted: boolean;
    isVideoEnabled: boolean;
    isSpeaking: boolean;
  }>;
  groupCallLayout: "grid" | "speaker";

  // Quality
  connectionQuality: "excellent" | "good" | "fair" | "poor" | "unknown";
  bitrate: number | null;

  // Actions
  setActiveCall: (call: CallInfo | null) => void;
  updateCallState: (state: CallState) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setScreenShareStream: (stream: MediaStream | null) => void;
  setMuted: (muted: boolean) => void;
  setVideoEnabled: (enabled: boolean) => void;
  setScreenSharing: (sharing: boolean) => void;
  setPushToTalkEnabled: (enabled: boolean) => void;
  setPushToTalkActive: (active: boolean) => void;
  setCallDuration: (duration: number) => void;
  setSelectedAudioInput: (deviceId: string | null) => void;
  setSelectedAudioOutput: (deviceId: string | null) => void;
  setSelectedVideoInput: (deviceId: string | null) => void;
  setAvailableDevices: (devices: DeviceInfo[]) => void;
  setCallHistory: (history: CallHistoryEntry[]) => void;
  addCallHistoryEntry: (entry: CallHistoryEntry) => void;
  setGroupCall: (isGroup: boolean) => void;
  setGroupParticipants: (participants: CallsState["groupParticipants"]) => void;
  setGroupCallLayout: (layout: "grid" | "speaker") => void;
  setConnectionQuality: (quality: CallsState["connectionQuality"]) => void;
  setBitrate: (bitrate: number | null) => void;
  resetCallState: () => void;
}

const initialState = {
  activeCall: null,
  localStream: null,
  remoteStream: null,
  screenShareStream: null,
  isMuted: false,
  isVideoEnabled: true,
  isScreenSharing: false,
  isPushToTalkEnabled: false,
  isPushToTalkActive: false,
  callDuration: 0,
  selectedAudioInput: null,
  selectedAudioOutput: null,
  selectedVideoInput: null,
  availableDevices: [],
  callHistory: [],
  isGroupCall: false,
  groupParticipants: [],
  groupCallLayout: "grid" as const,
  connectionQuality: "unknown" as const,
  bitrate: null,
};

export const useCallsStore = create<CallsState>((set) => ({
  ...initialState,

  setActiveCall: (call) => set({ activeCall: call }),
  updateCallState: (state) =>
    set((s) => ({
      activeCall: s.activeCall ? { ...s.activeCall, state } : null,
    })),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setScreenShareStream: (stream) => set({ screenShareStream: stream }),
  setMuted: (muted) => set({ isMuted: muted }),
  setVideoEnabled: (enabled) => set({ isVideoEnabled: enabled }),
  setScreenSharing: (sharing) => set({ isScreenSharing: sharing }),
  setPushToTalkEnabled: (enabled) => set({ isPushToTalkEnabled: enabled }),
  setPushToTalkActive: (active) => set({ isPushToTalkActive: active }),
  setCallDuration: (duration) => set({ callDuration: duration }),
  setSelectedAudioInput: (deviceId) => set({ selectedAudioInput: deviceId }),
  setSelectedAudioOutput: (deviceId) => set({ selectedAudioOutput: deviceId }),
  setSelectedVideoInput: (deviceId) => set({ selectedVideoInput: deviceId }),
  setAvailableDevices: (devices) => set({ availableDevices: devices }),
  setCallHistory: (history) => set({ callHistory: history }),
  addCallHistoryEntry: (entry) =>
    set((s) => ({ callHistory: [...s.callHistory, entry] })),
  setGroupCall: (isGroup) => set({ isGroupCall: isGroup }),
  setGroupParticipants: (participants) => set({ groupParticipants: participants }),
  setGroupCallLayout: (layout) => set({ groupCallLayout: layout }),
  setConnectionQuality: (quality) => set({ connectionQuality: quality }),
  setBitrate: (bitrate) => set({ bitrate }),
  resetCallState: () =>
    set({
      activeCall: null,
      localStream: null,
      remoteStream: null,
      screenShareStream: null,
      isMuted: false,
      isVideoEnabled: true,
      isScreenSharing: false,
      isPushToTalkActive: false,
      callDuration: 0,
      isGroupCall: false,
      groupParticipants: [],
      connectionQuality: "unknown",
      bitrate: null,
    }),
}));
