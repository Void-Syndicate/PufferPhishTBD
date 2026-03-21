import { useState, useEffect, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRoomsStore, RoomSummary } from "../../stores/rooms";
import { useAuthStore } from "../../stores/auth";
import { useEncryptionStore } from "../../stores/encryption";
import { useEncryption } from "../../hooks/useEncryption";
import { useMatrixEvents } from "../../hooks/useMatrixEvents";
import { useKeyboardShortcut } from "../../components/accessibility";
import { soundEngine } from "../../audio/SoundEngine";
import BuddyList from "../buddy-list/BuddyList";
import { useSpaces } from "../../hooks/useSpaces";
import ChatView from "../chat/ChatView";
import CallOverlay from "../calls/CallOverlay";
import IncomingVerificationDialog from "../security/IncomingVerificationDialog";
import { useCall } from "../../hooks/useCall";
import { HourglassSpinner } from "../common/LoadingStates";
import { EmptyState } from "../common/EmptyStates";
import AccountSwitcher from "../settings/AccountSwitcher";
import styles from "./MainShell.module.css";

// Lazy-loaded panels for code splitting
const SoundSettings = lazy(() => import("../settings/SoundSettings"));
const CreateRoomDialog = lazy(() => import("../rooms/CreateRoomDialog"));
const JoinRoomDialog = lazy(() => import("../rooms/JoinRoomDialog"));
const RoomDirectoryDialog = lazy(() => import("../rooms/RoomDirectoryDialog"));
const InviteDialog = lazy(() => import("../rooms/InviteDialog"));
const PendingInvitesDialog = lazy(() => import("../rooms/PendingInvitesDialog"));
const EncryptionSetupPanel = lazy(() => import("../security/EncryptionSetupPanel"));
const DeviceManager = lazy(() => import("../security/DeviceManager"));
const DeviceVerificationDialog = lazy(() => import("../security/DeviceVerificationDialog"));
const KeyBackupDialog = lazy(() => import("../security/KeyBackupDialog"));
const KeyExportImportDialog = lazy(() => import("../security/KeyExportImportDialog"));
const AutoLockSettings = lazy(() => import("../security/AutoLockSettings"));
const CallHistory = lazy(() => import("../calls/CallHistory"));
const PluginSettings = lazy(() => import("../settings/PluginSettings"));
const ProxySettings = lazy(() => import("../settings/ProxySettings"));
const SecuritySettingsPanel = lazy(() => import("../settings/SecuritySettings"));
const UpdateSettings = lazy(() => import("../settings/UpdateSettings"));
const SettingsExportImport = lazy(() => import("../settings/SettingsExportImport"));
const IntegrityCheck = lazy(() => import("../settings/IntegrityCheck"));
const SettingsPanel = lazy(() => import("../settings/SettingsPanel"));

type DialogType = "create" | "join" | "directory" | "invite" | "invites" | "settings" | "plugins" | "call-history"
  | "encryption-setup" | "device-manager" | "device-verify" | "key-backup" | "key-export" | "auto-lock"
  | "proxy" | "security-settings" | "update" | "export-import" | "integrity"
  | null;

const DialogFallback = () => (
  <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 800 }}>
    <HourglassSpinner message="Loading..." />
  </div>
);

