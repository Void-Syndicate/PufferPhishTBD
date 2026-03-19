import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRoomsStore, RoomSummary } from "../../stores/rooms";
import { useAuthStore } from "../../stores/auth";
import { useEncryptionStore } from "../../stores/encryption";
import { useEncryption } from "../../hooks/useEncryption";
import { useMatrixEvents } from "../../hooks/useMatrixEvents";
import { soundEngine } from "../../audio/SoundEngine";
import BuddyList from "../buddy-list/BuddyList";
import ChatView from "../chat/ChatView";
import SoundSettings from "../settings/SoundSettings";
import CreateRoomDialog from "../rooms/CreateRoomDialog";
import JoinRoomDialog from "../rooms/JoinRoomDialog";
import RoomDirectoryDialog from "../rooms/RoomDirectoryDialog";
import InviteDialog from "../rooms/InviteDialog";
import PendingInvitesDialog from "../rooms/PendingInvitesDialog";
import EncryptionSetupPanel from "../security/EncryptionSetupPanel";
import DeviceManager from "../security/DeviceManager";
import DeviceVerificationDialog from "../security/DeviceVerificationDialog";
import KeyBackupDialog from "../security/KeyBackupDialog";
import KeyExportImportDialog from "../security/KeyExportImportDialog";
import AutoLockSettings from "../security/AutoLockSettings";
import IncomingVerificationDialog from "../security/IncomingVerificationDialog";
import styles from "./MainShell.module.css";

type DialogType = "create" | "join" | "directory" | "invite" | "invites" | "settings"
  | "encryption-setup" | "device-manager" | "device-verify" | "key-backup" | "key-export" | "auto-lock"
  | null;

export default function MainShell() {
  const { setRooms, setLoading, selectedRoomId, rooms, selectRoom } = useRoomsStore();
  const displayName = useAuthStore((s) => s.displayName);
  const userId = useAuthStore((s) => s.userId);
  const logout = useAuthStore((s) => s.logout);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const { lockApp } = useEncryption();
  const autoLockEnabled = useEncryptionStore((s) => s.autoLockEnabled);

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

  const refreshRooms = async () => {
    try {
      const updatedRooms = await invoke<RoomSummary[]>("get_rooms");
      setRooms(updatedRooms);
    } catch (e) {
      console.error("Failed to refresh rooms:", e);
    }
  };

  const handleRoomCreated = async (roomId: string) => {
    await refreshRooms();
    selectRoom(roomId);
  };

  const handleRoomJoined = async (roomId: string) => {
    await refreshRooms();
    selectRoom(roomId);
  };

  const selectedRoom = rooms.find((r) => r.roomId === selectedRoomId);

  return (
    <div className={styles.shell}>
      <div className={styles.menuBar}>
        <span className={styles.menuItem}>File</span>
        <span className={styles.menuItem}>Edit</span>
        <span className={styles.menuItem}>People</span>
        <span className={styles.menuItem} onClick={() => setActiveDialog("directory")}>Rooms</span>
        <span className={styles.menuItem} onClick={() => setActiveDialog("encryption-setup")}>Security</span>
        <span className={styles.menuItem}>Help</span>
      </div>

      <div className={styles.toolbar}>
        <button className={styles.toolBtn} onClick={() => setActiveDialog("invites")}>{"\uD83D\uDCE8"} Read</button>
        <button className={styles.toolBtn} onClick={() => setActiveDialog("create")}>{"\u270F\uFE0F"} Write</button>
        <button className={styles.toolBtn} onClick={() => setActiveDialog("directory")}>{"\uD83D\uDCAC"} Rooms</button>
        <button className={styles.toolBtn} onClick={() => selectedRoomId ? setActiveDialog("invite") : null}>{"\uD83D\uDC65"} People</button>
        <button className={styles.toolBtn} onClick={() => setActiveDialog(activeDialog === "settings" ? null : "settings")}>{"\u2699\uFE0F"} Setup</button>
        <button className={styles.toolBtn} onClick={() => setActiveDialog("encryption-setup")}>{"\uD83D\uDD12"} Security</button>
        {autoLockEnabled && (
          <button className={styles.toolBtn} onClick={lockApp}>{"\uD83D\uDD10"} Lock</button>
        )}
        <div className={styles.toolSpacer} />
        <button className={styles.toolBtn} onClick={logout}>{"\uD83D\uDEAA"} Sign Off</button>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.sidebar}>
          <BuddyList
            onCreateRoom={() => setActiveDialog("create")}
            onJoinRoom={() => setActiveDialog("join")}
          />
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

      {activeDialog === "settings" && <SoundSettings onClose={() => setActiveDialog(null)} />}
      {activeDialog === "create" && (
        <CreateRoomDialog onClose={() => setActiveDialog(null)} onCreated={handleRoomCreated} />
      )}
      {activeDialog === "join" && (
        <JoinRoomDialog onClose={() => setActiveDialog(null)} onJoined={handleRoomJoined} />
      )}
      {activeDialog === "directory" && (
        <RoomDirectoryDialog onClose={() => setActiveDialog(null)} onJoined={handleRoomJoined} />
      )}
      {activeDialog === "invite" && selectedRoomId && (
        <InviteDialog
          roomId={selectedRoomId}
          roomName={selectedRoom?.name || undefined}
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog === "invites" && (
        <PendingInvitesDialog onClose={() => setActiveDialog(null)} onAccepted={handleRoomJoined} />
      )}
      {activeDialog === "encryption-setup" && (
        <EncryptionSetupPanel
          onClose={() => setActiveDialog(null)}
          onOpenDevices={() => setActiveDialog("device-manager")}
          onOpenKeyBackup={() => setActiveDialog("key-backup")}
          onOpenKeyExport={() => setActiveDialog("key-export")}
          onOpenAutoLock={() => setActiveDialog("auto-lock")}
        />
      )}
      {activeDialog === "device-manager" && (
        <DeviceManager onClose={() => setActiveDialog("encryption-setup")} />
      )}
      {activeDialog === "device-verify" && userId && (
        <DeviceVerificationDialog
          userId={userId}
          onClose={() => setActiveDialog("device-manager")}
        />
      )}
      {activeDialog === "key-backup" && (
        <KeyBackupDialog onClose={() => setActiveDialog("encryption-setup")} />
      )}
      {activeDialog === "key-export" && (
        <KeyExportImportDialog onClose={() => setActiveDialog("encryption-setup")} />
      )}
      {activeDialog === "auto-lock" && (
        <AutoLockSettings onClose={() => setActiveDialog("encryption-setup")} />
      )}
      <IncomingVerificationDialog />
    </div>
  );
}
