// PluginBridge — postMessage-based communication bridge between host and plugin iframes
//
// The host creates one PluginBridge per loaded plugin.  All Matrix SDK access is
// mediated here — plugins NEVER get direct SDK access.

import { invoke } from '@tauri-apps/api/core';
import type {
  BridgeEnvelope,
  PluginToHostMessage,
  HostToPluginMessage,
  MatrixMessagePayload,
  StorageResponsePayload,
} from './sdk/types';
import { PluginContext } from './sdk/PluginContext';

export class PluginBridge {
  private iframe: HTMLIFrameElement | null = null;
  private context: PluginContext;
  private onCommandRegistered?: (pluginId: string, cmd: string, desc: string, usage: string) => void;
  private onPanelRegistered?: (pluginId: string, panelId: string, title: string, position: string) => void;
  private onToolbarButtonRegistered?: (pluginId: string, buttonId: string, label: string) => void;
  private _messageListener: ((event: MessageEvent) => void) | null = null;

  constructor(
    context: PluginContext,
    callbacks?: {
      onCommandRegistered?: (pluginId: string, cmd: string, desc: string, usage: string) => void;
      onPanelRegistered?: (pluginId: string, panelId: string, title: string, position: string) => void;
      onToolbarButtonRegistered?: (pluginId: string, buttonId: string, label: string) => void;
    },
  ) {
    this.context = context;
    this.onCommandRegistered = callbacks?.onCommandRegistered;
    this.onPanelRegistered = callbacks?.onPanelRegistered;
    this.onToolbarButtonRegistered = callbacks?.onToolbarButtonRegistered;
  }

  /** Attach to an iframe element */
  attach(iframe: HTMLIFrameElement): void {
    this.iframe = iframe;
    this._messageListener = this.handleMessage.bind(this);
    window.addEventListener('message', this._messageListener);
  }

  /** Detach from iframe and clean up */
  detach(): void {
    if (this._messageListener) {
      window.removeEventListener('message', this._messageListener);
      this._messageListener = null;
    }
    this.iframe = null;
  }

  /** Send a message to the plugin iframe */
  sendToPlugin(message: HostToPluginMessage): void {
    if (!this.iframe?.contentWindow) return;
    const envelope: BridgeEnvelope = {
      source: 'pufferchat-host',
      pluginId: this.context.pluginId,
      message,
    };
    this.iframe.contentWindow.postMessage(envelope, '*');
  }

  /** Send init payload to plugin */
  sendInit(
    roomId: string | null,
    roomName: string | null,
    userId: string,
    displayName: string | null,
    devMode: boolean,
  ): void {
    const payload = this.context.buildInitPayload(roomId, roomName, userId, displayName, devMode);
    this.sendToPlugin({ type: 'init', payload });
  }

  /** Forward a Matrix message to the plugin */
  sendMessage(msg: MatrixMessagePayload): void {
    if (!this.context.hasPermission('read-messages')) return;
    this.sendToPlugin({ type: 'message', payload: msg });
  }

  /** Notify plugin of room change */
  sendRoomChanged(roomId: string, roomName: string | null): void {
    this.sendToPlugin({ type: 'room-changed', payload: { roomId, roomName } });
  }

  /** Invoke a registered command in the plugin */
  invokeCommand(command: string, args: string, roomId: string, sender: string): void {
    this.sendToPlugin({
      type: 'command-invoked',
      payload: { command, args, roomId, sender },
    });
  }

  /** Send config update to plugin */
  sendConfigUpdate(config: Record<string, unknown>): void {
    this.sendToPlugin({ type: 'config-update', payload: config });
  }

  /** Trigger hot reload in plugin */
  triggerHotReload(): void {
    this.sendToPlugin({ type: 'hot-reload', payload: {} });
  }

  /** Handle incoming messages from the plugin iframe */
  private handleMessage(event: MessageEvent): void {
    const data = event.data as BridgeEnvelope;
    if (!data || data.source !== 'pufferchat-plugin') return;
    if (data.pluginId !== this.context.pluginId) return;
    // Verify the message came from our iframe
    if (this.iframe && event.source !== this.iframe.contentWindow) return;

    const msg = data.message as PluginToHostMessage;
    this.processPluginMessage(msg);
  }

