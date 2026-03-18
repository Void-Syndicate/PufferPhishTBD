import { useState } from "react";
import { useRoomsStore, RoomSummary } from "../../stores/rooms";
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
  const name = room.name || room.roomId;
  const hasUnread = room.unreadCount > 0;

  return (
    <div
      className={`${styles.roomItem} ${isSelected ? styles.selected : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <span className={styles.presenceIcon}>
        {room.isDirect ? "👤" : "💬"}
      </span>
      <span className={`${styles.roomName} ${hasUnread ? styles.unread : ""}`}>
        {name}
      </span>
      {room.isEncrypted && <span className={styles.lockIcon}>🔒</span>}
      {hasUnread && (
        <span className={styles.unreadBadge}>
          {room.unreadCount > 99 ? "99+" : room.unreadCount}
        </span>
      )}
    </div>
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
        <span className={styles.expandIcon}>{expanded ? "▼" : "▶"}</span>
        <span className={styles.groupTitle}>{title}</span>
        <span className={styles.groupCount}>({count})</span>
      </div>
      {expanded && <div className={styles.groupItems}>{children}</div>}
    </div>
  );
}

export default function BuddyList() {
  const { rooms, selectedRoomId, selectRoom, isLoading } = useRoomsStore();
  const grouped = groupRooms(rooms);

  return (
    <div className={styles.buddyList}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>🐡</span>
        <span className={styles.headerTitle}>Buddy List</span>
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
