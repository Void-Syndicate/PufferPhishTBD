// Plugin system barrel exports

export { pluginManager } from './PluginManager';
export { PluginBridge } from './PluginBridge';
export { PluginContext } from './sdk/PluginContext';
export { default as PluginHost } from './PluginHost';
export { startPluginDevWatcher, stopPluginDevWatcher, hotReloadPlugin } from './PluginDevWatcher';
export { WidgetApi } from './widgets/WidgetAPI';
export { WidgetContainer, WidgetPicker } from './widgets/WidgetContainer';
export { default as IntegrationManager } from './integrations/IntegrationManager';

// Re-export types
export type { PluginManifest, InstalledPlugin } from './sdk/PluginManifest';
export type {
  PluginPermission,
  BridgeEnvelope,
  HostToPluginMessage,
  PluginToHostMessage,
  MatrixMessagePayload,
  RoomInfo,
  UserInfo,
} from './sdk/types';
