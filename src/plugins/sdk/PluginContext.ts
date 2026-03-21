// PluginContext — Runtime context passed to plugins with permission-restricted API

import type { PluginPermission, PluginInitPayload } from './types';
import type { PluginManifest } from './PluginManifest';

/**
 * PluginContext is created by the host for each loaded plugin.
 * It holds the plugin's manifest, runtime state, and the set of
 * approved permissions used to gate bridge message handling.
 */
export class PluginContext {
  public readonly pluginId: string;
  public readonly manifest: PluginManifest;
  public readonly approvedPermissions: Set<PluginPermission>;
  public readonly config: Record<string, unknown>;
  public enabled: boolean;

  private _registeredCommands: Map<string, { description: string; usage: string }> = new Map();
  private _storage: Map<string, string> = new Map();

  constructor(
    manifest: PluginManifest,
    approvedPermissions: PluginPermission[],
    config: Record<string, unknown>,
    enabled: boolean,
  ) {
    this.pluginId = manifest.id;
    this.manifest = manifest;
    this.approvedPermissions = new Set(approvedPermissions);
    this.config = { ...manifest.defaultConfig, ...config };
    this.enabled = enabled;
  }

  /** Check if a permission is approved for this plugin */
  hasPermission(perm: PluginPermission): boolean {
    return this.approvedPermissions.has(perm);
  }

  /** Build the init payload sent to the plugin iframe */
  buildInitPayload(
    roomId: string | null,
    roomName: string | null,
    userId: string,
    displayName: string | null,
    devMode: boolean,
  ): PluginInitPayload {
    return {
      pluginId: this.pluginId,
      roomId,
      roomName,
      userId,
      displayName,
      permissions: Array.from(this.approvedPermissions),
      config: this.config,
      devMode,
    };
  }

  /** Register a command from this plugin */
  registerCommand(command: string, description: string, usage: string): void {
    if (!this.hasPermission('register-commands')) return;
    this._registeredCommands.set(command, { description, usage });
  }

  /** Get all registered commands */
  getCommands(): Map<string, { description: string; usage: string }> {
    return new Map(this._registeredCommands);
  }

  /** Storage operations (host-side backing) */
  storageGet(key: string): string | undefined {
    return this._storage.get(key);
  }

  storageSet(key: string, value: string): void {
    this._storage.set(key, value);
  }

  storageDelete(key: string): void {
    this._storage.delete(key);
  }

  /** Load storage from persisted data */
  loadStorage(data: Record<string, string>): void {
    this._storage.clear();
    for (const [k, v] of Object.entries(data)) {
      this._storage.set(k, v);
    }
  }

  /** Export storage for persistence */
  exportStorage(): Record<string, string> {
    const obj: Record<string, string> = {};
    this._storage.forEach((v, k) => { obj[k] = v; });
    return obj;
  }
}
