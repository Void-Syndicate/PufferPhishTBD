import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./RoomSettingsPanel.module.css";

interface RoomSettingsPanelProps {
  roomId: string;
  onClose: () => void;
}

type Tab = "general" | "aliases" | "advanced" | "security";

interface RoomInfo {
  roomId: string;
  name: string | null;
  topic: string | null;
  memberCount: number;
  isEncrypted: boolean;
  isDirect: boolean;
}

export default function RoomSettingsPanel({ roomId, onClose }: RoomSettingsPanelProps) {
  const [tab, setTab] = useState<Tab>("general");
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // General tab state
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");

  // Aliases tab state
  const [aliases, setAliases] = useState<string[]>([]);
  const [newAlias, setNewAlias] = useState("");

  const loadInfo = useCallback(async () => {
    try {
      const details = await invoke<RoomInfo>("get_room_info", { roomId });
      setInfo(details);
      setName(details.name || "");
      setTopic(details.topic || "");
    } catch (e: any) {
      setError(e?.toString() || "Failed to load room info");
    }
  }, [roomId]);

  const loadAliases = useCallback(async () => {
    try {
      const result = await invoke<string[]>("get_room_aliases", { roomId });
      setAliases(result);
    } catch {
      setAliases([]);
    }
  }, [roomId]);

  useEffect(() => {
    loadInfo();
    loadAliases();
  }, [loadInfo, loadAliases]);

  const handleSaveName = async () => {
    setError("");
    setLoading(true);
    try {
      await invoke("set_room_name", { roomId, name });
      await loadInfo();
    } catch (e: any) {
      setError(e?.toString() || "Failed to update name");
    }
    setLoading(false);
  };

  const handleSaveTopic = async () => {
    setError("");
    setLoading(true);
    try {
      await invoke("set_room_topic", { roomId, topic });
      await loadInfo();
    } catch (e: any) {
      setError(e?.toString() || "Failed to update topic");
    }
    setLoading(false);
  };

  const handleChangeAvatar = async () => {
    try {
      const file = await open({
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
        multiple: false,
      });
      if (file) {
        setError("");
        setLoading(true);
        await invoke("set_room_avatar", { roomId, filePath: file });
        await loadInfo();
        setLoading(false);
      }
    } catch (e: any) {
      setError(e?.toString() || "Failed to update avatar");
      setLoading(false);
    }
  };

  const handleAddAlias = async () => {
    if (!newAlias.trim()) return;
    setError("");
    try {
      await invoke("add_room_alias", { roomId, alias: newAlias.trim() });
      setNewAlias("");
      await loadAliases();
    } catch (e: any) {
      setError(e?.toString() || "Failed to add alias");
    }
  };

  const handleRemoveAlias = async (alias: string) => {
    setError("");
    try {
      await invoke("remove_room_alias", { alias });
      await loadAliases();
    } catch (e: any) {
      setError(e?.toString() || "Failed to remove alias");
    }
  };

  const handleSetCanonical = async (alias: string) => {
    setError("");
    try {
      await invoke("set_canonical_alias", { roomId, alias });
      await loadAliases();
    } catch (e: any) {
      setError(e?.toString() || "Failed to set canonical alias");
    }
  };

  const handleUpgrade = async () => {
    if (!confirm("â ï¸ Room upgrade is irreversible! All members will be invited to the new room. Continue?")) return;
    setError("");
    setLoading(true);
    try {
      const newRoomId = await invoke<string>("upgrade_room", { roomId, newVersion: "11" });
      alert(`Room upgraded! New room ID: ${newRoomId}`);
      onClose();
    } catch (e: any) {
      setError(e?.toString() || "Failed to upgrade room");
    }
    setLoading(false);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "aliases", label: "Aliases" },
    { key: "advanced", label: "Advanced" },
    { key: "security", label: "Security" },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Window title="âï¸ Room Settings" onClose={onClose} width={420}>
          <div className={styles.tabBar}>
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {error && <div className={styles.error}>{error}</div>}

            {tab === "general" && (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Room Name</label>
                  <div className={styles.fieldRow}>
                    <TextInput value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
                    <Button onClick={handleSaveName} disabled={loading}>Save</Button>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Topic</label>
                  <div className={styles.fieldRow}>
                    <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} style={{ flex: 1 }} />
                    <Button onClick={handleSaveTopic} disabled={loading}>Save</Button>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Avatar</label>
                  <div className={styles.avatarPreview}>
                    {info?.name ? info.name.charAt(0).toUpperCase() : "?"}
                  </div>
                  <Button onClick={handleChangeAvatar} disabled={loading}>Change Avatar...</Button>
                </div>
              </>
            )}

            {tab === "aliases" && (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Room Aliases</label>
                  <div className={styles.aliasList}>
                    {aliases.length === 0 && (
                      <div style={{ padding: "8px", textAlign: "center", color: "#888", fontSize: "11px" }}>
                        No aliases configured
                      </div>
                    )}
                    {aliases.map((alias) => (
                      <div key={alias} className={styles.aliasItem}>
                        <span className={styles.aliasText}>{alias}</span>
                        <div className={styles.aliasActions}>
                          <Button onClick={() => handleSetCanonical(alias)}>?</Button>
                          <Button onClick={() => handleRemoveAlias(alias)}>?</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Add Alias</label>
                  <div className={styles.addAliasRow}>
                    <TextInput
                      value={newAlias}
                      onChange={(e) => setNewAlias(e.target.value)}
                      placeholder="#alias:server.com"
                    />
                    <Button onClick={handleAddAlias}>Add</Button>
                  </div>
                </div>
              </>
            )}

            {tab === "advanced" && (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Room ID</label>
                  <div className={styles.fieldValue}>{roomId}</div>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Members</label>
                  <div className={styles.fieldValue}>{info?.memberCount ?? "?"}</div>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Direct Message</label>
                  <div className={styles.fieldValue}>{info?.isDirect ? "Yes" : "No"}</div>
                </div>
                <div className={styles.warningBox}>
                  ?? Room upgrades are irreversible. A new room will be created and all members invited.
                </div>
                <Button onClick={handleUpgrade} disabled={loading}>
                  ?? Upgrade Room to v11
                </Button>
              </>
            )}

            {tab === "security" && (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Encryption</label>
                  <div className={`${styles.statusBadge} ${info?.isEncrypted ? styles.statusOn : styles.statusOff}`}>
                    {info?.isEncrypted ? "ð Encrypted (Megolm)" : "🔓 Not Encrypted"}
                  </div>
                </div>
                {!info?.isEncrypted && (
                  <div style={{ fontFamily: "var(--font-system)", fontSize: "11px", color: "#666", marginTop: 4 }}>
                    Encryption can be enabled when creating a room but cannot be disabled once active.
                  </div>
                )}
                {info?.isEncrypted && (
                  <div style={{ fontFamily: "var(--font-system)", fontSize: "11px", color: "#008000", marginTop: 4 }}>
                    ? End-to-end encryption is active. Messages are secured with Megolm.
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.buttonRow}>
            <Button onClick={onClose}>Close</Button>
          </div>
        </Window>
      </div>
    </div>
  );
}