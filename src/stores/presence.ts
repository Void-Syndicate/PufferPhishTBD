import { create } from "zustand";

export type PresenceStatus = "online" | "unavailable" | "offline";

export interface UserPresence {
  presence: PresenceStatus;
  statusMsg: string | null;
  lastActiveAgo: number | null;
  updatedAt: number;
}

interface PresenceState {
  users: Record<string, UserPresence>;
  setPresence: (userId: string, presence: PresenceStatus, statusMsg: string | null, lastActiveAgo: number | null) => void;
  getPresence: (userId: string) => PresenceStatus;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  users: {},

  setPresence: (userId, presence, statusMsg, lastActiveAgo) =>
    set((s) => ({
      users: {
        ...s.users,
        [userId]: { presence, statusMsg, lastActiveAgo, updatedAt: Date.now() },
      },
    })),

  getPresence: (userId) => get().users[userId]?.presence ?? "offline",
}));
