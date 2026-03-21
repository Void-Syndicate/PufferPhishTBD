// PluginSettings — List installed plugins, enable/disable, per-plugin settings, install/remove

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePluginStore } from '../../stores/pluginStore';
import { pluginManager } from '../../plugins/PluginManager';
import type { InstalledPlugin } from '../../plugins/sdk/PluginManifest';
import styles from './PluginSettings.module.css';

interface PluginSettingsProps {
  onClose: () => void;
}

export default function PluginSettings({ onClose }: PluginSettingsProps) {
  const { plugins, setPlugins, setPluginEnabled, devMode, setDevMode, removePlugin: removeFromStore } = usePluginStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [installPath, setInstallPath] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const list = await pluginManager.loadInstalledPlugins();
      setPlugins(list);
    } catch (e) {
      setError('Failed to load plugins');
    } finally {
      setLoading(false);
    }
  }, [setPlugins]);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const handleToggle = async (pluginId: string, currentEnabled: boolean) => {
    try {
      if (currentEnabled) {
        await pluginManager.disablePlugin(pluginId);
        setPluginEnabled(pluginId, false);
        setStatus(`Plugin disabled`);
      } else {
        await pluginManager.enablePlugin(pluginId);
        setPluginEnabled(pluginId, true);
        setStatus(`Plugin enabled`);
      }
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      setError(`Failed to toggle plugin: ${e}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleRemove = async (pluginId: string) => {
    if (!confirm(`Remove plugin "${pluginId}"? This cannot be undone.`)) return;
    try {
      const success = await pluginManager.removePlugin(pluginId);
      if (success) {
        removeFromStore(pluginId);
        if (selectedId === pluginId) setSelectedId(null);
        setStatus('Plugin removed');
        setTimeout(() => setStatus(''), 2000);
      } else {
        setError('Failed to remove plugin');
        setTimeout(() => setError(''), 3000);
      }
    } catch (e) {
      setError(`Failed to remove: ${e}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleInstall = async () => {
    if (!installPath.trim()) {
      setError('Enter a plugin path');
      setTimeout(() => setError(''), 2000);
      return;
    }
    try {
      const plugin = await pluginManager.installPlugin(installPath.trim());
      if (plugin) {
        await loadPlugins();
        setInstallPath('');
        setStatus(`Plugin "${plugin.manifest.name}" installed!`);
        setTimeout(() => setStatus(''), 3000);
      } else {
        setError('Installation failed');
        setTimeout(() => setError(''), 3000);
      }
    } catch (e) {
      setError(`Install failed: ${e}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const selectedPlugin = plugins.find((p) => p.manifest.id === selectedId);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>{'\uD83E\uDDE9'} Plugin Manager</span>
        <div className={styles.headerRight}>
          {devMode && <span className={styles.devBadge}>DEV MODE</span>}
          <button className={styles.closeBtn} onClick={onClose}>{'\u2716'}</button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{'\uD83D\uDCE6'} Install Plugin</div>
          <div className={styles.installBar}>
            <input
              className={styles.installInput}
              type="text"
              placeholder="Plugin directory path..."
              value={installPath}
              onChange={(e) => setInstallPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
            />
            <button className={styles.installBtn} onClick={handleInstall}>Install</button>
          </div>
          <div className={styles.devModeRow}>
            <label>
              <input
                type="checkbox"
                checked={devMode}
                onChange={(e) => setDevMode(e.target.checked)}
              />
              {' '}Developer Mode (hot-reload, debug logs)
            </label>
          </div>
          {status && <div className={styles.statusMsg}>{status}</div>}
          {error && <div className={styles.errorMsg}>{error}</div>}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {'\uD83D\uDD0C'} Installed Plugins ({plugins.length})
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading plugins...</div>
          ) : plugins.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>{'\uD83E\uDDE9'}</div>
              No plugins installed yet.
              <br />Install a plugin by entering its directory path above.
            </div>
          ) : (
            plugins.map((plugin) => (
              <div
                key={plugin.manifest.id}
                className={selectedId === plugin.manifest.id ? styles.pluginCardSelected : styles.pluginCard}
                onClick={() => setSelectedId(
                  selectedId === plugin.manifest.id ? null : plugin.manifest.id,
                )}
              >
                <div className={styles.pluginIcon}>
                  {plugin.manifest.icon ? '\uD83E\uDDE9' : '\uD83D\uDD0C'}
                </div>
                <div className={styles.pluginInfo}>
                  <div>
                    <span className={styles.pluginName}>{plugin.manifest.name}</span>
                    <span className={styles.pluginVersion}>v{plugin.manifest.version}</span>
                  </div>
                  <div className={styles.pluginDesc}>{plugin.manifest.description}</div>
                  <div className={styles.pluginAuthor}>by {plugin.manifest.author}</div>
                </div>
                <div className={styles.pluginActions}>
                  <button
                    className={plugin.enabled ? styles.toggleBtnEnabled : styles.toggleBtnDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(plugin.manifest.id, plugin.enabled);
                    }}
                  >
                    {plugin.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    className={styles.removeBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(plugin.manifest.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedPlugin && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {'\uD83D\uDD0D'} Plugin Details: {selectedPlugin.manifest.name}
            </div>
            <div className={styles.detailPanel}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>ID:</span>
                <span className={styles.detailValue}>{selectedPlugin.manifest.id}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Version:</span>
                <span className={styles.detailValue}>{selectedPlugin.manifest.version}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Author:</span>
                <span className={styles.detailValue}>{selectedPlugin.manifest.author}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Description:</span>
                <span className={styles.detailValue}>{selectedPlugin.manifest.description}</span>
              </div>
              {selectedPlugin.manifest.homepage && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Homepage:</span>
                  <span className={styles.detailValue}>{selectedPlugin.manifest.homepage}</span>
                </div>
              )}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Entry:</span>
                <span className={styles.detailValue}>{selectedPlugin.manifest.entry}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Path:</span>
                <span className={styles.detailValue}>{selectedPlugin.path}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Installed:</span>
                <span className={styles.detailValue}>
                  {new Date(selectedPlugin.installedAt).toLocaleDateString()}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Permissions:</span>
                <span className={styles.detailValue}>
                  {selectedPlugin.approvedPermissions.map((p) => (
                    <span key={p} className={styles.permissionBadge}>{p}</span>
                  ))}
                </span>
              </div>
              {selectedPlugin.manifest.commands && selectedPlugin.manifest.commands.length > 0 && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Commands:</span>
                  <span className={styles.detailValue}>
                    <div className={styles.commandList}>
                      {selectedPlugin.manifest.commands.map((cmd) => (
                        <div key={cmd.command} className={styles.commandItem}>
                          /{cmd.command} — {cmd.description}
                        </div>
                      ))}
                    </div>
                  </span>
                </div>
              )}
              {selectedPlugin.manifest.tags && selectedPlugin.manifest.tags.length > 0 && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Tags:</span>
                  <span className={styles.detailValue}>
                    {selectedPlugin.manifest.tags.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
