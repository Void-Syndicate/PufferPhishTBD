import { create } from "zustand";

export interface TypingState {
  typing: Record<string, string[]>; // roomId -> user_ids

  setTyping: (roomId: string, userIds: string[]) => void;
  getTyping: (roomId: string) => string[];
}

export const useTypingStore = create<TypingState>((set, get) => ({
  typing: {},

  setTyping: (roomId, userIds) =>
    set((s) => ({ typing: { ...s.typing, [roomId]: userIds } })),

  getTyping: (roomId) => get().typing[roomId] ?? [],
}));
