import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import Window from "../retro/Window";

interface Props {
  onClose: () => void;
}

export default function SettingsExportImport({ onClose }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const handleExport = async () => {
    setWorking(true);
    setError(null);
    setStatus(null);
    try {
      const filePath = await save({
        defaultPath: "pufferchat-settings.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
        title: "Export PufferChat Settings",
      });
      if (!filePath) {
        setWorking(false);
        return;
      }
      await invoke("export_settings", { filePath });
      setStatus("Settings exported successfully!");
    } catch (e: unknown) {
      setError(`Export failed: ${e}`);
    } finally {
      setWorking(false);
    }
  };

  const handleImport = async () => {
    setWorking(true);
    setError(null);
    setStatus(null);
    try {
      const result = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
        title: "Import PufferChat Settings",
      });
      if (!result) {
        setWorking(false);
        return;
      }
      const filePath = typeof result === "string" ? result : result;
      await invoke("import_settings", { filePath });
      setStatus("Settings imported successfully! Restart for full effect.");
    } catch (e: unknown) {
      setError(`Import failed: ${e}`);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 700 }}>
      <Window title="Settings Export / Import" onClose={onClose} width={360}>
        <div style={{ padding: 12, fontFamily: "var(--font-system)", fontSize: 11 }}>
          <p style={{ marginBottom: 12, color: "#404040" }}>
            Export your PufferChat settings to a file, or import from a previously exported file.
            This includes proxy, DoH, pinned certificates, and general preferences.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              onClick={handleExport}
              disabled={working}
              aria-label="Export settings to file"
              style={{
                flex: 1,
                padding: "6px 12px",
                background: "#C0C0C0",
                border: "2px solid",
                borderColor: "#fff #404040 #404040 #fff",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              {"\uD83D\uDCE4"} Export Settings
            </button>
            <button
              onClick={handleImport}
              disabled={working}
              aria-label="Import settings from file"
              style={{
                flex: 1,
                padding: "6px 12px",
                background: "#C0C0C0",
                border: "2px solid",
                borderColor: "#fff #404040 #404040 #fff",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              {"\uD83D\uDCE5"} Import Settings
            </button>
          </div>

          {status && (
            <div
              role="status"
              style={{ padding: 6, background: "#d4ffd4", border: "1px solid #008000", marginBottom: 8, fontSize: 10 }}
            >
              {"\u2714"} {status}
            </div>
          )}
          {error && (
            <div
              role="alert"
              style={{ padding: 6, background: "#ffd4d4", border: "1px solid #cc0000", marginBottom: 8, fontSize: 10 }}
            >
              {"\u26A0"} {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                padding: "3px 16px",
                background: "#C0C0C0",
                border: "2px solid",
                borderColor: "#fff #404040 #404040 #fff",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Close
            </button>
          </div>
        </div>
      </Window>
    </div>
  );
}

