import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import Window from "../retro/Window";

interface IntegrityResult {
  dbOk: boolean;
  cryptoOk: boolean;
  configOk: boolean;
  details: string[];
}

interface Props {
  onClose: () => void;
}

export default function DataSettings({ onClose }: Props) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [draftCount, setDraftCount] = useState<number | null>(null);

  React.useEffect(() => {
    invoke<number>("get_draft_count").then(setDraftCount).catch(() => {});
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const path = await save({
        defaultPath: `pufferchat-settings-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (path) {
        await invoke("export_settings", { path });
        setMessage({ text: `Settings exported to ${path}`, type: "success" });
      }
    } catch (e: unknown) {
      setMessage({ text: `Export failed: ${e}`, type: "error" });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setMessage(null);
    try {
      const path = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (path) {
        await invoke("import_settings", { path: typeof path === "string" ? path : path });
        setMessage({ text: "Settings imported successfully. Restart recommended.", type: "success" });
      }
    } catch (e: unknown) {
      setMessage({ text: `Import failed: ${e}`, type: "error" });
    } finally {
      setImporting(false);
    }
  };

  const handleIntegrityCheck = async () => {
    setChecking(true);
    setIntegrityResult(null);
    setMessage(null);
    try {
      const result = await invoke<IntegrityResult>("check_integrity");
      setIntegrityResult(result);
    } catch (e: unknown) {
      setMessage({ text: `Integrity check failed: ${e}`, type: "error" });
    } finally {
      setChecking(false);
    }
  };

  const handleRepair = async () => {
    setRepairing(true);
    setMessage(null);
    try {
      await invoke("repair_database");
      setMessage({ text: "Database repair completed. Please restart PufferChat.", type: "success" });
      setIntegrityResult(null);
    } catch (e: unknown) {
      setMessage({ text: `Repair failed: ${e}`, type: "error" });
    } finally {
      setRepairing(false);
    }
  };

  const handleClearDrafts = async () => {
    try {
      await invoke("clear_drafts");
      setDraftCount(0);
      setMessage({ text: "Drafts cleared.", type: "success" });
    } catch (e: unknown) {
      setMessage({ text: `Failed to clear drafts: ${e}`, type: "error" });
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
    <div style={{ position: "fixed", top: 50, left: "50%", transform: "translateX(-50%)", zIndex: 700 }}>
      <Window title="💾 Data & Recovery" onClose={onClose} width={420}>
        <div style={{ padding: 12, fontFamily: "var(--font-system)", fontSize: 11 }}>

          <fieldset style={fieldsetStyle}>
            <legend>Settings Backup</legend>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleExport} disabled={exporting} style={{ ...btnStyle, flex: 1 }}>
                {exporting ? "Exporting..." : "📤 Export Settings"}
              </button>
              <button onClick={handleImport} disabled={importing} style={{ ...btnStyle, flex: 1 }}>
                {importing ? "Importing..." : "📥 Import Settings"}
              </button>
            </div>
            <div style={{ fontSize: 9, color: "#666", marginTop: 4 }}>
              Export saves all preferences, proxy settings, and UI configuration as a portable JSON file.
            </div>
          </fieldset>

          <fieldset style={fieldsetStyle}>
            <legend>Database Integrity</legend>
            <button onClick={handleIntegrityCheck} disabled={checking} style={{ ...btnStyle, width: "100%", marginBottom: 6 }}>
              {checking ? "⏳ Checking..." : "🔍 Run Integrity Check"}
            </button>

            {integrityResult && (
              <div style={{ background: "#f8f8f8", border: "1px solid #ccc", padding: 6 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
                  <span>Database: {integrityResult.dbOk ? "✅ OK" : "❌ Error"}</span>
                  <span>Crypto: {integrityResult.cryptoOk ? "✅ OK" : "❌ Error"}</span>
                  <span>Config: {integrityResult.configOk ? "✅ OK" : "❌ Error"}</span>
                </div>
                {integrityResult.details.length > 0 && (
                  <div style={{ fontSize: 9, fontFamily: "monospace", maxHeight: 80, overflowY: "auto", marginTop: 4 }}>
                    {integrityResult.details.map((d, i) => <div key={i}>{d}</div>)}
                  </div>
                )}
                {(!integrityResult.dbOk || !integrityResult.cryptoOk) && (
                  <button onClick={handleRepair} disabled={repairing} style={{ ...btnStyle, marginTop: 6, color: "red", width: "100%" }}>
                    {repairing ? "Repairing..." : "🔧 Repair Database"}
                  </button>
                )}
              </div>
            )}
          </fieldset>

          <fieldset style={fieldsetStyle}>
            <legend>Message Drafts</legend>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Saved drafts: {draftCount !== null ? draftCount : "..."}</span>
              <button onClick={handleClearDrafts} disabled={draftCount === 0 || draftCount === null} style={{ ...btnStyle, fontSize: 10 }}>
                Clear All Drafts
              </button>
            </div>
            <div style={{ fontSize: 9, color: "#666", marginTop: 4 }}>
              Unsent messages are automatically saved and restored when you return to a room.
            </div>
          </fieldset>

          {message && (
            <div style={{
              padding: 4, marginBottom: 6, fontSize: 10,
              background: message.type === "success" ? "#d4ffd4" : "#ffd4d4",
              border: `1px solid ${message.type === "success" ? "#4a4" : "red"}`,
            }}>
              {message.text}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ ...btnStyle, fontWeight: "bold", padding: "3px 16px" }}>Close</button>
          </div>
        </div>
      </Window>
    </div>
  );
}