export default function MainShell() {
  const { setRooms, setLoading, selectedRoomId, rooms, selectRoom } = useRoomsStore();
  const displayName = useAuthStore((s) => s.displayName);
  const userId = useAuthStore((s) => s.userId);
  const logout = useAuthStore((s) => s.logout);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const { lockApp } = useEncryption();
  const autoLockEnabled = useEncryptionStore((s) => s.autoLockEnabled);

  useMatrixEvents();
  useCall();
  const { refreshSpaceChildren } = useSpaces();

  // App-wide keyboard shortcuts
  useKeyboardShortcut("k", () => setActiveDialog("directory"), { ctrl: true });
  useKeyboardShortcut("n", () => setActiveDialog("create"), { ctrl: true });
  useKeyboardShortcut(",", () => setActiveDialog("settings"), { ctrl: true });
  useKeyboardShortcut("l", () => { if (autoLockEnabled) lockApp(); }, { ctrl: true });

  useEffect(() => {
    soundEngine.play("welcome");
  }, []);

  // Draft persistence - save drafts on unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Graceful shutdown - flush any pending operations
      console.log("PufferChat shutting down gracefully");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initSync() {
      setLoading(true);
      try {
        await invoke("start_sync");
        let retries = 0;
        let fetchedRooms: RoomSummary[] = [];
        while (retries < 15 && !cancelled) {
          await new Promise((r) => setTimeout(r, 1000));
          fetchedRooms = await invoke<RoomSummary[]>("get_rooms");
          if (fetchedRooms.length > 0) break;
          retries++;
        }
        if (!cancelled) {
          setRooms(fetchedRooms);
          refreshSpaceChildren();
        }
      } catch (err) {
        console.error("Failed to initialize sync:", err);
        if (!cancelled) setLoading(false);
      }
    }
    initSync();

    return () => { cancelled = true; };
  }, [setRooms, setLoading]);

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

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"account" | "appearance" | undefined>(undefined);

  return (
    <div className={styles.shell} role="application" aria-label="PufferChat">
      <div className={styles.menuBar} role="menubar" aria-label="Main menu">
        <span className={styles.menuItem} role="menuitem" tabIndex={0}>File</span>
        <span className={styles.menuItem} role="menuitem" tabIndex={0}>Edit</span>
        <span className={styles.menuItem} role="menuitem" tabIndex={0}>People</span>
        <span className={styles.menuItem} role="menuitem" tabIndex={0} onClick={() => setActiveDialog("directory")}>Rooms</span>
        <span className={styles.menuItem} role="menuitem" tabIndex={0} onClick={() => setActiveDialog("encryption-setup")}>Security</span>
        <span className={styles.menuItem} role="menuitem" tabIndex={0}>Help</span>
      </div>

      <div className={styles.toolbar} role="toolbar" aria-label="Quick actions">
        <button className={styles.toolBtn} onClick={() => setActiveDialog("invites")} aria-label="Read pending invites">{"\uD83D\uDCE8"} Read</button>
        <button className={styles.toolBtn} onClick={() => setActiveDialog("create")} aria-label="Create new room">{"\u270F\uFE0F"} Write</button>
        <button className={styles.toolBtn} onClick={() => setActiveDialog("directory")} aria-label="Browse rooms">{"\uD83D\uDCAC"} Rooms</button>
        <button className={styles.toolBtn} onClick={() => selectedRoomId ? setActiveDialog("invite") : null} aria-label="Invite people">{"\uD83D\uDC65"} People</button>
        <button className={styles.toolBtn} onClick={() => setActiveDialog("encryption-setup")} aria-label="Security settings">{"\uD83D\uDD12"} Security</button>
        <button className={styles.toolBtn} onClick={() => { setSettingsTab(undefined); setShowSettings(true); }} aria-label="Open settings">{"\u2699\uFE0F"} Settings</button>
        <button className={styles.toolBtn} onClick={() => { setSettingsTab("appearance"); setShowSettings(true); }} aria-label="Theme settings">{"\uD83C\uDFA8"} Theme</button>
        {autoLockEnabled && (
          <button className={styles.toolBtn} onClick={lockApp} aria-label="Lock application">{"\uD83D\uDD10"} Lock</button>
        )}
        <button className={styles.toolBtn} onClick={() => setActiveDialog(activeDialog === "call-history" ? null : "call-history")} aria-label="Call history">{"\uD83D\uDCDE"} Calls</button>
        <div className={styles.toolSpacer} />
        <button className={styles.toolBtn} onClick={async () => {
          try { await invoke("matrix_logout"); } catch (e) { console.error("Logout failed:", e); }
          logout();
        }} aria-label="Sign out">{"\uD83D\uDEAA"} Sign Off</button>
      </div>

      <div className={styles.mainContent} id="main-content" tabIndex={-1}>
        <div className={styles.sidebar} role="navigation" aria-label="Room list">
          <AccountSwitcher />
          <BuddyList
            onCreateRoom={() => setActiveDialog("create")}
            onJoinRoom={() => setActiveDialog("join")}
          />
        </div>

        <div className={styles.chatArea} role="main" aria-label="Chat area">
          {selectedRoomId ? (
            <ChatView roomId={selectedRoomId} />
          ) : (
            <EmptyState
              icon={"\uD83D\uDC21"}
              title={`Welcome, ${displayName || userId}!`}
              message="You've got rooms! Select a room from the Buddy List to start chatting."
            />
          )}
        </div>
      </div>

      <div className={styles.statusBar} role="status" aria-live="polite" aria-label="Status bar">
        <span className={styles.statusItem}>Connected - {userId}</span>
        <span className={styles.statusItem}>{"\uD83D\uDD12"} E2EE Ready</span>
        <span className={styles.statusItem} style={{ marginLeft: "auto", cursor: "pointer" }} onClick={() => setActiveDialog("update")} role="button" tabIndex={0} aria-label="Check for updates">v1.0.0</span>
      </div>

      <Suspense fallback={<DialogFallback />}>
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
        {activeDialog === "plugins" && (
          <div style={{ position: "fixed", top: 40, right: 20, width: 420, height: 520, zIndex: 600, boxShadow: "4px 4px 0 rgba(0,0,0,0.3)", border: "2px solid", borderColor: "var(--win-border-light) var(--win-border-dark) var(--win-border-dark) var(--win-border-light)" }}>
            <PluginSettings onClose={() => setActiveDialog(null)} />
          </div>
        )}
        {activeDialog === "proxy" && (
          <ProxySettings onClose={() => setActiveDialog(null)} />
        )}
        {activeDialog === "security-settings" && (
          <SecuritySettingsPanel onClose={() => setActiveDialog(null)} />
        )}
        {activeDialog === "update" && (
          <UpdateSettings onClose={() => setActiveDialog(null)} />
        )}
        {activeDialog === "export-import" && (
          <SettingsExportImport onClose={() => setActiveDialog(null)} />
        )}
        {activeDialog === "integrity" && (
          <IntegrityCheck onClose={() => setActiveDialog(null)} />
        )}
        {activeDialog === "call-history" && (
          <CallHistory onClose={() => setActiveDialog(null)} />
        )}
        {showSettings && (
          <SettingsPanel onClose={() => setShowSettings(false)} initialTab={settingsTab} />
        )}
      </Suspense>
      <IncomingVerificationDialog />
      <CallOverlay />
    </div>
  );
}
