import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRoomsStore, RoomSummary } from "../../stores/rooms";
import { useSettingsStore } from "../../stores/settings";
import { usePresenceStore } from "../../stores/presence";
import { useSpaces } from "../../hooks/useSpaces";
import { useSpacesStore, SpaceChild } from "../../stores/spaces";
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

function CollapsibleGroup({ title, children, count, icon, indent }: {
  title: string;
  children: React.ReactNode;
  count: number;
  icon?: string;
  indent?: number;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={styles.group} style={indent ? { paddingLeft: `${indent * 12}px` } : undefined}>
      <div
        className={styles.groupHeader}
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <span className={styles.expandIcon}>{expanded ? "\u25BC" : "\u25B6"}</span>
        {icon && <span style={{ fontSize: "11px", marginRight: "2px" }}>{icon}</span>}
        <span className={styles.groupTitle}>{title}</span>
        <span className={styles.groupCount}>({count})</span>
      </div>
      {expanded && <div className={styles.groupItems}>{children}</div>}
    </div>
  );
}

function SpaceSection() {
  const {
    spaces,
    childrenBySpace,
    isLoadingChildren,
    selectedSpaceId,
    expandedSpaces,
    fetchSpaces,
    fetchChildren,
    selectSpace,
    toggleExpanded,
  } = useSpaces();

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  // Fetch children for expanded spaces that aren't loaded yet
  useEffect(() => {
    for (const spaceId of expandedSpaces) {
      if (!childrenBySpace[spaceId] && !isLoadingChildren[spaceId]) {
        fetchChildren(spaceId);
      }
    }
  }, [expandedSpaces, childrenBySpace, isLoadingChildren, fetchChildren]);

  const handleSelect = (spaceId: string | null) => {
    selectSpace(spaceId);
    if (spaceId) {
      if (!expandedSpaces.has(spaceId)) {
        toggleExpanded(spaceId);
      }
      if (!childrenBySpace[spaceId] && !isLoadingChildren[spaceId]) {
        fetchChildren(spaceId);
      }
    }
  };

  if (spaces.length === 0) return null;

  const renderSubspaces = (children: SpaceChild[], depth: number) => {
    const subspaces = children.filter((c) => c.isSpace);
    if (subspaces.length === 0) return null;
    return subspaces.map((sub) => {
      const isExpanded = expandedSpaces.has(sub.roomId);
      const subChildren = childrenBySpace[sub.roomId] || [];
      return (
        <div key={sub.roomId} style={{ paddingLeft: `${depth * 10}px` }}>
          <div
            className={`${styles.spaceItem} ${selectedSpaceId === sub.roomId ? styles.spaceSelected : ""}`}
            onClick={() => handleSelect(sub.roomId)}
          >
            <span
              className={styles.expandIcon}
              onClick={(e) => { e.stopPropagation(); toggleExpanded(sub.roomId); if (!childrenBySpace[sub.roomId] && !isLoadingChildren[sub.roomId]) fetchChildren(sub.roomId); }}
              style={{ cursor: "pointer" }}
            >
              {isExpanded ? "\u25BC" : "\u25B6"}
            </span>
            <span style={{ fontSize: "11px" }}>{"\uD83D\uDCC2"}</span>
            <span className={styles.spaceName}>{sub.name || sub.roomId}</span>
          </div>
          {isExpanded && subChildren.length > 0 && renderSubspaces(subChildren, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className={styles.spacesSection}>
      <div className={styles.spacesSectionHeader}>
        <span style={{ fontSize: "11px" }}>{"\uD83D\uDCC1"}</span>
        <span style={{ fontWeight: "bold", fontSize: "10px", color: "var(--aol-blue-dark)" }}>Spaces</span>
      </div>

      <div
        className={`${styles.spaceItem} ${selectedSpaceId === null ? styles.spaceSelected : ""}`}
        onClick={() => handleSelect(null)}
      >
        <span style={{ fontSize: "11px", width: "14px", textAlign: "center" }}>{"\uD83C\uDF10"}</span>
        <span className={styles.spaceName}>All Rooms</span>
      </div>

      {spaces.map((space) => {
        const isExpanded = expandedSpaces.has(space.roomId);
        const children = childrenBySpace[space.roomId] || [];
        const loading = isLoadingChildren[space.roomId];
        return (
          <div key={space.roomId}>
            <div
              className={`${styles.spaceItem} ${selectedSpaceId === space.roomId ? styles.spaceSelected : ""}`}
              onClick={() => handleSelect(space.roomId)}
            >
              <span
                className={styles.expandIcon}
                onClick={(e) => { e.stopPropagation(); toggleExpanded(space.roomId); if (!childrenBySpace[space.roomId] && !isLoadingChildren[space.roomId]) fetchChildren(space.roomId); }}
                style={{ cursor: "pointer" }}
              >
                {isExpanded ? "\u25BC" : "\u25B6"}
              </span>
              <span style={{ fontSize: "11px" }}>{"\uD83D\uDCC1"}</span>
              <span className={styles.spaceName}>{space.name || space.roomId}</span>
              <span className={styles.groupCount}>({space.childCount})</span>
              {loading && <span style={{ fontSize: "9px", marginLeft: "2px" }}>{"\u23F3"}</span>}
            </div>
            {isExpanded && children.length > 0 && renderSubspaces(children, 1)}
          </div>
        );
      })}

      <div className={styles.spacesDivider} />
    </div>
  );
}

interface BuddyListProps {
  onCreateRoom?: () => void;
  onJoinRoom?: () => void;
}

export default function BuddyList({ onCreateRoom, onJoinRoom }: BuddyListProps) {
  const { rooms, selectedRoomId, selectRoom, isLoading } = useRoomsStore();
  const selectedSpaceId = useSpacesStore((s) => s.selectedSpaceId);
  const childRoomIdsBySpace = useSpacesStore((s) => s.childRoomIdsBySpace);
  const isLoadingChildren = useSpacesStore((s) => s.isLoadingChildren);

  const getFilteredRooms = (): RoomSummary[] => {
    if (!selectedSpaceId) return rooms;
    const childIds = childRoomIdsBySpace[selectedSpaceId];
    if (!childIds || childIds.size === 0) return [];
    return rooms.filter((r) => childIds.has(r.roomId));
  };

  const spaceLoading = selectedSpaceId ? isLoadingChildren[selectedSpaceId] : false;
  const filteredRooms = getFilteredRooms();
  const grouped = groupRooms(filteredRooms);

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
      ) : (
        <div className={styles.list}>
          <SpaceSection />

          {spaceLoading ? (
            <div className={styles.loading}>Loading space rooms...</div>
          ) : filteredRooms.length === 0 ? (
            <div className={styles.empty}>
              {selectedSpaceId ? "No rooms in this space." : "No rooms yet."}
            </div>
          ) : (
            <>
              {grouped.directs.length > 0 && (
                <CollapsibleGroup title="Buddies (DMs)" count={grouped.directs.length} icon={"\uD83D\uDC64"}>
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
                <CollapsibleGroup title="Chat Rooms" count={grouped.groups.length} icon={"\uD83D\uDCAC"}>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
