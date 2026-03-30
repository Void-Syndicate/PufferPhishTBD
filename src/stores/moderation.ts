import { create } from "zustand";

interface ModerationState {
  ignoredUsers: string[];
  setIgnoredUsers: (userIds: string[]) => void;
  addIgnoredUser: (userId: string) => void;
  removeIgnoredUser: (userId: string) => void;
  clear: () => void;
}

function normalizeUserIds(userIds: string[]) {
  return Array.from(new Set(userIds.map((userId) => userId.trim()).filter(Boolean))).sort();
}

export const useModerationStore = create<ModerationState>((set) => ({
  ignoredUsers: [],

  setIgnoredUsers: (userIds) => set({ ignoredUsers: normalizeUserIds(userIds) }),

  addIgnoredUser: (userId) =>
    set((state) => ({
      ignoredUsers: normalizeUserIds([...state.ignoredUsers, userId]),
    })),

  removeIgnoredUser: (userId) =>
    set((state) => ({
      ignoredUsers: state.ignoredUsers.filter((currentUserId) => currentUserId !== userId),
    })),

  clear: () => set({ ignoredUsers: [] }),
}));
