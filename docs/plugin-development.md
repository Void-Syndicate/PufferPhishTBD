# PufferChat Plugin Development Guide

## Overview

PufferChat supports a plugin system that lets developers extend the client's functionality. Plugins run in sandboxed iframes and communicate with the host application through a secure postMessage bridge. Plugins **cannot** access the Matrix SDK directly — all interactions go through the Plugin API.

## Quick Start

### 1. Create Plugin Directory

```
my-plugin/
  manifest.json    # Plugin metadata and permissions
  index.html       # Entry point (loaded in iframe)
  main.js          # Plugin logic
  styles.css       # Optional styles
```

### 2. Write manifest.json

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A sample PufferChat plugin",
  "author": "Your Name",
  "entry": "index.html",
  "permissions": [
    "send-messages",
    "read-messages",
    "register-commands",
    "storage"
  ],
  "commands": [
    {
      "command": "mycommand",
      "description": "Does something cool",
      "usage": "/mycommand <args>"
    }
  ],
  "defaultConfig": {
    "greeting": "Hello!"
  },
  "tags": ["utility"]
}
```

### 3. Write index.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My Plugin</title>
  <style>
    body {
      font-family: 'MS Sans Serif', sans-serif;
      font-size: 11px;
      background: #C0C0C0;
      padding: 4px;
    }
  </style>
</head>
<body>
  <div id="app">Loading...</div>
  <script src="main.js"></script>
</body>
</html>
```

### 4. Write main.js

```javascript
(function() {
  var pluginId = '';
  var currentRoomId = '';

  // Listen for messages from PufferChat
  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || data.source !== 'pufferchat-host') return;

    var msg = data.message;
    switch (msg.type) {
      case 'init':
        pluginId = msg.payload.pluginId;
        currentRoomId = msg.payload.roomId || '';
        onInit(msg.payload);
        break;
      case 'command-invoked':
        onCommand(msg.payload.command, msg.payload.args, msg.payload.roomId);
        break;
      case 'message':
        onMessage(msg.payload);
        break;
      case 'room-changed':
        currentRoomId = msg.payload.roomId;
        break;
    }
  });

  function sendToHost(message) {
    window.parent.postMessage({
      source: 'pufferchat-plugin',
      pluginId: pluginId,
      message: message,
    }, '*');
  }

  function onInit(payload) {
    document.getElementById('app').textContent = 'Plugin loaded! Room: ' + (payload.roomId || 'none');
    // Register your commands
    sendToHost({
      type: 'register-command',
      payload: {
        command: 'mycommand',
        description: 'Does something cool',
        usage: '/mycommand <args>',
      },
    });
  }

  function onCommand(command, args, roomId) {
    if (command === 'mycommand') {
      sendToHost({
        type: 'send-message',
        payload: {
          roomId: roomId || currentRoomId,
          body: 'Hello from my plugin! You said: ' + args,
        },
      });
    }
  }

  function onMessage(msg) {
    console.log('Received message:', msg.body, 'from', msg.sender);
  }

  // Signal ready
  sendToHost({ type: 'ready', payload: {} });
})();
```

### 5. Install Plugin

1. Open PufferChat Settings > Plugin Manager
2. Enter the path to your plugin directory
3. Click "Install"
4. Approve requested permissions

## Manifest Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique plugin identifier (reverse-domain recommended) |
| `name` | string | Yes | Human-readable name |
| `version` | string | Yes | Semver version (e.g., "1.0.0") |
| `description` | string | Yes | Short description |
| `author` | string | Yes | Author name |
| `homepage` | string | No | URL to homepage/repo |
| `minAppVersion` | string | No | Minimum PufferChat version |
| `entry` | string | Yes | HTML entry file (relative path) |
| `icon` | string | No | Icon file path (16x16 or 32x32 PNG) |
| `permissions` | string[] | Yes | Required permissions |
| `commands` | object[] | No | Slash commands to register |
| `defaultConfig` | object | No | Default configuration values |
| `tags` | string[] | No | Categorization tags |

## Permissions

| Permission | Description |
|-----------|-------------|
| `send-messages` | Send messages to rooms |
| `read-messages` | Receive incoming messages |
| `register-commands` | Register slash commands |
| `notifications` | Show OS notifications |
| `storage` | Read/write plugin storage |
| `room-info` | Get room metadata |
| `user-info` | Get current user info |
| `ui-panels` | Register UI panels |
| `ui-toolbar` | Register toolbar buttons |

## API Reference

### Host → Plugin Messages

| Type | Payload | Description |
|------|---------|-------------|
| `init` | `PluginInitPayload` | Plugin initialization with context |
| `message` | `MatrixMessagePayload` | Incoming Matrix message |
| `room-changed` | `{ roomId, roomName }` | Active room changed |
| `command-invoked` | `{ command, args, roomId, sender }` | Slash command triggered |
| `storage-response` | `{ requestId, success, value?, error? }` | Storage operation result |
| `config-update` | `Record<string, unknown>` | Configuration changed |
| `hot-reload` | `{}` | Reload signal (dev mode) |

