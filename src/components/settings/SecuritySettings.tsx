import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Window from "../retro/Window";

interface PinnedCert {
  host: string;
  fingerprintSha256: string;
  subject: string;
  issuer: string;
  notAfter: string;
  pinnedAt: number;
  autoPinned: boolean;
}

interface DohConfig {
  enabled: boolean;
  provider: string;
  customUrl: string | null;
}

interface Props {
  onClose: () => void;
}

export default function SecuritySettingsPanel({ onClose }: Props) {
  const [tab, setTab] = useState<"certs" | "doh">("certs");
  const [certs, setCerts] = useState<PinnedCert[]>([]);
  const [doh, setDoh] = useState<DohConfig>({ enabled: false, provider: "cloudflare", customUrl: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      invoke<PinnedCert[]>("get_pinned_certs").catch(() => []),
      invoke<DohConfig>("get_doh_config").catch(() => ({ enabled: false, provider: "cloudflare", customUrl: null })),
    ]).then(([c, d]) => {
      setCerts(c);
      setDoh(d);
      setLoading(false);
    });
  }, []);

  const removeCert = async (host: string) => {
    try {
      await invoke("remove_pinned_cert", { host });
      setCerts((c) => c.filter((cert) => cert.host !== host));
    } catch (e) {
      console.error("Failed to remove cert:", e);
    }
  };

  const saveDoh = async () => {
    try {
      await invoke("set_doh_config", { config: doh });
    } catch (e) {
      console.error("Failed to save DoH config:", e);
    }
  };

  return (
    <div style={{ position: "fixed", top: 40, left: "50%", transform: "translateX(-50%)", zIndex: 700 }}>
      <Window title="Privacy & Security Settings" onClose={onClose} width={440} height={400}>
        <div style={{ padding: 8, fontFamily: "var(--font-system)", fontSize: 11 }}>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
            <button
              onClick={() => setTab("certs")}
              aria-label="Certificate pinning tab"
              aria-selected={tab === "certs"}
              role="tab"
              style={{
                padding: "3px 12px",
                background: tab === "certs" ? "#C0C0C0" : "#A0A0A0",
                border: "2px solid",
                borderColor: tab === "certs" ? "#fff #404040 #C0C0C0 #fff" : "#fff #404040 #404040 #fff",
                borderBottom: tab === "certs" ? "none" : undefined,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: tab === "certs" ? "bold" : "normal",
              }}
            >
              {"\uD83D\uDD12"} Certificates
            </button>
            <button
              onClick={() => setTab("doh")}
              aria-label="DNS over HTTPS tab"
              aria-selected={tab === "doh"}
              role="tab"
              style={{
                padding: "3px 12px",
                background: tab === "doh" ? "#C0C0C0" : "#A0A0A0",
                border: "2px solid",
                borderColor: tab === "doh" ? "#fff #404040 #C0C0C0 #fff" : "#fff #404040 #404040 #fff",
                borderBottom: tab === "doh" ? "none" : undefined,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: tab === "doh" ? "bold" : "normal",
              }}
            >
              {"\uD83C\uDF10"} DNS-over-HTTPS
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 24 }}>{"\u231B"} Loading...</div>
          ) : tab === "certs" ? (
            <div role="tabpanel" aria-label="Certificate pinning">
              <p style={{ marginBottom: 8, color: "#404040" }}>
                Pinned TLS certificates (TOFU model). You will be warned if a certificate changes.
              </p>
              {certs.length === 0 ? (
                <div style={{ textAlign: "center", padding: 16, color: "#808080" }}>
                  No pinned certificates yet. Certificates are automatically pinned on first connection.
                </div>
              ) : (
                <div style={{ maxHeight: 250, overflow: "auto", border: "2px solid", borderColor: "#404040 #fff #fff #404040" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead>
                      <tr style={{ background: "#000080", color: "#fff" }}>
                        <th style={{ padding: 3, textAlign: "left" }}>Host</th>
                        <th style={{ padding: 3, textAlign: "left" }}>Subject</th>
                        <th style={{ padding: 3 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {certs.map((cert) => (
                        <tr key={cert.host} style={{ borderBottom: "1px solid #C0C0C0" }}>
                          <td style={{ padding: 3 }}>{cert.host}</td>
                          <td style={{ padding: 3 }}>{cert.subject}</td>
                          <td style={{ padding: 3, textAlign: "center" }}>
                            <button
                              onClick={() => removeCert(cert.host)}
                              aria-label={`Remove pinned certificate for ${cert.host}`}
                              style={{
                                padding: "1px 8px",
                                background: "#C0C0C0",
                                border: "2px solid",
                                borderColor: "#fff #404040 #404040 #fff",
                                cursor: "pointer",
                                fontSize: 10,
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div role="tabpanel" aria-label="DNS over HTTPS settings">
              <p style={{ marginBottom: 8, color: "#404040" }}>
                Use DNS-over-HTTPS for encrypted DNS resolution. Prevents DNS-based tracking.
              </p>
              <label style={{ display: "block", marginBottom: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={doh.enabled}
                  onChange={(e) => setDoh({ ...doh, enabled: e.target.checked })}
                  aria-label="Enable DNS over HTTPS"
                />{" "}Enable DNS-over-HTTPS
              </label>
              {doh.enabled && (
                <>
                  <fieldset style={{ border: "2px solid", borderColor: "#808080 #fff #fff #808080", padding: 8, marginBottom: 8 }}>
                    <legend>Provider</legend>
                    <label style={{ display: "block", marginBottom: 4, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="doh-provider"
                        value="cloudflare"
                        checked={doh.provider === "cloudflare"}
                        onChange={() => setDoh({ ...doh, provider: "cloudflare" })}
                        aria-label="Cloudflare 1.1.1.1"
                      />{" "}Cloudflare (1.1.1.1)
                    </label>
                    <label style={{ display: "block", marginBottom: 4, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="doh-provider"
                        value="google"
                        checked={doh.provider === "google"}
                        onChange={() => setDoh({ ...doh, provider: "google" })}
                        aria-label="Google DNS"
                      />{" "}Google (8.8.8.8)
                    </label>
                    <label style={{ display: "block", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="doh-provider"
                        value="custom"
                        checked={doh.provider === "custom"}
                        onChange={() => setDoh({ ...doh, provider: "custom" })}
                        aria-label="Custom DoH provider"
                      />{" "}Custom
                    </label>
                  </fieldset>
                  {doh.provider === "custom" && (
                    <div style={{ marginBottom: 8 }}>
                      <label htmlFor="doh-url" style={{ display: "block", marginBottom: 2 }}>Custom DoH URL:</label>
                      <input
                        id="doh-url"
                        type="url"
                        value={doh.customUrl || ""}
                        onChange={(e) => setDoh({ ...doh, customUrl: e.target.value || null })}
                        placeholder="https://dns.example.com/dns-query"
                        aria-label="Custom DoH URL"
                        style={{ width: "100%", padding: 2, border: "2px solid", borderColor: "#404040 #fff #fff #404040" }}
                      />
                    </div>
                  )}
                </>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <button
                  onClick={saveDoh}
                  aria-label="Save DNS over HTTPS settings"
                  style={{ padding: "3px 16px", background: "#C0C0C0", border: "2px solid", borderColor: "#fff #404040 #404040 #fff", cursor: "pointer", fontSize: 11, fontWeight: "bold" }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </Window>
    </div>
  );
}

