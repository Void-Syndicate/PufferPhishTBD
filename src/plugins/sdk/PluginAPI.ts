// PluginAPI — The API surface exposed to plugins running inside iframes
//
// Plugins include this file (or the built version) and call PufferChatPlugin.init()
// to bootstrap communication with the host via postMessage.

import type {
  BridgeEnvelope,
  HostToPluginMessage,
  PluginToHostMessage,
  PluginInitPayload,
  MatrixMessagePayload,
  PluginPermission,
  RoomInfo,
  UserInfo,
} from './types';

type MessageHandler = (msg: MatrixMessagePayload) => void;
type CommandHandler = (args: string, roomId: string, sender: string) => void;
type RoomChangedHandler = (roomId: string, roomName: string | null) => void;
type ReadyHandler = (init: PluginInitPayload) => void;

let _pluginId = '';
let _initPayload: PluginInitPayload | null = null;
let _messageHandlers: MessageHandler[] = [];
let _commandHandlers: Map<string, CommandHandler> = new Map();
let _roomChangedHandlers: RoomChangedHandler[] = [];
let _readyHandlers: ReadyHandler[] = [];
let _pendingRequests: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map();
let _requestCounter = 0;
let _isReady = false;

function generateRequestId(): string {
  return `req_${++_requestCounter}_${Date.now()}`;
}

function sendToHost(message: PluginToHostMessage): void {
  const envelope: BridgeEnvelope = {
    source: 'pufferchat-plugin',
    pluginId: _pluginId,
    message,
  };
  window.parent.postMessage(envelope, '*');
}

function handleHostMessage(msg: HostToPluginMessage): void {
  switch (msg.type) {
    case 'init':
      _initPayload = msg.payload;
      _pluginId = msg.payload.pluginId;
      _isReady = true;
      _readyHandlers.forEach((h) => h(msg.payload));
      break;

    case 'message':
      _messageHandlers.forEach((h) => h(msg.payload));
      break;

    case 'room-changed':
      _roomChangedHandlers.forEach((h) => h(msg.payload.roomId, msg.payload.roomName));
      break;

    case 'command-invoked':
      {
        const handler = _commandHandlers.get(msg.payload.command);
        if (handler) {
          handler(msg.payload.args, msg.payload.roomId, msg.payload.sender);
        }
      }
      break;

    case 'storage-response':
      {
        const pending = _pendingRequests.get(msg.payload.requestId);
        if (pending) {
          _pendingRequests.delete(msg.payload.requestId);
          if (msg.payload.success) {
            pending.resolve(msg.payload.value);
          } else {
            pending.reject(new Error(msg.payload.error || 'Storage operation failed'));
          }
        }
      }
      break;

    case 'config-update':
      if (_initPayload) {
        _initPayload.config = msg.payload;
      }
      break;

    case 'hot-reload':
      window.location.reload();
      break;
  }
}

// Listen for messages from the host
window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as BridgeEnvelope;
  if (!data || data.source !== 'pufferchat-host') return;
  handleHostMessage(data.message as HostToPluginMessage);
});

/**
 * PufferChat Plugin API
 *
 * This is the main API object plugins use to interact with PufferChat.
 * Import and use: `PufferChatPlugin.onReady((init) => { ... })`
 */
