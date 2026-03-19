import { create } from "zustand";

export type NotificationLevel = "all" | "mentions" | "mute";

export interface SettingsState {
  roomNotifications: Record<string, NotificationLevel>;
  soundEnabled: boolean;
  soundVolume: number;
  setRoomNotification: (roomId: string, level: NotificationLevel) => void;
  getRoomNotification: (roomId: string) => NotificationLevel;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
}

function loadSettings(): Partial<SettingsState> {
  try {
    const saved = localStorage.getItem("pufferchat_settings");
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

function saveSettings(state: Partial<SettingsState>) {
  try {
    localStorage.setItem("pufferchat_settings", JSON.stringify({
      roomNotifications: state.roomNotifications,
      soundEnabled: state.soundEnabled,
      soundVolume: state.soundVolume,
    }));
  } catch { /* ignore */ }
}

const initial = loadSettings();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  roomNotifications: initial.roomNotifications ?? {},
  soundEnabled: initial.soundEnabled ?? true,
  soundVolume: initial.soundVolume ?? 0.5,

  setRoomNotification: (roomId, level) => {
    set((s) => {
      const updated = { ...s.roomNotifications, [roomId]: level };
      const newState = { ...s, roomNotifications: updated };
      saveSettings(newState);
      return { roomNotifications: updated };
    });
  },

  getRoomNotification: (roomId) => get().roomNotifications[roomId] ?? "all",

  setSoundEnabled: (enabled) => {
    set((s) => {
      const newState = { ...s, soundEnabled: enabled };
      saveSettings(newState);
      return { soundEnabled: enabled };
    });
  },

  setSoundVolume: (volume) => {
    set((s) => {
      const newState = { ...s, soundVolume: volume };
      saveSettings(newState);
      return { soundVolume: volume };
    });
  },
}));
