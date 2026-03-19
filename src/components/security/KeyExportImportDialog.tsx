import { useState } from "react";
import { useEncryption } from "../../hooks/useEncryption";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./Security.module.css";

interface KeyExportImportDialogProps {
  onClose: () => void;
}

export default function KeyExportImportDialog({ onClose }: KeyExportImportDialogProps) {
  const { exportRoomKeys, importRoomKeys } = useEncryption();

  const [tab, setTab] = useState<"export" | "import">("export");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [importData, setImportData] = useState("");
  const [exportedData, setExportedData] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters");
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError("Passphrases do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await exportRoomKeys(passphrase);
      setExportedData(data);
      setSuccess("Keys exported! Copy the data below and save it securely.");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      setError("Please paste the exported key data");
      return;
    }
    if (!passphrase) {
      setError("Please enter the passphrase used during export");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const count = await importRoomKeys(importData.trim(), passphrase);
      setSuccess(`Successfully imported ${count} room keys!`);
      setImportData("");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Window
          title="📦 Key Export / Import"
          onClose={onClose}
          showMinimize={false}
          showMaximize={false}
          width={480}
        >
          <div className={styles.dialogBody}>
            <div className={styles.tabBar}>
              <button
                className={`${styles.tab} ${tab === "export" ? styles.tabActive : ""}`}
                onClick={() => { setTab("export"); setError(""); setSuccess(""); }}
              >
                📤 Export
              </button>
              <button
                className={`${styles.tab} ${tab === "import" ? styles.tabActive : ""}`}
                onClick={() => { setTab("import"); setError(""); setSuccess(""); }}
              >
                📥 Import
              </button>
            </div>

            {tab === "export" && (
              <div className={styles.section}>
                <p className={styles.description}>
                  Export your encryption keys to transfer them to another device
                  or as a backup. Keys are protected with a passphrase.
                </p>

                <div className={styles.field}>
                  <TextInput
                    label="Passphrase"
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Min 8 characters"
                  />
                </div>
                <div className={styles.field}>
                  <TextInput
                    label="Confirm Passphrase"
                    type="password"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    placeholder="Repeat passphrase"
                  />
                </div>

                <Button variant="primary" onClick={handleExport} disabled={loading}>
                  {loading ? "Exporting..." : "Export Keys"}
                </Button>

                {exportedData && (
                  <div className={styles.exportDataBox}>
                    <textarea
                      className={styles.exportTextarea}
                      value={exportedData}
                      readOnly
                      rows={6}
                    />
                    <Button
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(exportedData)}
                    >
                      📋 Copy
                    </Button>
                  </div>
                )}
              </div>
            )}

            {tab === "import" && (
              <div className={styles.section}>
                <p className={styles.description}>
                  Import encryption keys from a previous export. Enter the
                  passphrase used during export.
                </p>

                <div className={styles.field}>
                  <TextInput
                    label="Passphrase"
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Passphrase used during export"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Key Data</label>
                  <textarea
                    className={styles.exportTextarea}
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder="Paste exported key data here..."
                    rows={6}
                  />
                </div>

                <Button variant="primary" onClick={handleImport} disabled={loading || !importData.trim()}>
                  {loading ? "Importing..." : "Import Keys"}
                </Button>
              </div>
            )}

            {error && <div className={styles.error}>⚠️ {error}</div>}
            {success && <div className={styles.success}>✅ {success}</div>}

            <div className={styles.buttonRow}>
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}
