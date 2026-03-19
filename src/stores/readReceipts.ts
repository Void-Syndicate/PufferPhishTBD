import { create } from 'zustand';

export interface ReadReceiptState {
  // roomId -> { userId -> lastReadEventId }
  receipts: Record<string, Record<string, string>>;
  setReceipt: (roomId: string, userId: string, eventId: string) => void;
  getReadBy: (roomId: string, eventId: string) => string[];
}

export const useReadReceiptStore = create<ReadReceiptState>((set, get) => ({
  receipts: {},

  setReceipt: (roomId, userId, eventId) =>
    set((s) => ({
      receipts: {
        ...s.receipts,
        [roomId]: {
          ...(s.receipts[roomId] ?? {}),
          [userId]: eventId,
        },
      },
    })),

  getReadBy: (roomId, eventId) => {
    const roomReceipts = get().receipts[roomId];
    if (!roomReceipts) return [];
    return Object.entries(roomReceipts)
      .filter(([, eid]) => eid === eventId)
      .map(([uid]) => uid);
  },
}));
