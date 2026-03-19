import { create } from "zustand";

export interface Reaction {
  emoji: string;
  senders: string[];
}

export interface MediaInfo {
  mimetype: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  thumbnailUrl: string | null;
  filename: string | null;
}

export interface TimelineMessage {
  eventId: string;
  sender: string;
  senderName: string | null;
  body: string;
  formattedBody: string | null;
  timestamp: number;
  isEdited: boolean;
  replyTo: string | null;
  reactions: Reaction[];
  isRedacted: boolean;
  replaces: string | null;
  avatarUrl: string | null;
  msgType: string;
  mediaUrl: string | null;
  mediaInfo: MediaInfo | null;
}

interface RoomMessages {
  messages: TimelineMessage[];
  endToken: string | null;
  hasMore: boolean;
  isLoading: boolean;
}

export interface MessagesState {
  rooms: Record<string, RoomMessages>;
  replyingTo: Record<string, TimelineMessage | null>;
  editingMessage: Record<string, TimelineMessage | null>;

  // Actions
  setMessages: (roomId: string, messages: TimelineMessage[], endToken: string | null, hasMore: boolean) => void;
  prependMessages: (roomId: string, messages: TimelineMessage[], endToken: string | null, hasMore: boolean) => void;
  addMessage: (roomId: string, message: TimelineMessage) => void;
  updateMessage: (roomId: string, eventId: string, update: Partial<TimelineMessage>) => void;
  removeMessage: (roomId: string, eventId: string) => void;
  addReaction: (roomId: string, eventId: string, emoji: string, sender: string) => void;
  setLoading: (roomId: string, loading: boolean) => void;
  setReplyingTo: (roomId: string, message: TimelineMessage | null) => void;
  setEditingMessage: (roomId: string, message: TimelineMessage | null) => void;
  getRoom: (roomId: string) => RoomMessages;
}

const emptyRoom: RoomMessages = { messages: [], endToken: null, hasMore: true, isLoading: false };

export const useMessagesStore = create<MessagesState>((set, get) => ({
  rooms: {},
  replyingTo: {},
  editingMessage: {},

  getRoom: (roomId) => get().rooms[roomId] ?? emptyRoom,

  setMessages: (roomId, messages, endToken, hasMore) =>
    set((s) => ({
      rooms: { ...s.rooms, [roomId]: { messages, endToken, hasMore, isLoading: false } },
    })),

  prependMessages: (roomId, messages, endToken, hasMore) =>
    set((s) => {
      const existing = s.rooms[roomId] ?? emptyRoom;
      return {
        rooms: {
          ...s.rooms,
          [roomId]: {
            messages: [...messages, ...existing.messages],
            endToken,
            hasMore,
            isLoading: false,
          },
        },
      };
    }),

  addMessage: (roomId, message) =>
    set((s) => {
      const existing = s.rooms[roomId] ?? emptyRoom;
      // Deduplicate
      if (existing.messages.some((m) => m.eventId === message.eventId)) return s;
      return {
        rooms: {
          ...s.rooms,
          [roomId]: { ...existing, messages: [...existing.messages, message] },
        },
      };
    }),

  updateMessage: (roomId, eventId, update) =>
    set((s) => {
      const existing = s.rooms[roomId];
      if (!existing) return s;
      return {
        rooms: {
          ...s.rooms,
          [roomId]: {
            ...existing,
            messages: existing.messages.map((m) =>
              m.eventId === eventId ? { ...m, ...update } : m
            ),
          },
        },
      };
    }),

  removeMessage: (roomId, eventId) =>
    set((s) => {
      const existing = s.rooms[roomId];
      if (!existing) return s;
      return {
        rooms: {
          ...s.rooms,
          [roomId]: {
            ...existing,
            messages: existing.messages.map((m) =>
              m.eventId === eventId ? { ...m, isRedacted: true, body: "[message deleted]" } : m
            ),
          },
        },
      };
    }),

  addReaction: (roomId, eventId, emoji, sender) =>
    set((s) => {
      const existing = s.rooms[roomId];
      if (!existing) return s;
      return {
        rooms: {
          ...s.rooms,
          [roomId]: {
            ...existing,
            messages: existing.messages.map((m) => {
              if (m.eventId !== eventId) return m;
              const reactions = [...m.reactions];
              const idx = reactions.findIndex((r) => r.emoji === emoji);
              if (idx >= 0) {
                if (!reactions[idx].senders.includes(sender)) {
                  reactions[idx] = { ...reactions[idx], senders: [...reactions[idx].senders, sender] };
                }
              } else {
                reactions.push({ emoji, senders: [sender] });
              }
              return { ...m, reactions };
            }),
          },
        },
      };
    }),

  setLoading: (roomId, loading) =>
    set((s) => ({
      rooms: {
        ...s.rooms,
        [roomId]: { ...(s.rooms[roomId] ?? emptyRoom), isLoading: loading },
      },
    })),

  setReplyingTo: (roomId, message) =>
    set((s) => ({ replyingTo: { ...s.replyingTo, [roomId]: message } })),

  setEditingMessage: (roomId, message) =>
    set((s) => ({ editingMessage: { ...s.editingMessage, [roomId]: message } })),
}));
