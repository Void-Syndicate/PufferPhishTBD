import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Window from "../retro/Window";

interface IntegrityReport {
  databaseOk: boolean;
  cryptoKeysOk: boolean;
  configOk: boolean;
  issues: string[];
  checkedAt: number;
}

interface Props {
  onClose: () => void;
}

export default function IntegrityCheck({ onClose }: Props) {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [checking, setChecking] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<string | null>(null);

  useEffect(() => {
    runCheck();
  }, []);

  const runCheck = async () => {
    setChecking(true);
    setRepairResult(null);
    try {
      const r = await invoke<IntegrityReport>("check_integrity");
      setReport(r);
    } catch (e) {
      setReport({
        databaseOk: false,
        cryptoKeysOk: false,
        configOk: false,
        issues: [`Check failed: ${e}`],
        checkedAt: Date.now(),
      });
    } finally {
      setChecking(false);
    }
  };

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const ok = await invoke<boolean>("repair_database");
      setRepairResult(ok ? "Repair completed successfully." : "Repair completed with remaining issues.");
      await runCheck();
    } catch (e) {
      setRepairResult(`Repair failed: ${e}`);
    } finally {
      setRepairing(false);
    }
  };

  const statusIcon = (ok: boolean) => (ok ? "\u2705" : "\u274C");

  return (
    <div style={{ position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 700 }}>
      <Window title="Data Integrity Check" onClose={onClose} width={400}>
        <div style={{ padding: 12, fontFamily: "var(--font-system)", fontSize: 11 }}>
          {checking ? (
            <div style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{"\u231B"}</div>
              <p>Checking data integrity...</p>
            </div>
          ) : report ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span>{statusIcon(report.databaseOk)}</span>
                  <span style={{ fontWeight: "bold" }}>Database</span>
                  <span style={{ color: report.databaseOk ? "#008000" : "#cc0000" }}>
                    {report.databaseOk ? "OK" : "Issues Detected"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span>{statusIcon(report.cryptoKeysOk)}</span>
                  <span style={{ fontWeight: "bold" }}>Crypto Keys</span>
                  <span style={{ color: report.cryptoKeysOk ? "#008000" : "#cc0000" }}>
                    {report.cryptoKeysOk ? "OK" : "Issues Detected"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span>{statusIcon(report.configOk)}</span>
                  <span style={{ fontWeight: "bold" }}>Configuration</span>
                  <span style={{ color: report.configOk ? "#008000" : "#cc0000" }}>
                    {report.configOk ? "OK" : "Issues Detected"}
                  </span>
                </div>
              </div>

              {report.issues.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: "bold", marginBottom: 4 }}>Issues:</div>
                  <div style={{ background: "#fff", border: "2px solid", borderColor: "#404040 #fff #fff #404040", padding: 6, maxHeight: 120, overflow: "auto" }}>
                    {report.issues.map((issue, i) => (
                      <div key={i} style={{ fontSize: 10, color: "#cc0000", marginBottom: 2 }}>
                        {"\u26A0"} {issue}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {repairResult && (
                <div style={{ padding: 6, marginBottom: 8, background: repairResult.includes("successfully") ? "#d4ffd4" : "#ffd4d4", border: "1px solid #808080", fontSize: 10 }}>
                  {repairResult}
                </div>
              )}

              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button
                  onClick={runCheck}
                  aria-label="Re-check integrity"
                  style={{ padding: "3px 12px", background: "#C0C0C0", border: "2px solid", borderColor: "#fff #404040 #404040 #fff", cursor: "pointer", fontSize: 11 }}
                >
                  Re-check
                </button>
                {(!report.databaseOk || !report.cryptoKeysOk) && (
                  <button
                    onClick={handleRepair}
                    disabled={repairing}
                    aria-label="Attempt repair"
                    style={{ padding: "3px 12px", background: "#C0C0C0", border: "2px solid", borderColor: "#fff #404040 #404040 #fff", cursor: "pointer", fontSize: 11, fontWeight: "bold" }}
                  >
                    {repairing ? "Repairing..." : "Repair"}
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{ padding: "3px 16px", background: "#C0C0C0", border: "2px solid", borderColor: "#fff #404040 #404040 #fff", cursor: "pointer", fontSize: 11 }}
                >
                  Close
                </button>
              </div>
            </>
          ) : null}
        </div>
      </Window>
    </div>
  );
}

