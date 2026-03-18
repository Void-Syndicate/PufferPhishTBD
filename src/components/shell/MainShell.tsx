import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRoomsStore, RoomSummary } from "../../stores/rooms";
import { useAuthStore } from "../../stores/auth";
import { useMatrixEvents } from "../../hooks/useMatrixEvents";
import BuddyList from "../buddy-list/BuddyList";
import ChatView from "../chat/ChatView";
import styles from "./MainShell.module.css";

export default function MainShell() {
  const { setRooms, setLoading, selectedRoomId } = useRoomsStore();
  const displayName = useAuthStore((s) => s.displayName);
  const userId = useAuthStore((s) => s.userId);
  const logout = useAuthStore((s) => s.logout);

  useMatrixEvents();

  useEffect(() => {
    async function loadRooms() {
      setLoading(true);
      try {
        const rooms = await invoke<RoomSummary[]>("get_rooms");
        setRooms(rooms);
      } catch (err) {
        console.error("Failed to load rooms:", err);
        setLoading(false);
      }
    }
    loadRooms();
  }, []);

  return (
    <div className={styles.shell}>
      {/* Menu Bar */}
      <div className={styles.menuBar}>
        <span className={styles.menuItem}>File</span>
        <span className={styles.menuItem}>Edit</span>
        <span className={styles.menuItem}>People</span>
        <span className={styles.menuItem}>Rooms</span>
        <span className={styles.menuItem}>Help</span>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.toolBtn}>📖 Read</button>
        <button className={styles.toolBtn}>✏️ Write</button>
        <button className={styles.toolBtn}>🏠 Rooms</button>
        <button className={styles.toolBtn}>👤 People</button>
        <button className={styles.toolBtn}>⚙️ Setup</button>
        <div className={styles.toolSpacer} />
        <button className={styles.toolBtn} onClick={logout}>🚪 Sign Off</button>
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Buddy List / Room List */}
        <div className={styles.sidebar}>
          <BuddyList />
        </div>

        {/* Chat Area */}
        <div className={styles.chatArea}>
          {selectedRoomId ? (
            <ChatView roomId={selectedRoomId} />
          ) : (
            <div className={styles.welcomeMessage}>
              <div className={styles.welcomeIcon}>🐡</div>
              <h2>Welcome, {displayName || userId}!</h2>
              <p>You've got rooms!</p>
              <p className={styles.welcomeHint}>
                Select a room from the Buddy List to start chatting.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className={styles.statusBar}>
        <span className={styles.statusItem}>Connected — {userId}</span>
        <span className={styles.statusItem}>🔒 E2EE Ready</span>
      </div>
    </div>
  );
}