### Plugin → Host Messages

| Type | Payload | Permission | Description |
|------|---------|-----------|-------------|
| `ready` | `{}` | — | Signal plugin is loaded |
| `send-message` | `{ roomId, body }` | `send-messages` | Send a chat message |
| `register-command` | `{ command, description, usage }` | `register-commands` | Register slash command |
| `show-notification` | `{ title, body, icon? }` | `notifications` | Show OS notification |
| `storage-get` | `{ key, requestId }` | `storage` | Read from storage |
| `storage-set` | `{ key, value, requestId }` | `storage` | Write to storage |
| `storage-delete` | `{ key, requestId }` | `storage` | Delete from storage |
| `get-room` | `{ roomId, requestId }` | `room-info` | Get room info |
| `get-current-user` | `{ requestId }` | `user-info` | Get user info |
| `register-panel` | `{ panelId, title, position }` | `ui-panels` | Register UI panel |
| `register-toolbar-button` | `{ buttonId, label, tooltip? }` | `ui-toolbar` | Register toolbar button |
| `log` | `{ level, message }` | — | Forward log to host console |
| `resize` | `{ width, height }` | — | Request iframe resize |

### Message Envelope Format

All messages are wrapped in a `BridgeEnvelope`:

```typescript
interface BridgeEnvelope {
  source: 'pufferchat-host' | 'pufferchat-plugin';
  pluginId: string;
  message: HostToPluginMessage | PluginToHostMessage;
}
```

### Storage API

Storage is per-plugin, persisted to disk. Values are strings only.

```javascript
// Get a value
sendToHost({
  type: 'storage-get',
  payload: { key: 'mykey', requestId: 'req_1' }
});

// Set a value
sendToHost({
  type: 'storage-set',
  payload: { key: 'mykey', value: 'myvalue', requestId: 'req_2' }
});

// Delete a value
sendToHost({
  type: 'storage-delete',
  payload: { key: 'mykey', requestId: 'req_3' }
});

// Handle response
case 'storage-response':
  if (msg.payload.requestId === 'req_1') {
    console.log('Got value:', msg.payload.value);
  }
  break;
```

## Sandboxing & Security

- Plugins run in `<iframe sandbox="allow-scripts allow-forms">`
- No direct access to the Matrix SDK, Tauri APIs, or host DOM
- All communication goes through the postMessage bridge
- Permissions are declared in manifest and approved by user on install
- Plugin storage is isolated per-plugin
- Cross-origin requests from plugins are blocked by CSP

## Styling Guidelines (AOL Theme)

For visual consistency, use the AOL retro aesthetic:

```css
/* Colors */
--aol-blue: #004B87;
--aol-blue-dark: #003366;
--win-bg: #C0C0C0;
--white: #FFFFFF;

/* Beveled borders */
.raised {
  border: 2px solid;
  border-color: #FFFFFF #808080 #808080 #FFFFFF;
}

.sunken {
  border: 2px solid;
  border-color: #808080 #FFFFFF #FFFFFF #808080;
}

/* Font */
font-family: 'MS Sans Serif', 'Segoe UI', Tahoma, sans-serif;
font-size: 11px;
```

## Testing Locally

1. Enable **Developer Mode** in Plugin Manager settings
2. Install your plugin from its development directory
3. Changes to plugin files will trigger **hot-reload** automatically
4. Check the browser console for `[Plugin:your-plugin-id]` log messages
5. Use `PufferChatPlugin.log('info', 'debug message')` from your plugin

## Built-in Plugin Examples

See the `plugins/` directory for complete examples:

- **dice-roller** — `/roll` command with dice animation
- **polls** — `/poll` command with voting UI
- **code-paste** — `/paste` command with syntax highlighting

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Plugin not loading | Check manifest.json is valid JSON with all required fields |
| Commands not working | Verify `register-commands` permission is in manifest |
| Storage not persisting | Verify `storage` permission is in manifest |
| Messages not received | Verify `read-messages` permission is in manifest |
| Can't send messages | Verify `send-messages` permission is in manifest |
| Iframe blank | Check entry file path is correct relative to plugin root |
| Hot-reload not working | Enable Developer Mode in Plugin Manager settings |

## TypeScript SDK (Optional)

If you prefer TypeScript, import from `src/plugins/sdk/PluginAPI.ts`:

```typescript
import { PufferChatPlugin } from './PluginAPI';

PufferChatPlugin.onReady((init) => {
  console.log('Plugin loaded!', init.pluginId);
});

PufferChatPlugin.registerCommand('hello', 'Say hello', '/hello', (args, roomId) => {
  PufferChatPlugin.sendMessage(roomId, `Hello, ${args}!`);
});

PufferChatPlugin.onMessage((msg) => {
  console.log('Message:', msg.body);
});
```
