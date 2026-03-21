import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Window from "../retro/Window";

interface ProxyConfig {
  proxyType: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  enabled: boolean;
}

interface Props {
  onClose: () => void;
}

export default function ProxySettings({ onClose }: Props) {
  const [config, setConfig] = useState<ProxyConfig>({
    proxyType: "none",
    host: "",
    port: 1080,
    username: null,
    password: null,
    enabled: false,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<ProxyConfig>("get_proxy_config")
      .then(setConfig)
      .catch((e) => console.error("Failed to load proxy config:", e));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await invoke("set_proxy_config", { config });
      onClose();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await invoke<boolean>("test_proxy_connection", { config });
      setTestResult(ok ? "Connection successful!" : "Connection failed.");
    } catch (e: unknown) {
      setTestResult(`Test failed: ${e}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 700 }}>
      <Window title="Proxy Settings" onClose={onClose} width={380}>
        <div style={{ padding: 12, fontFamily: "var(--font-system)", fontSize: 11 }}>
          <fieldset style={{ border: "2px solid", borderColor: "#808080 #fff #fff #808080", padding: 8, marginBottom: 8 }}>
            <legend>Proxy Type</legend>
            <label style={{ display: "block", marginBottom: 4, cursor: "pointer" }}>
              <input
                type="radio"
                name="proxyType"
                value="none"
                checked={config.proxyType === "none"}
                onChange={() => setConfig({ ...config, proxyType: "none", enabled: false })}
                aria-label="No proxy"
              />{" "}None (Direct Connection)
            </label>
            <label style={{ display: "block", marginBottom: 4, cursor: "pointer" }}>
              <input
                type="radio"
                name="proxyType"
                value="socks5"
                checked={config.proxyType === "socks5"}
                onChange={() => setConfig({ ...config, proxyType: "socks5", enabled: true })}
                aria-label="SOCKS5 proxy"
              />{" "}SOCKS5 (Tor compatible)
            </label>
            <label style={{ display: "block", cursor: "pointer" }}>
              <input
                type="radio"
                name="proxyType"
                value="http"
                checked={config.proxyType === "http"}
                onChange={() => setConfig({ ...config, proxyType: "http", enabled: true })}
                aria-label="HTTP proxy"
              />{" "}HTTP Proxy
            </label>
          </fieldset>

          {config.proxyType !== "none" && (
            <>
              <div style={{ marginBottom: 6 }}>
                <label htmlFor="proxy-host" style={{ display: "block", marginBottom: 2 }}>Host:</label>
                <input
                  id="proxy-host"
                  type="text"
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  placeholder="127.0.0.1"
                  aria-label="Proxy host"
                  style={{ width: "100%", padding: 2, border: "2px solid", borderColor: "#404040 #fff #fff #404040" }}
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label htmlFor="proxy-port" style={{ display: "block", marginBottom: 2 }}>Port:</label>
                <input
                  id="proxy-port"
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 1080 })}
                  min={1}
                  max={65535}
                  aria-label="Proxy port"
                  style={{ width: 80, padding: 2, border: "2px solid", borderColor: "#404040 #fff #fff #404040" }}
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label htmlFor="proxy-user" style={{ display: "block", marginBottom: 2 }}>Username (optional):</label>
                <input
                  id="proxy-user"
                  type="text"
                  value={config.username || ""}
                  onChange={(e) => setConfig({ ...config, username: e.target.value || null })}
                  aria-label="Proxy username"
                  style={{ width: "100%", padding: 2, border: "2px solid", borderColor: "#404040 #fff #fff #404040" }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label htmlFor="proxy-pass" style={{ display: "block", marginBottom: 2 }}>Password (optional):</label>
                <input
                  id="proxy-pass"
                  type="password"
                  value={config.password || ""}
                  onChange={(e) => setConfig({ ...config, password: e.target.value || null })}
                  aria-label="Proxy password"
                  style={{ width: "100%", padding: 2, border: "2px solid", borderColor: "#404040 #fff #fff #404040" }}
                />
              </div>
            </>
          )}

          {testResult && (
            <div style={{ padding: 4, marginBottom: 6, background: testResult.includes("successful") ? "#d4ffd4" : "#ffd4d4", border: "1px solid #808080", fontSize: 10 }}>
              {testResult}
            </div>
          )}
          {error && (
            <div style={{ padding: 4, marginBottom: 6, background: "#ffd4d4", border: "1px solid red", fontSize: 10 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            {config.proxyType !== "none" && (
              <button
                onClick={handleTest}
                disabled={testing}
                aria-label="Test proxy connection"
                style={{ padding: "3px 12px", background: "#C0C0C0", border: "2px solid", borderColor: "#fff #404040 #404040 #fff", cursor: "pointer", fontSize: 11 }}
              >
                {testing ? "Testing..." : "Test"}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              aria-label="Save proxy settings"
              style={{ padding: "3px 16px", background: "#C0C0C0", border: "2px solid", borderColor: "#fff #404040 #404040 #fff", cursor: "pointer", fontSize: 11, fontWeight: "bold" }}
            >
              {saving ? "Saving..." : "OK"}
            </button>
            <button
              onClick={onClose}
              aria-label="Cancel"
              style={{ padding: "3px 16px", background: "#C0C0C0", border: "2px solid", borderColor: "#fff #404040 #404040 #fff", cursor: "pointer", fontSize: 11 }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Window>
    </div>
  );
}

