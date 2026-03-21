// Plugin Store — Zustand store for plugin state management

import { create } from 'zustand';
import type { InstalledPlugin, PluginManifest } from '../plugins/sdk/PluginManifest';
import type { PluginPermission } from '../plugins/sdk/types';
import type { PluginCommandEntry } from '../plugins/PluginManager';

export interface PluginStoreState {
  /** All installed plugins */
  plugins: InstalledPlugin[];
  /** Currently active (enabled) plugin IDs */
  activePluginIds: Set<string>;
  /** Registered slash commands from plugins */
  commands: PluginCommandEntry[];
  /** Whether we are in dev mode */
  devMode: boolean;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Active widgets in the current room */
  activeWidgets: WidgetInfo[];

  // Actions
  setPlugins: (plugins: InstalledPlugin[]) => void;
  addPlugin: (plugin: InstalledPlugin) => void;
  removePlugin: (pluginId: string) => void;
  setPluginEnabled: (pluginId: string, enabled: boolean) => void;
  updatePluginConfig: (pluginId: string, config: Record<string, unknown>) => void;
  setCommands: (commands: PluginCommandEntry[]) => void;
  addCommand: (entry: PluginCommandEntry) => void;
  removeCommandsByPlugin: (pluginId: string) => void;
  setDevMode: (devMode: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveWidgets: (widgets: WidgetInfo[]) => void;
  addWidget: (widget: WidgetInfo) => void;
  removeWidget: (widgetId: string) => void;
}

export interface WidgetInfo {
  widgetId: string;
  name: string;
  type: string;
  url: string;
  roomId: string;
  creatorUserId: string;
  data?: Record<string, unknown>;
}

function loadDevMode(): boolean {
  try {
    return localStorage.getItem('pufferchat_plugin_devmode') === 'true';
  } catch {
    return false;
  }
}

export const usePluginStore = create<PluginStoreState>((set, get) => ({
  plugins: [],
  activePluginIds: new Set(),
  commands: [],
  devMode: loadDevMode(),
  loading: false,
  error: null,
  activeWidgets: [],

  setPlugins: (plugins) => {
    const activeIds = new Set(plugins.filter((p) => p.enabled).map((p) => p.manifest.id));
    set({ plugins, activePluginIds: activeIds });
  },

  addPlugin: (plugin) => {
    set((s) => {
      const existing = s.plugins.filter((p) => p.manifest.id !== plugin.manifest.id);
      const updated = [...existing, plugin];
      const activeIds = new Set(updated.filter((p) => p.enabled).map((p) => p.manifest.id));
      return { plugins: updated, activePluginIds: activeIds };
    });
  },

  removePlugin: (pluginId) => {
    set((s) => {
      const updated = s.plugins.filter((p) => p.manifest.id !== pluginId);
      const activeIds = new Set(updated.filter((p) => p.enabled).map((p) => p.manifest.id));
      const commands = s.commands.filter((c) => c.pluginId !== pluginId);
      return { plugins: updated, activePluginIds: activeIds, commands };
    });
  },

  setPluginEnabled: (pluginId, enabled) => {
    set((s) => {
      const updated = s.plugins.map((p) =>
        p.manifest.id === pluginId ? { ...p, enabled } : p,
      );
      const activeIds = new Set(updated.filter((p) => p.enabled).map((p) => p.manifest.id));
      let commands = s.commands;
      if (!enabled) {
        commands = commands.filter((c) => c.pluginId !== pluginId);
      }
      return { plugins: updated, activePluginIds: activeIds, commands };
    });
  },

  updatePluginConfig: (pluginId, config) => {
    set((s) => ({
      plugins: s.plugins.map((p) =>
        p.manifest.id === pluginId ? { ...p, config: { ...p.config, ...config } } : p,
      ),
    }));
  },

  setCommands: (commands) => set({ commands }),

  addCommand: (entry) => {
    set((s) => {
      const existing = s.commands.filter((c) => c.command !== entry.command);
      return { commands: [...existing, entry] };
    });
  },

  removeCommandsByPlugin: (pluginId) => {
    set((s) => ({
      commands: s.commands.filter((c) => c.pluginId !== pluginId),
    }));
  },

  setDevMode: (devMode) => {
    try { localStorage.setItem('pufferchat_plugin_devmode', String(devMode)); } catch {}
    set({ devMode });
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  setActiveWidgets: (widgets) => set({ activeWidgets: widgets }),

  addWidget: (widget) => {
    set((s) => ({
      activeWidgets: [...s.activeWidgets.filter((w) => w.widgetId !== widget.widgetId), widget],
    }));
  },

  removeWidget: (widgetId) => {
    set((s) => ({
      activeWidgets: s.activeWidgets.filter((w) => w.widgetId !== widgetId),
    }));
  },
}));
