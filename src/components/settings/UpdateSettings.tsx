import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Window from "../retro/Window";

interface UpdateInfo {
  available: boolean;
  version: string;
  changelog: string;
  downloadSize: string;
}

interface Props {
  onClose: () => void;
}

export default function UpdateSettings({ onClose }: Props) {
  const [currentVersion, setCurrentVersion] = useState("1.0.0");
  const [autoUpdate, setAutoUpdate] = useState<"auto" | "manual" | "disabled">("manual");
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [readyToRestart, setReadyToRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<string>("get_app_version").then(setCurrentVersion).catch(() => {});
    invoke<string>("get_update_preference").then((p) => setAutoUpdate(p as typeof autoUpdate)).catch(() => {});
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    setError(null);
    setUpdateInfo(null);
    try {
      const info = await invoke<UpdateInfo>("check_for_update");
      setUpdateInfo(info);
    } catch (e: unknown) {
      setError(`Update check failed: ${e}`);
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadUpdate = async () => {
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const interval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 95) { clearInterval(interval); return prev; }
          return prev + Math.random() * 15;
        });
      }, 300);
      await invoke("download_and_install_update");
      clearInterval(interval);
      setDownloadProgress(100);
      setDownloading(false);
      setReadyToRestart(true);
    } catch (e: unknown) {
      setError(`Download failed: ${e}`);
      setDownloading(false);
    }
  };

  const handleRestart = async () => {
    try {
      await invoke("restart_app");
    } catch (e) {
      setError(`Restart failed: ${e}`);
    }
  };

  const handleSetPreference = async (pref: typeof autoUpdate) => {
    setAutoUpdate(pref);
    try {
      await invoke("set_update_preference", { preference: pref });
    } catch (e) {
      console.error("Failed to save update preference:", e);
    }
  };

  const fieldsetStyle: React.CSSProperties = {
    border: "2px solid", borderColor: "#808080 #fff #fff #808080",
    padding: 8, marginBottom: 8,
  };
  const btnStyle: React.CSSProperties = {
    padding: "3px 12px", background: "#C0C0C0",
    border: "2px solid", borderColor: "#fff #404040 #404040 #fff",
    cursor: "pointer", fontSize: 11,
  };

  return (
    <div style={{ position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 700 }}>
      <Window title="🔄 Software Update" onClose={onClose} width={400}>
        <div style={{ padding: 12, fontFamily: "var(--font-system)", fontSize: 11 }}>

          <fieldset style={fieldsetStyle}>
            <legend>Current Version</legend>
            <div style={{ textAlign: "center", padding: 8 }}>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "#004B87" }}>PufferChat</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>v{currentVersion}</div>
            </div>
          </fieldset>

          <fieldset style={fieldsetStyle}>
            <legend>Update Preference</legend>
            {(["auto", "manual", "disabled"] as const).map((pref) => (
              <label key={pref} style={{ display: "block", marginBottom: 3, cursor: "pointer" }}>
                <input
                  type="radio" name="update-pref" value={pref}
                  checked={autoUpdate === pref}
                  onChange={() => handleSetPreference(pref)}
                />
                {" "}
                {pref === "auto" && "Automatic — Download and install updates automatically"}
                {pref === "manual" && "Manual — Notify me, but let me choose when to install"}
                {pref === "disabled" && "Disabled — Don't check for updates"}
              </label>
            ))}
          </fieldset>

          {!updateInfo && !readyToRestart && (
            <button onClick={handleCheckUpdate} disabled={checking} style={{ ...btnStyle, width: "100%", marginBottom: 8 }}>
              {checking ? "⏳ Checking for updates..." : "Check for Updates"}
            </button>
          )}

          {updateInfo && !updateInfo.available && (
            <div style={{ padding: 8, background: "#d4ffd4", border: "1px solid #4a4", marginBottom: 8, textAlign: "center" }}>
              ✓ You're running the latest version!
            </div>
          )}

          {updateInfo && updateInfo.available && !readyToRestart && (
            <fieldset style={fieldsetStyle}>
              <legend>Update Available</legend>
              <div style={{ marginBottom: 6 }}>
                <strong>Version {updateInfo.version}</strong>
                <span style={{ fontSize: 10, color: "#666", marginLeft: 8 }}>({updateInfo.downloadSize})</span>
              </div>
              {updateInfo.changelog && (
                <div style={{
                  background: "#fff", border: "2px solid", borderColor: "#404040 #fff #fff #404040",
                  padding: 6, maxHeight: 120, overflowY: "auto", fontSize: 10,
                  fontFamily: "monospace", whiteSpace: "pre-wrap", marginBottom: 8,
                }}>
                  {updateInfo.changelog}
                </div>
              )}
              {downloading ? (
                <div>
                  <div style={{ fontSize: 10, marginBottom: 4 }}>Downloading... {Math.round(downloadProgress)}%</div>
                  <div style={{ height: 16, background: "#fff", border: "2px solid", borderColor: "#404040 #fff #fff #404040" }}>
                    <div style={{
                      height: "100%", width: `${downloadProgress}%`,
                      background: "linear-gradient(90deg, #004B87, #0066cc)",
                      transition: "width 0.3s",
                    }} />
                  </div>
                </div>
              ) : (
                <button onClick={handleDownloadUpdate} style={{ ...btnStyle, fontWeight: "bold", width: "100%" }}>
                  Download & Install
                </button>
              )}
            </fieldset>
          )}

          {readyToRestart && (
            <fieldset style={{ ...fieldsetStyle, background: "#ffffd4" }}>
              <legend>Ready to Update</legend>
              <div style={{ textAlign: "center", padding: 8 }}>
                <div style={{ marginBottom: 8 }}>Update downloaded successfully. Restart to apply.</div>
                <button onClick={handleRestart} style={{ ...btnStyle, fontWeight: "bold", fontSize: 13, padding: "6px 24px", background: "#004B87", color: "#fff" }}>
                  🔄 Restart Now
                </button>
              </div>
            </fieldset>
          )}

          {error && (
            <div style={{ padding: 4, marginBottom: 6, background: "#ffd4d4", border: "1px solid red", fontSize: 10 }}>{error}</div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ ...btnStyle, padding: "3px 16px" }}>Close</button>
          </div>
        </div>
      </Window>
    </div>
  );
}