  private async processPluginMessage(msg: PluginToHostMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        // Plugin signaled it is ready — we can now send init
        break;

      case 'send-message':
        if (!this.context.hasPermission('send-messages')) {
          console.warn(`Plugin ${this.context.pluginId} tried to send message without permission`);
          return;
        }
        try {
          await invoke('send_message', {
            roomId: msg.payload.roomId,
            body: msg.payload.body,
          });
        } catch (e) {
          console.error(`Plugin ${this.context.pluginId} send_message failed:`, e);
        }
        break;

      case 'register-command':
        if (!this.context.hasPermission('register-commands')) return;
        this.context.registerCommand(
          msg.payload.command,
          msg.payload.description,
          msg.payload.usage,
        );
        this.onCommandRegistered?.(
          this.context.pluginId,
          msg.payload.command,
          msg.payload.description,
          msg.payload.usage,
        );
        break;

      case 'show-notification':
        if (!this.context.hasPermission('notifications')) return;
        try {
          // Use Tauri notification plugin
          const { sendNotification } = await import('@tauri-apps/plugin-notification');
          sendNotification({
            title: msg.payload.title,
            body: msg.payload.body,
          });
        } catch (e) {
          console.error('Notification failed:', e);
        }
        break;

      case 'storage-get':
        if (!this.context.hasPermission('storage')) {
          this.sendStorageResponse(msg.payload.requestId, false, undefined, 'No storage permission');
          return;
        }
        try {
          const val = await this.loadPluginStorageValue(msg.payload.key);
          this.sendStorageResponse(msg.payload.requestId, true, val);
        } catch (e) {
          this.sendStorageResponse(msg.payload.requestId, false, undefined, String(e));
        }
        break;

      case 'storage-set':
        if (!this.context.hasPermission('storage')) {
          this.sendStorageResponse(msg.payload.requestId, false, undefined, 'No storage permission');
          return;
        }
        try {
          await this.savePluginStorageValue(msg.payload.key, msg.payload.value);
          this.sendStorageResponse(msg.payload.requestId, true);
        } catch (e) {
          this.sendStorageResponse(msg.payload.requestId, false, undefined, String(e));
        }
        break;

      case 'storage-delete':
        if (!this.context.hasPermission('storage')) {
          this.sendStorageResponse(msg.payload.requestId, false, undefined, 'No storage permission');
          return;
        }
        try {
          await this.deletePluginStorageValue(msg.payload.key);
          this.sendStorageResponse(msg.payload.requestId, true);
        } catch (e) {
          this.sendStorageResponse(msg.payload.requestId, false, undefined, String(e));
        }
        break;

      case 'get-room':
        if (!this.context.hasPermission('room-info')) {
          this.sendStorageResponse(msg.payload.requestId, false, undefined, 'No room-info permission');
          return;
        }
        try {
          const roomInfo = await invoke('get_room_info', { roomId: msg.payload.roomId });
          this.sendStorageResponse(msg.payload.requestId, true, JSON.stringify(roomInfo));
        } catch (e) {
          this.sendStorageResponse(msg.payload.requestId, false, undefined, String(e));
        }
        break;

      case 'get-current-user':
        if (!this.context.hasPermission('user-info')) {
          this.sendStorageResponse(msg.payload.requestId, false, undefined, 'No user-info permission');
          return;
        }
        {
          // We pull from the auth store on the host side
          const userInfo = { userId: '', displayName: null, avatarUrl: null };
          this.sendStorageResponse(msg.payload.requestId, true, JSON.stringify(userInfo));
        }
        break;

      case 'register-panel':
        if (!this.context.hasPermission('ui-panels')) return;
        this.onPanelRegistered?.(
          this.context.pluginId,
          msg.payload.panelId,
          msg.payload.title,
          msg.payload.position,
        );
        break;

      case 'register-toolbar-button':
        if (!this.context.hasPermission('ui-toolbar')) return;
        this.onToolbarButtonRegistered?.(
          this.context.pluginId,
          msg.payload.buttonId,
          msg.payload.label,
        );
        break;

      case 'resize':
        // Let the PluginHost component handle iframe resizing
        break;

      case 'log':
        {
          const prefix = `[Plugin:${this.context.pluginId}]`;
          switch (msg.payload.level) {
            case 'warn': console.warn(prefix, msg.payload.message); break;
            case 'error': console.error(prefix, msg.payload.message); break;
            default: console.log(prefix, msg.payload.message); break;
          }
        }
        break;
    }
  }

  private sendStorageResponse(requestId: string, success: boolean, value?: string, error?: string): void {
    const payload: StorageResponsePayload = { requestId, success, value, error };
    this.sendToPlugin({ type: 'storage-response' as const, payload });
  }

  private async loadPluginStorageValue(key: string): Promise<string | undefined> {
    try {
      const result = await invoke<string | null>('get_plugin_config', {
        pluginId: this.context.pluginId,
        key: `storage.${key}`,
      });
      return result ?? undefined;
    } catch {
      return this.context.storageGet(key);
    }
  }

  private async savePluginStorageValue(key: string, value: string): Promise<void> {
    this.context.storageSet(key, value);
    try {
      await invoke('set_plugin_config', {
        pluginId: this.context.pluginId,
        key: `storage.${key}`,
        value,
      });
    } catch {
      // Fall back to in-memory storage
    }
  }

  private async deletePluginStorageValue(key: string): Promise<void> {
    this.context.storageDelete(key);
    try {
      await invoke('set_plugin_config', {
        pluginId: this.context.pluginId,
        key: `storage.${key}`,
        value: '',
      });
    } catch {
      // Fall back to in-memory storage
    }
  }
}
