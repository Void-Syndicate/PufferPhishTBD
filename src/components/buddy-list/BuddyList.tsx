import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRoomsStore, RoomSummary } from "../../stores/rooms";
import { useSettingsStore } from "../../stores/settings";
import { usePresenceStore } from "../../stores/presence";
import Avatar from "../retro/Avatar";
import styles from "./BuddyList.module.css";

interface GroupedRooms {
  directs: RoomSummary[];
  groups: RoomSummary[];
}

function groupRooms(rooms: RoomSummary[]): GroupedRooms {
  return {
    directs: rooms.filter((r) => r.isDirect),
    groups: rooms.filter((r) => !r.isDirect),
  };
}

function RoomItem({ room, isSelected, onSelect }: {
  room: RoomSummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const presenceUsers = usePresenceStore((s) => s.users);
  const name = room.name || room.roomId;
  const hasUnread = room.unreadCount > 0;
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const notifLevel = useSettingsStore((s) => s.getRoomNotification(room.roomId));
  const setRoomNotification = useSettingsStore((s) => s.setRoomNotification);

  const handleCtx = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  const handleLeave = async () => {
    setCtxMenu(null);
    if (!confirm(`Leave "${name}"?`)) return;
    try {
      await invoke("leave_room", { roomId: room.roomId });
      const rooms = await invoke<RoomSummary[]>("get_rooms");
      useRoomsStore.getState().setRooms(rooms);
      if (useRoomsStore.getState().selectedRoomId === room.roomId) {
        useRoomsStore.getState().selectRoom(null);
      }
    } catch (e) {
      console.error("Failed to leave room:", e);
    }
  };

  return (
    <>
      <div
        className={`${styles.roomItem} ${isSelected ? styles.selected : ""}`}
        onClick={onSelect}
        onContextMenu={handleCtx}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
      >
        <Avatar
          name={name}
          avatarUrl={room.avatarUrl}
          size="small"
          shape={room.isDirect ? "circle" : "square"}
          presence={room.isDirect ? (presenceUsers[room.roomId]?.presence ?? "offline") : null}
        />
        <span className={`${styles.roomName} ${hasUnread ? styles.unread : ""}`}>
          {name}
        </span>
        {room.isEncrypted && <span className={styles.lockIcon}>{"\uD83D\uDD12"}</span>}
        {notifLevel === "mute" && <span className={styles.lockIcon}>{"\uD83D\uDD15"}</span>}
        {notifLevel === "mentions" && <span className={styles.lockIcon}>{"\uD83D\uDCAC"}</span>}
        {hasUnread && (
          <span className={styles.unreadBadge}>
            {room.unreadCount > 99 ? "99+" : room.unreadCount}
          </span>
        )}
      </div>
      {ctxMenu && (
        <div style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, background: "var(--win-bg)", border: "2px solid", borderColor: "var(--win-border-light) var(--win-border-dark) var(--win-border-dark) var(--win-border-light)", zIndex: 999, padding: "2px", fontFamily: "var(--font-system)", fontSize: "11px" }}>
          <div style={{ padding: "3px 12px", cursor: "pointer", background: notifLevel === "all" ? "var(--aol-blue)" : "transparent", color: notifLevel === "all" ? "white" : "black" }} onClick={() => { setRoomNotification(room.roomId, "all"); setCtxMenu(null); }}>{"\uD83D\uDD14"} All Messages</div>
          <div style={{ padding: "3px 12px", cursor: "pointer", background: notifLevel === "mentions" ? "var(--aol-blue)" : "transparent", color: notifLevel === "mentions" ? "white" : "black" }} onClick={() => { setRoomNotification(room.roomId, "mentions"); setCtxMenu(null); }}>{"\uD83D\uDCAC"} Mentions Only</div>
          <div style={{ padding: "3px 12px", cursor: "pointer", background: notifLevel === "mute" ? "var(--aol-blue)" : "transparent", color: notifLevel === "mute" ? "white" : "black" }} onClick={() => { setRoomNotification(room.roomId, "mute"); setCtxMenu(null); }}>{"\uD83D\uDD15"} Mute</div>
          <div style={{ height: "1px", background: "var(--win-border-shadow)", margin: "2px 0" }} />
          <div style={{ padding: "3px 12px", cursor: "pointer", color: "#CC0000" }} onClick={handleLeave}>{"\uD83D\uDEAA"} Leave Room</div>
        </div>
      )}
    </>
  );
}

function CollapsibleGroup({ title, children, count }: {
  title: string;
  children: React.ReactNode;
  count: number;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={styles.group}>
      <div
        className={styles.groupHeader}
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <span className={styles.expandIcon}>{expanded ? "\u25BC" : "\u25B6"}</span>
        <span className={styles.groupTitle}>{title}</span>
        <span className={styles.groupCount}>({count})</span>
      </div>
      {expanded && <div className={styles.groupItems}>{children}</div>}
    </div>
  );
}

interface BuddyListProps {
  onCreateRoom?: () => void;
  onJoinRoom?: () => void;
}

export default function BuddyList({ onCreateRoom, onJoinRoom }: BuddyListProps) {
  const { rooms, selectedRoomId, selectRoom, isLoading } = useRoomsStore();
  const grouped = groupRooms(rooms);

  return (
    <div className={styles.buddyList}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>{"\uD83D\uDC21"}</span>
        <span className={styles.headerTitle}>Buddy List</span>
        <div className={styles.headerActions}>
          {onCreateRoom && (
            <button className={styles.headerBtn} onClick={onCreateRoom} title="Create Room">+</button>
          )}
          {onJoinRoom && (
            <button className={styles.headerBtn} onClick={onJoinRoom} title="Join Room">#</button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Loading rooms...</div>
      ) : rooms.length === 0 ? (
        <div className={styles.empty}>No rooms yet.</div>
      ) : (
        <div className={styles.list}>
          {grouped.directs.length > 0 && (
            <CollapsibleGroup title="Buddies (DMs)" count={grouped.directs.length}>
              {grouped.directs.map((room) => (
                <RoomItem
                  key={room.roomId}
                  room={room}
                  isSelected={selectedRoomId === room.roomId}
                  onSelect={() => selectRoom(room.roomId)}
                />
              ))}
            </CollapsibleGroup>
          )}

          {grouped.groups.length > 0 && (
            <CollapsibleGroup title="Chat Rooms" count={grouped.groups.length}>
              {grouped.groups.map((room) => (
                <RoomItem
                  key={room.roomId}
                  room={room}
                  isSelected={selectedRoomId === room.roomId}
                  onSelect={() => selectRoom(room.roomId)}
                />
              ))}
            </CollapsibleGroup>
          )}
        </div>
      )}
    </div>
  );
}
