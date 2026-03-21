// PluginHost — React component that mounts plugin iframes with strict CSP sandboxing

import { useEffect, useRef, useState } from 'react';
import { PluginBridge } from './PluginBridge';
import { PluginContext } from './sdk/PluginContext';
import type { PluginManifest } from './sdk/PluginManifest';
import type { MatrixMessagePayload } from './sdk/types';
import { useAuthStore } from '../stores/auth';

interface PluginHostProps {
  manifest: PluginManifest;
  pluginPath: string;
  enabled: boolean;
  approvedPermissions: string[];
  config: Record<string, unknown>;
  roomId: string | null;
  roomName: string | null;
  devMode?: boolean;
  visible?: boolean;
  onCommandRegistered?: (pluginId: string, cmd: string, desc: string, usage: string) => void;
  onPanelRegistered?: (pluginId: string, panelId: string, title: string, position: string) => void;
  onToolbarButtonRegistered?: (pluginId: string, buttonId: string, label: string) => void;
  style?: React.CSSProperties;
}

export default function PluginHost({
  manifest,
  pluginPath,
  enabled,
  approvedPermissions,
  config,
  roomId,
  roomName,
  devMode = false,
  visible = true,
  onCommandRegistered,
  onPanelRegistered,
  onToolbarButtonRegistered,
  style,
}: PluginHostProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<PluginBridge | null>(null);
  const [loaded, setLoaded] = useState(false);
  const userId = useAuthStore((s) => s.userId);
  const displayName = useAuthStore((s) => s.displayName);

  // Create context and bridge
  useEffect(() => {
    if (!enabled) return;

    const context = new PluginContext(
      manifest,
      approvedPermissions as any[],
      config,
      enabled,
    );

    const bridge = new PluginBridge(context, {
      onCommandRegistered,
      onPanelRegistered,
      onToolbarButtonRegistered,
    });

    bridgeRef.current = bridge;

    return () => {
      bridge.detach();
      bridgeRef.current = null;
    };
  }, [manifest.id, enabled]);

  // Attach bridge to iframe when loaded
  useEffect(() => {
    if (!loaded || !iframeRef.current || !bridgeRef.current) return;
    bridgeRef.current.attach(iframeRef.current);
    // Send init after a small delay to let the plugin's JS load
    setTimeout(() => {
      bridgeRef.current?.sendInit(
        roomId,
        roomName,
        userId || '',
        displayName || null,
        devMode,
      );
    }, 100);
  }, [loaded, roomId, userId]);

  // Notify plugin of room changes
  useEffect(() => {
    if (bridgeRef.current && loaded && roomId) {
      bridgeRef.current.sendRoomChanged(roomId, roomName);
    }
  }, [roomId, roomName, loaded]);

  if (!enabled) return null;

  // Build the iframe src URL — plugins are served from their local directory
  // In Tauri, we use a custom protocol or file:// URLs
  const entryUrl = `${pluginPath}/${manifest.entry}`;

  return (
    <div
      style={{
        display: visible ? 'block' : 'none',
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      <iframe
        ref={iframeRef}
        src={entryUrl}
        sandbox="allow-scripts allow-forms"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'white',
        }}
        onLoad={() => setLoaded(true)}
        title={`Plugin: ${manifest.name}`}
      />
    </div>
  );
}

/**
 * Hook to expose plugin bridge for sending messages to plugins.
 * Use this in components that need to forward Matrix events to loaded plugins.
 */
export function usePluginBridges(): {
  sendMessageToAll: (msg: MatrixMessagePayload) => void;
  invokeCommand: (pluginId: string, command: string, args: string, roomId: string, sender: string) => void;
} {
  // This is a simplified version — the PluginManager manages the actual bridges
  return {
    sendMessageToAll: (_msg) => {
      // Handled by PluginManager
    },
    invokeCommand: (_pluginId, _command, _args, _roomId, _sender) => {
      // Handled by PluginManager
    },
  };
}
