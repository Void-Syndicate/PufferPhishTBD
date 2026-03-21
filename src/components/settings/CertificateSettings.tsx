import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Window from "../retro/Window";

interface PinnedCert {
  hostname: string;
  fingerprint: string;
  pinnedAt: string;
  issuer: string;
  expiresAt: string;
}

interface Props {
  onClose: () => void;
}

export default function CertificateSettings({ onClose }: Props) {
  const [certs, setCerts] = useState<PinnedCert[]>([]);
  const [hostname, setHostname] = useState("");
  const [fetching, setFetching] = useState(false);
  const [pendingCert, setPendingCert] = useState<PinnedCert | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tofuEnabled, setTofuEnabled] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => {
    loadCerts();
  }, []);

  const loadCerts = async () => {
    try {
      const pinned = await invoke<PinnedCert[]>("get_pinned_certs");
      setCerts(pinned);
    } catch (e) {
      console.error("Failed to load pinned certs:", e);
    }
  };

  const handleFetchCert = async () => {
    if (!hostname.trim()) return;
    setFetching(true);
    setError(null);
    setPendingCert(null);
    try {
      const cert = await invoke<PinnedCert>("fetch_certificate", { hostname: hostname.trim() });
      setPendingCert(cert);
    } catch (e: unknown) {
      setError(`Failed to fetch certificate: ${e}`);
    } finally {
      setFetching(false);
    }
  };

  const handlePinCert = async () => {
    if (!pendingCert) return;
    try {
      await invoke("pin_certificate", { hostname: pendingCert.hostname, fingerprint: pendingCert.fingerprint });
      setPendingCert(null);
      setHostname("");
      await loadCerts();
    } catch (e: unknown) {
      setError(`Failed to pin certificate: ${e}`);
    }
  };

  const handleRemoveCert = async (host: string) => {
    try {
      await invoke("remove_pinned_cert", { hostname: host });
      setConfirmRemove(null);
      await loadCerts();
    } catch (e: unknown) {
      setError(`Failed to remove pin: ${e}`);
    }
  };

  const handleToggleTofu = async () => {
    const newVal = !tofuEnabled;
    setTofuEnabled(newVal);
    try {
      await invoke("set_tofu_enabled", { enabled: newVal });
    } catch (e) {
      console.error("Failed to set TOFU:", e);
      setTofuEnabled(!newVal);
    }
  };

  const fieldsetStyle: React.CSSProperties = {
    border: "2px solid", borderColor: "#808080 #fff #fff #808080",
    padding: 8, marginBottom: 8,
  };
  const inputStyle: React.CSSProperties = {
    padding: 2, border: "2px solid", borderColor: "#404040 #fff #fff #404040",
  };
  const btnStyle: React.CSSProperties = {
    padding: "3px 12px", background: "#C0C0C0",
    border: "2px solid", borderColor: "#fff #404040 #404040 #fff",
    cursor: "pointer", fontSize: 11,
  };

  return (
    <div style={{ position: "fixed", top: 50, left: "50%", transform: "translateX(-50%)", zIndex: 700 }}>
      <Window title="🔒 Certificate Pinning" onClose={onClose} width={460}>
        <div style={{ padding: 12, fontFamily: "var(--font-system)", fontSize: 11 }}>

          <fieldset style={fieldsetStyle}>
            <legend>Trust On First Use (TOFU)</legend>
            <label style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={tofuEnabled} onChange={handleToggleTofu} />
              {" "}Automatically pin certificates on first connection
            </label>
            <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
              When enabled, PufferChat will remember server certificates and warn you if they change unexpectedly.
            </div>
          </fieldset>

          <fieldset style={fieldsetStyle}>
            <legend>Pin New Certificate</legend>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              <input
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="matrix.org"
                onKeyDown={(e) => e.key === "Enter" && handleFetchCert()}
                aria-label="Homeserver hostname"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={handleFetchCert} disabled={fetching || !hostname.trim()} style={btnStyle}>
                {fetching ? "Fetching..." : "Fetch"}
              </button>
            </div>

            {pendingCert && (
              <div style={{ background: "#ffffcc", border: "1px solid #cca", padding: 6, marginBottom: 6 }}>
                <div style={{ fontWeight: "bold", marginBottom: 4 }}>Certificate Found:</div>
                <div style={{ fontSize: 10, fontFamily: "monospace" }}>
                  <div>Host: {pendingCert.hostname}</div>
                  <div>Issuer: {pendingCert.issuer}</div>
                  <div>Expires: {pendingCert.expiresAt}</div>
                  <div style={{ wordBreak: "break-all" }}>SHA-256: {pendingCert.fingerprint}</div>
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                  <button onClick={handlePinCert} style={{ ...btnStyle, fontWeight: "bold" }}>Pin This Certificate</button>
                  <button onClick={() => setPendingCert(null)} style={btnStyle}>Cancel</button>
                </div>
              </div>
            )}
          </fieldset>

          <fieldset style={fieldsetStyle}>
            <legend>Pinned Certificates ({certs.length})</legend>
            {certs.length === 0 ? (
              <div style={{ color: "#666", fontStyle: "italic", padding: 8, textAlign: "center" }}>
                No certificates pinned yet.
              </div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {certs.map((cert) => (
                  <div key={cert.hostname} style={{
                    padding: 6, marginBottom: 4,
                    background: "#f0f0f0", border: "1px solid #ccc",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{cert.hostname}</strong>
                      {confirmRemove === cert.hostname ? (
                        <span>
                          <button onClick={() => handleRemoveCert(cert.hostname)} style={{ ...btnStyle, color: "red", fontSize: 10, padding: "1px 6px" }}>Confirm</button>
                          {" "}
                          <button onClick={() => setConfirmRemove(null)} style={{ ...btnStyle, fontSize: 10, padding: "1px 6px" }}>No</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmRemove(cert.hostname)} style={{ ...btnStyle, fontSize: 10, padding: "1px 6px" }}>Remove</button>
                      )}
                    </div>
                    <div style={{ fontSize: 9, fontFamily: "monospace", color: "#555", marginTop: 2, wordBreak: "break-all" }}>
                      {cert.fingerprint}
                    </div>
                    <div style={{ fontSize: 9, color: "#888", marginTop: 1 }}>
                      Pinned: {new Date(cert.pinnedAt).toLocaleDateString()} | Expires: {cert.expiresAt}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          {error && (
            <div style={{ padding: 4, marginBottom: 6, background: "#ffd4d4", border: "1px solid red", fontSize: 10 }}>
              {error}
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
