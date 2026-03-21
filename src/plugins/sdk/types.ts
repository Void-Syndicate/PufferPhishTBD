// Plugin Communication Types — Shared between host and plugin iframes

/** Message types sent FROM the host TO the plugin */
export type HostToPluginMessage =
  | { type: 'init'; payload: PluginInitPayload }
  | { type: 'message'; payload: MatrixMessagePayload }
  | { type: 'room-changed'; payload: { roomId: string; roomName: string | null } }
  | { type: 'command-invoked'; payload: CommandInvokedPayload }
  | { type: 'storage-response'; payload: StorageResponsePayload }
  | { type: 'config-update'; payload: Record<string, unknown> }
  | { type: 'hot-reload'; payload: Record<string, never> };

/** Message types sent FROM the plugin TO the host */
export type PluginToHostMessage =
  | { type: 'ready'; payload: Record<string, never> }
  | { type: 'send-message'; payload: { roomId: string; body: string } }
  | { type: 'register-command'; payload: RegisterCommandPayload }
  | { type: 'show-notification'; payload: ShowNotificationPayload }
  | { type: 'storage-get'; payload: { key: string; requestId: string } }
  | { type: 'storage-set'; payload: { key: string; value: string; requestId: string } }
  | { type: 'storage-delete'; payload: { key: string; requestId: string } }
  | { type: 'register-panel'; payload: RegisterPanelPayload }
  | { type: 'register-toolbar-button'; payload: RegisterToolbarButtonPayload }
  | { type: 'get-room'; payload: { roomId: string; requestId: string } }
  | { type: 'get-current-user'; payload: { requestId: string } }
  | { type: 'resize'; payload: { width: number; height: number } }
  | { type: 'log'; payload: { level: string; message: string } };

export interface PluginInitPayload {
  pluginId: string;
  roomId: string | null;
  roomName: string | null;
  userId: string;
  displayName: string | null;
  permissions: PluginPermission[];
  config: Record<string, unknown>;
  devMode: boolean;
}

export interface MatrixMessagePayload {
  eventId: string;
  roomId: string;
  sender: string;
  senderName: string | null;
  body: string;
  timestamp: number;
  msgType: string;
}

export interface CommandInvokedPayload {
  command: string;
  args: string;
  roomId: string;
  sender: string;
}

export interface StorageResponsePayload {
  requestId: string;
  success: boolean;
  value?: string;
  error?: string;
}

export interface RegisterCommandPayload {
  command: string;
  description: string;
  usage: string;
}

export interface ShowNotificationPayload {
  title: string;
  body: string;
  icon?: string;
}

export interface RegisterPanelPayload {
  panelId: string;
  title: string;
  icon?: string;
  position: 'sidebar' | 'bottom' | 'overlay';
}

export interface RegisterToolbarButtonPayload {
  buttonId: string;
  label: string;
  icon?: string;
  tooltip?: string;
}

export interface RoomInfo {
  roomId: string;
  name: string | null;
  topic: string | null;
  memberCount: number;
  isEncrypted: boolean;
}

export interface UserInfo {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Permissions a plugin can request */
export type PluginPermission =
  | 'send-messages'
  | 'read-messages'
  | 'register-commands'
  | 'notifications'
  | 'storage'
  | 'room-info'
  | 'user-info'
  | 'ui-panels'
  | 'ui-toolbar';

/** Bridge envelope wrapping all messages */
export interface BridgeEnvelope {
  source: 'pufferchat-host' | 'pufferchat-plugin';
  pluginId: string;
  message: HostToPluginMessage | PluginToHostMessage;
}
