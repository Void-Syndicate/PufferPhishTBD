import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRoomsStore, RoomSummary } from "../../stores/rooms";
import { useAuthStore } from "../../stores/auth";
import { useMatrixEvents } from "../../hooks/useMatrixEvents";
import { soundEngine } from "../../audio/SoundEngine";
import BuddyList from "../buddy-list/BuddyList";
import ChatView from "../chat/ChatView";
import SoundSettings from "../settings/SoundSettings";
import styles from "./MainShell.module.css";

export default function MainShell() {
  const { setRooms, setLoading, selectedRoomId } = useRoomsStore();
  const displayName = useAuthStore((s) => s.displayName);
  const userId = useAuthStore((s) => s.userId);
  const logout = useAuthStore((s) => s.logout);
  const [showSettings, setShowSettings] = useState(false);

  useMatrixEvents();

  useEffect(() => {
    soundEngine.play("welcome");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initSync() {
      setLoading(true);
      try {
        await invoke("start_sync");
        let retries = 0;
        let rooms: RoomSummary[] = [];
        while (retries < 15 && !cancelled) {
          await new Promise((r) => setTimeout(r, 1000));
          rooms = await invoke<RoomSummary[]>("get_rooms");
          if (rooms.length > 0) break;
          retries++;
        }
        if (!cancelled) {
          setRooms(rooms);
        }
      } catch (err) {
        console.error("Failed to initialize sync:", err);
        if (!cancelled) setLoading(false);
      }
    }
    initSync();

    return () => { cancelled = true; };
  }, []);

  return (
    <div className={styles.shell}>
      <div className={styles.menuBar}>
        <span className={styles.menuItem}>File</span>
        <span className={styles.menuItem}>Edit</span>
        <span className={styles.menuItem}>People</span>
        <span className={styles.menuItem}>Rooms</span>
        <span className={styles.menuItem}>Help</span>
      </div>

      <div className={styles.toolbar}>
        <button className={styles.toolBtn}>{"\uD83D\uDCE8"} Read</button>
        <button className={styles.toolBtn}>{"\u270F\uFE0F"} Write</button>
        <button className={styles.toolBtn}>{"\uD83D\uDCAC"} Rooms</button>
        <button className={styles.toolBtn}>{"\uD83D\uDC65"} People</button>
        <button className={styles.toolBtn} onClick={() => setShowSettings(!showSettings)}>{"\u2699\uFE0F"} Setup</button>
        <div className={styles.toolSpacer} />
        <button className={styles.toolBtn} onClick={logout}>{"\uD83D\uDEAA"} Sign Off</button>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.sidebar}>
          <BuddyList />
        </div>

        <div className={styles.chatArea}>
          {selectedRoomId ? (
            <ChatView roomId={selectedRoomId} />
          ) : (
            <div className={styles.welcomeMessage}>
              <div className={styles.welcomeIcon}>{"\uD83D\uDC21"}</div>
              <h2>Welcome, {displayName || userId}!</h2>
              <p>You've got rooms!</p>
              <p className={styles.welcomeHint}>
                Select a room from the Buddy List to start chatting.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={styles.statusBar}>
        <span className={styles.statusItem}>Connected - {userId}</span>
        <span className={styles.statusItem}>{"\uD83D\uDD12"} E2EE Ready</span>
      </div>

      {showSettings && <SoundSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
