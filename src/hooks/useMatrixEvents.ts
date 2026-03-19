import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useMessagesStore, TimelineMessage } from "../stores/messages";
import { useTypingStore } from "../stores/typing";
import { useRoomsStore, RoomSummary } from "../stores/rooms";
import { useAuthStore } from "../stores/auth";
import { usePresenceStore } from "../stores/presence";
import { useSettingsStore } from "../stores/settings";
import { useReadReceiptStore } from "../stores/readReceipts";
import { soundEngine } from "../audio/SoundEngine";
import { useEncryptionStore } from "../stores/encryption";

interface TimelineEvent {
  roomId: string;
  message: TimelineMessage;
}

interface TypingEvent {
  roomId: string;
  userIds: string[];
}

interface PresenceEvent {
  userId: string;
  presence: "online" | "unavailable" | "offline";
  statusMsg: string | null;
  lastActiveAgo: number | null;
}

interface ReadReceiptEvent {
  roomId: string;
  userId: string;
  eventId: string;
}

interface VerificationRequestEvent {
  userId: string;
  flowId: string;
  timestamp: number;
}

interface RoomEncryptionChangedEvent {
  roomId: string;
  isEncrypted: boolean;
}

export function useMatrixEvents() {
  const addMessage = useMessagesStore((s) => s.addMessage);
  const updateMessage = useMessagesStore((s) => s.updateMessage);
  const removeMessage = useMessagesStore((s) => s.removeMessage);
  const setTyping = useTypingStore((s) => s.setTyping);
  const updateRoom = useRoomsStore((s) => s.updateRoom);
  const setRooms = useRoomsStore((s) => s.setRooms);
  const selectedRoomId = useRoomsStore((s) => s.selectedRoomId);
  const userId = useAuthStore((s) => s.userId);
  const setPresence = usePresenceStore((s) => s.setPresence);
  const getRoomNotification = useSettingsStore((s) => s.getRoomNotification);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setReceipt = useReadReceiptStore((s) => s.setReceipt);
  const addPendingVerification = useEncryptionStore((s) => s.addPendingVerification);

  useEffect(() => {
    (async () => {
      const granted = await isPermissionGranted();
      if (!granted) {
        await requestPermission();
      }
    })().catch(() => {});
  }, []);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    listen<TimelineEvent>("matrix://timeline", (event) => {
      const { roomId, message: msg } = event.payload;

      if ((msg as any).replaces) {
        updateMessage(roomId, (msg as any).replaces, {
          body: msg.body,
          formattedBody: msg.formattedBody,
          isEdited: true,
        });
        return;
      }

      if (msg.isRedacted) {
        removeMessage(roomId, msg.eventId);
      } else {
        addMessage(roomId, msg);

        const isFromSelf = msg.sender === userId;
        const isInSelectedRoom = roomId === selectedRoomId;
        const notifLevel = getRoomNotification(roomId);

        if (soundEnabled) {
          if (isFromSelf) {
            soundEngine.play("message-sent");
          } else if (notifLevel !== "mute") {
            soundEngine.play("message-received");
          }
        }

        if (!isInSelectedRoom && !isFromSelf) {
          updateRoom(roomId, {
            lastMessage: msg.body.slice(0, 100),
            lastMessageTimestamp: msg.timestamp,
          });

          if (notifLevel !== "mute" && !document.hasFocus()) {
            const senderName = msg.senderName || msg.sender;
            try { sendNotification({ title: `PufferChat \u2014 ${senderName}`, body: msg.body.slice(0, 200) }); } catch { /* ignore */ }
          }
        }
      }
    }).then((u) => unlisteners.push(u));

    listen<TypingEvent>("matrix://typing", (event) => {
      setTyping(event.payload.roomId, event.payload.userIds);
    }).then((u) => unlisteners.push(u));

    listen<ReadReceiptEvent>("matrix://read-receipt", (event) => {
      const { roomId, userId: receiptUserId, eventId } = event.payload;
      setReceipt(roomId, receiptUserId, eventId);
    }).then((u) => unlisteners.push(u));

    listen<PresenceEvent>("matrix://presence", (event) => {
      const { userId: uid, presence, statusMsg, lastActiveAgo } = event.payload;
      setPresence(uid, presence, statusMsg, lastActiveAgo);
    }).then((u) => unlisteners.push(u));

    listen<void>("matrix://rooms-changed", async () => {
      try {
        const rooms = await invoke<RoomSummary[]>("get_rooms");
        setRooms(rooms);
      } catch (e) {
        console.error("Failed to refresh rooms:", e);
      }
    }).then((u) => unlisteners.push(u));

    // Verification request received
    listen<VerificationRequestEvent>("matrix://verification-request-received", async (event) => {
      const { userId: fromUserId, flowId, timestamp } = event.payload;
      addPendingVerification({ userId: fromUserId, flowId, timestamp });

      // Play sound
      if (soundEnabled) {
        soundEngine.play("message-received");
      }

      // Send desktop notification
      try {
        const granted = await isPermissionGranted();
        if (granted) {
          sendNotification({
            title: "PufferChat — Verification Request",
            body: `${fromUserId} wants to verify your device`,
          });
        }
      } catch { /* ignore */ }
    }).then((u) => unlisteners.push(u));

    // Room encryption changed
    listen<RoomEncryptionChangedEvent>("matrix://room-encryption-changed", async (event) => {
      const { roomId, isEncrypted } = event.payload;
      updateRoom(roomId, { isEncrypted });
      // Also refresh rooms list
      try {
        const rooms = await invoke<RoomSummary[]>("get_rooms");
        setRooms(rooms);
      } catch { /* ignore */ }
    }).then((u) => unlisteners.push(u));

    return () => {
      unlisteners.forEach((u) => u());
    };
  }, [addMessage, updateMessage, removeMessage, setTyping, updateRoom, setRooms, userId, selectedRoomId, getRoomNotification, soundEnabled, setReceipt, addPendingVerification]);
}
