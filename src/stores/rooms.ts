import { create } from "zustand";

export interface RoomSummary {
  roomId: string;
  name: string | null;
  topic: string | null;
  avatarUrl: string | null;
  isDirect: boolean;
  isEncrypted: boolean;
  unreadCount: number;
  highlightCount: number;
  lastMessage: string | null;
  lastMessageTimestamp: number | null;
  memberCount: number;
}

export interface RoomsState {
  rooms: RoomSummary[];
  selectedRoomId: string | null;
  isLoading: boolean;

  // Actions
  setRooms: (rooms: RoomSummary[]) => void;
  updateRoom: (roomId: string, update: Partial<RoomSummary>) => void;
  selectRoom: (roomId: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useRoomsStore = create<RoomsState>((set) => ({
  rooms: [],
  selectedRoomId: null,
  isLoading: true,

  setRooms: (rooms) => set({ rooms, isLoading: false }),

  updateRoom: (roomId, update) =>
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.roomId === roomId ? { ...r, ...update } : r
      ),
    })),

  selectRoom: (roomId) => set({ selectedRoomId: roomId }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
