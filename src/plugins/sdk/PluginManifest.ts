// Plugin Manifest — Type definitions for plugin manifest files

import type { PluginPermission } from './types';

/** The manifest.json schema every plugin must provide */
export interface PluginManifest {
  /** Unique plugin identifier (reverse-domain style recommended) */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Semver version string */
  version: string;
  /** Short description shown in plugin settings */
  description: string;
  /** Author name or organization */
  author: string;
  /** Homepage or repository URL */
  homepage?: string;
  /** Minimum PufferChat version required */
  minAppVersion?: string;
  /** Entry point HTML file relative to plugin root */
  entry: string;
  /** Icon file relative to plugin root (16x16 or 32x32 PNG recommended) */
  icon?: string;
  /** Permissions this plugin requires */
  permissions: PluginPermission[];
  /** Slash commands this plugin registers */
  commands?: PluginCommandDef[];
  /** Default configuration values */
  defaultConfig?: Record<string, unknown>;
  /** Plugin tags for categorization */
  tags?: string[];
}

export interface PluginCommandDef {
  /** Command name without the leading slash */
  command: string;
  /** Description shown in command help */
  description: string;
  /** Usage pattern, e.g. "/roll <dice>" */
  usage: string;
}

/** Installed plugin metadata stored locally */
export interface InstalledPlugin {
  manifest: PluginManifest;
  /** Absolute path to plugin directory on disk */
  path: string;
  /** Whether the plugin is currently enabled */
  enabled: boolean;
  /** Timestamp of installation (ms since epoch) */
  installedAt: number;
  /** User-approved permissions */
  approvedPermissions: PluginPermission[];
  /** Per-plugin config overrides */
  config: Record<string, unknown>;
}
