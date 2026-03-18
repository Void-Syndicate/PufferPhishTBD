import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useMessagesStore, TimelineMessage } from "../stores/messages";
import { useTypingStore } from "../stores/typing";
import { useRoomsStore, RoomSummary } from "../stores/rooms";

interface TimelineEvent {
  room_id: string;
  event: TimelineMessage;
}

interface TypingEvent {
  room_id: string;
  user_ids: string[];
}

interface ReadReceiptEvent {
  room_id: string;
  user_id: string;
  event_id: string;
}

interface RoomUpdateEvent {
  room_id: string;
  [key: string]: unknown;
}

export function useMatrixEvents() {
  const addMessage = useMessagesStore((s) => s.addMessage);
  const updateMessage = useMessagesStore((s) => s.updateMessage);
  const removeMessage = useMessagesStore((s) => s.removeMessage);
  const setTyping = useTypingStore((s) => s.setTyping);
  const updateRoom = useRoomsStore((s) => s.updateRoom);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    listen<TimelineEvent>("matrix://timeline", (event) => {
      const { room_id, event: msg } = event.payload;
      if (msg.isRedacted) {
        removeMessage(room_id, msg.eventId);
      } else if (msg.isEdited) {
        updateMessage(room_id, msg.eventId, msg);
      } else {
        addMessage(room_id, msg);
      }
    }).then((u) => unlisteners.push(u));

    listen<TypingEvent>("matrix://typing", (event) => {
      setTyping(event.payload.room_id, event.payload.user_ids);
    }).then((u) => unlisteners.push(u));

    listen<ReadReceiptEvent>("matrix://read-receipt", (_event) => {
      // Future: track read receipts per user
    }).then((u) => unlisteners.push(u));

    listen<RoomUpdateEvent>("matrix://room-update", (event) => {
      const { room_id, ...rest } = event.payload;
      updateRoom(room_id, rest as Partial<RoomSummary>);
    }).then((u) => unlisteners.push(u));

    return () => {
      unlisteners.forEach((u) => u());
    };
  }, [addMessage, updateMessage, removeMessage, setTyping, updateRoom]);
}
