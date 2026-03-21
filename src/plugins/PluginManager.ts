// PluginManager — Install, enable, disable, remove plugins
// Manages plugin lifecycle and coordinates bridges

import { invoke } from '@tauri-apps/api/core';
import type { PluginManifest, InstalledPlugin } from './sdk/PluginManifest';
import type { PluginPermission, MatrixMessagePayload } from './sdk/types';
import { PluginContext } from './sdk/PluginContext';
import { PluginBridge } from './PluginBridge';

export interface PluginCommandEntry {
  pluginId: string;
  command: string;
  description: string;
  usage: string;
}

class PluginManagerSingleton {
  private contexts: Map<string, PluginContext> = new Map();
  private bridges: Map<string, PluginBridge> = new Map();
  private commands: Map<string, PluginCommandEntry> = new Map();
  private _onCommandsChanged: (() => void)[] = [];

  /** Load all installed plugins from the backend */
  async loadInstalledPlugins(): Promise<InstalledPlugin[]> {
    try {
      const plugins = await invoke<InstalledPlugin[]>('list_plugins');
      return plugins;
    } catch (e) {
      console.error('Failed to load plugins:', e);
      return [];
    }
  }

  /** Install a plugin from a directory path */
  async installPlugin(pluginPath: string): Promise<InstalledPlugin | null> {
    try {
      const plugin = await invoke<InstalledPlugin>('install_plugin', { pluginPath });
      return plugin;
    } catch (e) {
      console.error('Failed to install plugin:', e);
      return null;
    }
  }

  /** Remove an installed plugin */
  async removePlugin(pluginId: string): Promise<boolean> {
    try {
      await invoke('remove_plugin', { pluginId });
      this.unloadPlugin(pluginId);
      return true;
    } catch (e) {
      console.error('Failed to remove plugin:', e);
      return false;
    }
  }

  /** Enable a plugin */
  async enablePlugin(pluginId: string): Promise<boolean> {
    try {
      await invoke('set_plugin_config', {
        pluginId,
        key: '_enabled',
        value: 'true',
      });
      const ctx = this.contexts.get(pluginId);
      if (ctx) ctx.enabled = true;
      return true;
    } catch (e) {
      console.error('Failed to enable plugin:', e);
      return false;
    }
  }

  /** Disable a plugin */
  async disablePlugin(pluginId: string): Promise<boolean> {
    try {
      await invoke('set_plugin_config', {
        pluginId,
        key: '_enabled',
        value: 'false',
      });
      const ctx = this.contexts.get(pluginId);
      if (ctx) ctx.enabled = false;
      // Remove commands from this plugin
      for (const [cmd, entry] of this.commands) {
        if (entry.pluginId === pluginId) {
          this.commands.delete(cmd);
        }
      }
      this._onCommandsChanged.forEach((cb) => cb());
      return true;
    } catch (e) {
      console.error('Failed to disable plugin:', e);
      return false;
    }
  }

  /** Create a context for a plugin */
  createContext(
    manifest: PluginManifest,
    approvedPermissions: PluginPermission[],
    config: Record<string, unknown>,
    enabled: boolean,
  ): PluginContext {
    const ctx = new PluginContext(manifest, approvedPermissions, config, enabled);
    this.contexts.set(manifest.id, ctx);
    return ctx;
  }

  /** Register a bridge for a loaded plugin */
  registerBridge(pluginId: string, bridge: PluginBridge): void {
    this.bridges.set(pluginId, bridge);
  }

  /** Unregister bridge when plugin is unloaded */
  unregisterBridge(pluginId: string): void {
    const bridge = this.bridges.get(pluginId);
    if (bridge) {
      bridge.detach();
      this.bridges.delete(pluginId);
    }
  }

  /** Unload a plugin (remove context and bridge) */
  unloadPlugin(pluginId: string): void {
    this.unregisterBridge(pluginId);
    this.contexts.delete(pluginId);
    // Remove commands
    for (const [cmd, entry] of this.commands) {
      if (entry.pluginId === pluginId) {
        this.commands.delete(cmd);
      }
    }
    this._onCommandsChanged.forEach((cb) => cb());
  }

  /** Register a command from a plugin */
  registerCommand(pluginId: string, command: string, description: string, usage: string): void {
    this.commands.set(command, { pluginId, command, description, usage });
    this._onCommandsChanged.forEach((cb) => cb());
  }

  /** Check if a command is registered by any plugin */
  getCommand(command: string): PluginCommandEntry | undefined {
    return this.commands.get(command);
  }

  /** Get all registered commands */
  getAllCommands(): PluginCommandEntry[] {
    return Array.from(this.commands.values());
  }

  /** Try to handle a slash command. Returns true if handled. */
  handleSlashCommand(text: string, roomId: string, sender: string): boolean {
    if (!text.startsWith('/')) return false;
    const parts = text.slice(1).split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    if (!cmd) return false;
    const args = text.slice(cmd.length + 2).trim();

    const entry = this.commands.get(cmd);
    if (!entry) return false;

    const bridge = this.bridges.get(entry.pluginId);
    if (!bridge) return false;

    bridge.invokeCommand(cmd, args, roomId, sender);
    return true;
  }

  /** Forward a Matrix message to all enabled plugins with read-messages permission */
  broadcastMessage(msg: MatrixMessagePayload): void {
    for (const [pluginId, bridge] of this.bridges) {
      const ctx = this.contexts.get(pluginId);
      if (ctx?.enabled && ctx.hasPermission('read-messages')) {
        bridge.sendMessage(msg);
      }
    }
  }

  /** Notify all plugins of room change */
  broadcastRoomChanged(roomId: string, roomName: string | null): void {
    for (const [_, bridge] of this.bridges) {
      bridge.sendRoomChanged(roomId, roomName);
    }
  }

  /** Trigger hot reload for a specific plugin */
  hotReloadPlugin(pluginId: string): void {
    const bridge = this.bridges.get(pluginId);
    if (bridge) {
      bridge.triggerHotReload();
    }
  }

  /** Subscribe to command changes */
  onCommandsChanged(callback: () => void): () => void {
    this._onCommandsChanged.push(callback);
    return () => {
      this._onCommandsChanged = this._onCommandsChanged.filter((cb) => cb !== callback);
    };
  }

  /** Get a plugin context by ID */
  getContext(pluginId: string): PluginContext | undefined {
    return this.contexts.get(pluginId);
  }

  /** Get a bridge by plugin ID */
  getBridge(pluginId: string): PluginBridge | undefined {
    return this.bridges.get(pluginId);
  }

  /** Get plugin config from backend */
  async getPluginConfig(pluginId: string, key: string): Promise<string | null> {
    try {
      return await invoke<string | null>('get_plugin_config', { pluginId, key });
    } catch {
      return null;
    }
  }

  /** Set plugin config in backend */
  async setPluginConfig(pluginId: string, key: string, value: string): Promise<void> {
    try {
      await invoke('set_plugin_config', { pluginId, key, value });
    } catch (e) {
      console.error('Failed to set plugin config:', e);
    }
  }
}

// Global singleton
export const pluginManager = new PluginManagerSingleton();