export const PufferChatPlugin = {
  /** Register a callback for when the plugin is initialized */
  onReady(handler: ReadyHandler): void {
    _readyHandlers.push(handler);
    if (_isReady && _initPayload) {
      handler(_initPayload);
    }
  },

  /** Send a text message to a room */
  sendMessage(roomId: string, body: string): void {
    sendToHost({ type: 'send-message', payload: { roomId, body } });
  },

  /** Listen for incoming messages */
  onMessage(handler: MessageHandler): void {
    _messageHandlers.push(handler);
  },

  /** Register a slash command */
  registerCommand(command: string, description: string, usage: string, handler: CommandHandler): void {
    _commandHandlers.set(command, handler);
    sendToHost({
      type: 'register-command',
      payload: { command, description, usage },
    });
  },

  /** Listen for room changes */
  onRoomChanged(handler: RoomChangedHandler): void {
    _roomChangedHandlers.push(handler);
  },

  /** Get room information */
  async getRoom(roomId: string): Promise<RoomInfo> {
    const requestId = generateRequestId();
    return new Promise((resolve, reject) => {
      _pendingRequests.set(requestId, { resolve: resolve as (v: unknown) => void, reject });
      sendToHost({ type: 'get-room', payload: { roomId, requestId } });
      setTimeout(() => {
        if (_pendingRequests.has(requestId)) {
          _pendingRequests.delete(requestId);
          reject(new Error('Request timed out'));
        }
      }, 10000);
    });
  },

  /** Get current user information */
  async getCurrentUser(): Promise<UserInfo> {
    const requestId = generateRequestId();
    return new Promise((resolve, reject) => {
      _pendingRequests.set(requestId, { resolve: resolve as (v: unknown) => void, reject });
      sendToHost({ type: 'get-current-user', payload: { requestId } });
      setTimeout(() => {
        if (_pendingRequests.has(requestId)) {
          _pendingRequests.delete(requestId);
          reject(new Error('Request timed out'));
        }
      }, 10000);
    });
  },

  /** Show an OS notification */
  showNotification(title: string, body: string, icon?: string): void {
    sendToHost({ type: 'show-notification', payload: { title, body, icon } });
  },

  /** Plugin storage API */
  storage: {
    async get(key: string): Promise<string | undefined> {
      const requestId = generateRequestId();
      return new Promise((resolve, reject) => {
        _pendingRequests.set(requestId, { resolve: resolve as (v: unknown) => void, reject });
        sendToHost({ type: 'storage-get', payload: { key, requestId } });
        setTimeout(() => {
          if (_pendingRequests.has(requestId)) {
            _pendingRequests.delete(requestId);
            reject(new Error('Storage get timed out'));
          }
        }, 5000);
      });
    },

    async set(key: string, value: string): Promise<void> {
      const requestId = generateRequestId();
      return new Promise((resolve, reject) => {
        _pendingRequests.set(requestId, {
          resolve: () => resolve(),
          reject,
        });
        sendToHost({ type: 'storage-set', payload: { key, value, requestId } });
        setTimeout(() => {
          if (_pendingRequests.has(requestId)) {
            _pendingRequests.delete(requestId);
            reject(new Error('Storage set timed out'));
          }
        }, 5000);
      });
    },

    async delete(key: string): Promise<void> {
      const requestId = generateRequestId();
      return new Promise((resolve, reject) => {
        _pendingRequests.set(requestId, {
          resolve: () => resolve(),
          reject,
        });
        sendToHost({ type: 'storage-delete', payload: { key, requestId } });
        setTimeout(() => {
          if (_pendingRequests.has(requestId)) {
            _pendingRequests.delete(requestId);
            reject(new Error('Storage delete timed out'));
          }
        }, 5000);
      });
    },
  },

  /** Register a UI panel */
  registerPanel(panelId: string, title: string, position: 'sidebar' | 'bottom' | 'overlay', icon?: string): void {
    sendToHost({ type: 'register-panel', payload: { panelId, title, icon, position } });
  },

  /** Register a toolbar button */
  registerToolbarButton(buttonId: string, label: string, tooltip?: string, icon?: string): void {
    sendToHost({ type: 'register-toolbar-button', payload: { buttonId, label, icon, tooltip } });
  },

  /** Log a message (forwarded to host console) */
  log(level: 'info' | 'warn' | 'error', message: string): void {
    sendToHost({ type: 'log', payload: { level, message } });
  },

  /** Notify host of desired iframe size */
  resize(width: number, height: number): void {
    sendToHost({ type: 'resize', payload: { width, height } });
  },

  /** Get the initialization payload (null until onReady fires) */
  getInit(): PluginInitPayload | null {
    return _initPayload;
  },

  /** Check if a permission was granted */
  hasPermission(perm: PluginPermission): boolean {
    return _initPayload?.permissions.includes(perm) ?? false;
  },

  /** Get plugin config */
  getConfig(): Record<string, unknown> {
    return _initPayload?.config ?? {};
  },

  /** Signal to the host that this plugin is ready to receive events */
  signalReady(): void {
    sendToHost({ type: 'ready', payload: {} });
  },
};

// Auto-signal ready when the script loads
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    PufferChatPlugin.signalReady();
  });
  // Also signal if DOM is already loaded
  if (document.readyState !== 'loading') {
    PufferChatPlugin.signalReady();
  }
}

export default PufferChatPlugin;
