import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import styles from "./CacheSettings.module.css";

interface CacheInfo {
  total_bytes: number;
  file_count: number;
  max_bytes: number;
}

const LIMIT_OPTIONS = [
  { label: "100 MB", value: 100 * 1024 * 1024 },
  { label: "500 MB", value: 500 * 1024 * 1024 },
  { label: "1 GB", value: 1024 * 1024 * 1024 },
  { label: "2 GB", value: 2 * 1024 * 1024 * 1024 },
  { label: "Unlimited", value: 0 },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function CacheSettings() {
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState("");

  const fetchCacheInfo = useCallback(async () => {
    try {
      const info: CacheInfo = await invoke("get_cache_size");
      setCacheInfo(info);
    } catch (e) {
      console.error("Failed to get cache info:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCacheInfo(); }, [fetchCacheInfo]);

  const handleClear = async () => {
    setClearing(true);
    setShowConfirm(false);
    try {
      await invoke("clear_media_cache");
      setStatus("Cache cleared successfully!");
      await fetchCacheInfo();
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Failed to clear cache:", e);
      setStatus("Failed to clear cache.");
    } finally {
      setClearing(false);
    }
  };

  const handleLimitChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value, 10);
    try {
      await invoke("set_cache_limit", { maxBytes: value });
      await fetchCacheInfo();
      setStatus("Cache limit updated.");
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      console.error("Failed to set cache limit:", err);
    }
  };

  if (loading) {
    return <div className={styles.panel}>Loading cache info...</div>;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>?? Media Cache Usage</div>
        <div className={styles.statsRow}>
          <span className={styles.statsLabel}>Cache Size:</span>
          <span className={styles.statsValue}>{formatBytes(cacheInfo?.total_bytes ?? 0)}</span>
        </div>
        <div className={styles.statsRow}>
          <span className={styles.statsLabel}>Files Cached:</span>
          <span className={styles.statsValue}>{cacheInfo?.file_count ?? 0}</span>
        </div>
        <div className={styles.statsRow}>
          <span className={styles.statsLabel}>Cache Limit:</span>
          <span className={styles.statsValue}>
            {cacheInfo?.max_bytes ? formatBytes(cacheInfo.max_bytes) : "Unlimited"}
          </span>
        </div>

        <button
          className={styles.clearBtnDanger}
          onClick={() => setShowConfirm(true)}
          disabled={clearing || (cacheInfo?.file_count ?? 0) === 0}
        >
          {clearing ? "Clearing..." : "🗑️ Clear Cache"}
        </button>

        {status && <div className={styles.statusMsg}>{status}</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>?? Cache Limit</div>
        <div className={styles.limitRow}>
          <label>Max cache size:</label>
          <select
            className={styles.limitSelect}
            value={cacheInfo?.max_bytes ?? 0}
            onChange={handleLimitChange}
          >
            {LIMIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {showConfirm && (
        <div className={styles.confirmOverlay} onClick={() => setShowConfirm(false)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <p>?? Are you sure you want to clear the media cache?</p>
            <p>This will delete {cacheInfo?.file_count ?? 0} cached files ({formatBytes(cacheInfo?.total_bytes ?? 0)}).</p>
            <div className={styles.confirmButtons}>
              <button className={styles.clearBtn} onClick={handleClear}>Yes, Clear</button>
              <button className={styles.clearBtn} onClick={() => setShowConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
