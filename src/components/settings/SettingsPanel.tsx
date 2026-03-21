import { useState, useEffect, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../../stores/auth";
import { useEncryptionStore } from "../../stores/encryption";
import { THEMES, ThemeId, getCurrentTheme, setTheme } from "../../themes/engine";
import { HourglassSpinner } from "../common/LoadingStates";
import styles from "./SettingsPanel.module.css";

// Lazy-load heavy sub-panels
const SoundSettings = lazy(() => import("./SoundSettings"));
const PluginSettings = lazy(() => import("./PluginSettings"));
const ProxySettings = lazy(() => import("./ProxySettings"));
const SecuritySettingsPanel = lazy(() => import("./SecuritySettings"));
const UpdateSettings = lazy(() => import("./UpdateSettings"));
const SettingsExportImport = lazy(() => import("./SettingsExportImport"));
const IntegrityCheck = lazy(() => import("./IntegrityCheck"));

type SettingsTab = "account" | "appearance" | "sounds" | "plugins" | "proxy" | "privacy" | "updates" | "data" | "integrity";

const TABS: { id: SettingsTab; icon: string; label: string }[] = [
  { id: "account", icon: "👤", label: "Account" },
  { id: "appearance", icon: "🎨", label: "Appearance" },
  { id: "sounds", icon: "🔊", label: "Sounds" },
  { id: "plugins", icon: "🧩", label: "Plugins" },
  { id: "proxy", icon: "🌐", label: "Network" },
  { id: "privacy", icon: "🛡️", label: "Privacy" },
  { id: "updates", icon: "📦", label: "Updates" },
  { id: "data", icon: "💾", label: "Data" },
  { id: "integrity", icon: "🔍", label: "Integrity" },
];

interface Props {
  onClose: () => void;
  initialTab?: SettingsTab;
}

// Theme preview colors
const THEME_PREVIEWS: Record<ThemeId, { bg: string; accent: string; text: string }> = {
  "aol-classic": { bg: "#c0c0c0", accent: "#004B87", text: "#000" },
  "aol-2026": { bg: "#0a0e1a", accent: "#3b82f6", text: "#f9fafb" },
  "high-contrast": { bg: "#000000", accent: "#ffeb3b", text: "#ffffff" },
};

export default function SettingsPanel({ onClose, initialTab = "account" }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sidebar}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? styles.sidebarItemActive : styles.sidebarItem}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <div className={styles.content}>
          <div className={styles.titleBar}>
            <span>Settings — {TABS.find((t) => t.id === activeTab)?.label}</span>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">✕</button>
          </div>
          <div className={styles.body}>
            <Suspense fallback={<HourglassSpinner message="Loading..." />}>
              {activeTab === "account" && <AccountTab />}
              {activeTab === "appearance" && <AppearanceTab />}
              {activeTab === "sounds" && <SoundSettings onClose={() => setActiveTab("account")} />}
              {activeTab === "plugins" && <PluginSettings onClose={() => setActiveTab("account")} />}
              {activeTab === "proxy" && <ProxySettings onClose={() => setActiveTab("account")} />}
              {activeTab === "privacy" && <SecuritySettingsPanel onClose={() => setActiveTab("account")} />}
              {activeTab === "updates" && <UpdateSettings onClose={() => setActiveTab("account")} />}
              {activeTab === "data" && <SettingsExportImport onClose={() => setActiveTab("account")} />}
              {activeTab === "integrity" && <IntegrityCheck onClose={() => setActiveTab("account")} />}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Account Tab ─── */
function AccountTab() {
  const userId = useAuthStore((s) => s.userId);
  const displayName = useAuthStore((s) => s.displayName);
  const [newDisplayName, setNewDisplayName] = useState(displayName || "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const autoLockEnabled = useEncryptionStore((s) => s.autoLockEnabled);

  const handleSaveDisplayName = async () => {
    if (!newDisplayName.trim() || newDisplayName === displayName) return;
    setSaving(true);
    setStatus(null);
    try {
      await invoke("set_display_name", { name: newDisplayName.trim() });
      useAuthStore.getState().setDisplayName(newDisplayName.trim());
      setStatus({ type: "success", msg: "Display name updated." });
    } catch (e) {
      setStatus({ type: "error", msg: `Failed: ${e}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>Profile</legend>
        <div className={styles.profileRow}>
          <div className={styles.avatar}>
            {(displayName || userId || "?")[0].toUpperCase()}
          </div>
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>{displayName || "No display name"}</div>
            <div className={styles.profileId}>{userId}</div>
          </div>
        </div>
        <div className={styles.inputRow}>
          <label>Display Name:</label>
          <input
            type="text"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            placeholder="Enter display name"
          />
        </div>
        <div className={styles.btnRow}>
          <button className={styles.btn} onClick={handleSaveDisplayName} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
        {status && (
          <div className={status.type === "success" ? styles.statusSuccess : styles.statusError}>
            {status.msg}
          </div>
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Session</legend>
        <div className={styles.inputRow}>
          <label>User ID:</label>
          <input type="text" value={userId || ""} readOnly style={{ background: "#eee" }} />
        </div>
        <div className={styles.inputRow}>
          <label>Auto-Lock:</label>
          <span>{autoLockEnabled ? "Enabled" : "Disabled"}</span>
        </div>
      </fieldset>
    </>
  );
}

/* ─── Appearance Tab ─── */
function AppearanceTab() {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(getCurrentTheme());

  const handleThemeChange = (themeId: ThemeId) => {
    setTheme(themeId);
    setSelectedTheme(themeId);
  };

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>Theme</legend>
        <p style={{ margin: "0 0 8px 0" }}>Choose your PufferChat look:</p>
        <div className={styles.themeGrid}>
          {THEMES.map((theme) => {
            const preview = THEME_PREVIEWS[theme.id];
            const isActive = selectedTheme === theme.id;
            return (
              <div
                key={theme.id}
                className={isActive ? styles.themeCardActive : styles.themeCard}
                onClick={() => handleThemeChange(theme.id)}
                role="radio"
                aria-checked={isActive}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleThemeChange(theme.id); }}
              >
                <div
                  className={styles.themePreview}
                  style={{
                    background: preview.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  <div style={{ width: 20, height: 12, background: preview.accent, borderRadius: 2 }} />
                  <div style={{ width: 30, height: 4, background: preview.text, borderRadius: 1, opacity: 0.7 }} />
                </div>
                <div className={styles.themeName}>{theme.name}</div>
                <div className={styles.themeDesc}>{theme.description}</div>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Font Size</legend>
        <div className={styles.inputRow}>
          <label>Chat text:</label>
          <select
            defaultValue={localStorage.getItem("pufferchat-font-size") || "13"}
            onChange={(e) => {
              localStorage.setItem("pufferchat-font-size", e.target.value);
              document.documentElement.style.setProperty("--chat-font-size", e.target.value + "px");
            }}
            style={{ padding: "2px 4px", fontFamily: "inherit", fontSize: 11 }}
          >
            <option value="11">Small (11px)</option>
            <option value="13">Medium (13px)</option>
            <option value="15">Large (15px)</option>
            <option value="18">Extra Large (18px)</option>
          </select>
        </div>
      </fieldset>
    </>
  );
}
