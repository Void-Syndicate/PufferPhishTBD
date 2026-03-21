import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import styles from "./DnsSettings.module.css";

interface DohConfig {
  enabled: boolean;
  provider: string;
  customUrl: string | null;
}

interface DnsTestResult {
  success: boolean;
  resolvedIp: string | null;
  latencyMs: number;
  provider: string;
}

interface Props {
  onClose: () => void;
}

const DOH_PROVIDERS = [
  { id: "cloudflare", label: "Cloudflare (1.1.1.1)", description: "Fast, privacy-focused DNS" },
  { id: "google", label: "Google (8.8.8.8)", description: "Reliable, widely used" },
  { id: "custom", label: "Custom URL", description: "Use your own DoH provider" },
];

export default function DnsSettings({ onClose }: Props) {
  const [config, setConfig] = useState<DohConfig>({
    enabled: false,
    provider: "cloudflare",
    customUrl: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<DnsTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [testHostname, setTestHostname] = useState("matrix.org");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const cfg = await invoke<DohConfig>("get_doh_config");
      setConfig(cfg);
    } catch (e: unknown) {
      console.error("Failed to load DoH config:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await invoke("set_doh_config", { config });
      setStatusMsg("DNS settings saved successfully.");
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (e: unknown) {
      setError(`Failed to save: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const result = await invoke<DnsTestResult>("set_doh_config", {
        config,
        testHostname: testHostname.trim() || "matrix.org",
      });
      setTestResult(result);
    } catch (e: unknown) {
      setTestResult({
        success: false,
        resolvedIp: null,
        latencyMs: 0,
        provider: config.provider,
      });
      setError(`DNS test failed: ${e}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.panel}>
        <div className={styles.loadingState}>{"\u231B"} Loading DNS settings...</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.infoBox}>
        <span className={styles.infoIcon}>{"\uD83C\uDF10"}</span>
        <div className={styles.infoText}>
          DNS-over-HTTPS encrypts your DNS queries, preventing ISPs and network
          observers from seeing which servers you connect to.
        </div>
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}
      {statusMsg && <div className={styles.statusMsg}>{statusMsg}</div>}

      <div className={styles.section}>
        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              aria-label="Enable DNS-over-HTTPS"
            />
            <span className={styles.toggleText}>Enable DNS-over-HTTPS</span>
          </label>
          <span className={config.enabled ? styles.statusOn : styles.statusOff}>
            {config.enabled ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      {config.enabled && (
        <>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>DoH Provider</div>
            {DOH_PROVIDERS.map((p) => (
              <label key={p.id} className={styles.providerOption}>
                <input
                  type="radio"
                  name="doh-provider"
                  value={p.id}
                  checked={config.provider === p.id}
                  onChange={() => setConfig({ ...config, provider: p.id })}
                  aria-label={p.label}
                />
                <div className={styles.providerInfo}>
                  <span className={styles.providerName}>{p.label}</span>
                  <span className={styles.providerDesc}>{p.description}</span>
                </div>
              </label>
            ))}
          </div>

          {config.provider === "custom" && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Custom DoH URL</div>
              <input
                type="url"
                value={config.customUrl || ""}
                onChange={(e) =>
                  setConfig({ ...config, customUrl: e.target.value || null })
                }
                placeholder="https://dns.example.com/dns-query"
                className={styles.urlInput}
                aria-label="Custom DoH URL"
              />
              <div className={styles.urlHint}>
                Enter the full URL of your DNS-over-HTTPS endpoint
              </div>
            </div>
          )}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Test DNS Resolution</div>
            <div className={styles.testRow}>
              <label htmlFor="test-host" className={styles.testLabel}>
                Hostname:
              </label>
              <input
                id="test-host"
                type="text"
                value={testHostname}
                onChange={(e) => setTestHostname(e.target.value)}
                placeholder="matrix.org"
                className={styles.testInput}
                aria-label="Test hostname"
              />
              <button
                className={styles.testBtn}
                onClick={handleTest}
                disabled={testing}
                aria-label="Test DNS resolution"
              >
                {testing ? "Testing..." : "Test"}
              </button>
            </div>

            {testResult && (
              <div
                className={
                  testResult.success ? styles.testSuccess : styles.testFailure
                }
              >
                {testResult.success ? (
                  <>
                    <div>{"\u2714"} Resolution successful</div>
                    <div className={styles.testDetail}>
                      IP: {testResult.resolvedIp} | Latency: {testResult.latencyMs}ms |
                      Provider: {testResult.provider}
                    </div>
                  </>
                ) : (
                  <div>{"\u2718"} Resolution failed — check your provider URL</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <div className={styles.buttonRow}>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
          aria-label="Save DNS settings"
        >
          {saving ? "Saving..." : "Apply"}
        </button>
        <button className={styles.cancelBtn} onClick={onClose} aria-label="Close">
          Close
        </button>
      </div>
    </div>
  );
}
