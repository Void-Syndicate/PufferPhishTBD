# PufferChat — Usage Guide

> *"You've got mail... encrypted."*

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Building from Source](#building-from-source)
3. [First Launch](#first-launch)
4. [Login & Authentication](#login--authentication)
5. [Navigating the Interface](#navigating-the-interface)
6. [Buddy List (Room Sidebar)](#buddy-list-room-sidebar)
7. [Sending Messages](#sending-messages)
8. [Replying to Messages](#replying-to-messages)
9. [Editing Messages](#editing-messages)
10. [Deleting Messages](#deleting-messages)
11. [Reactions](#reactions)
12. [Typing Indicators](#typing-indicators)
13. [Read Receipts](#read-receipts)
14. [Room Information](#room-information)
15. [Signing Out](#signing-out)
16. [Keyboard Shortcuts](#keyboard-shortcuts)
17. [Troubleshooting](#troubleshooting)
18. [Architecture Overview](#architecture-overview)

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Rust** | 1.75+ stable | `rustup install stable` |
| **Node.js** | 20 LTS+ | Required for frontend build |
| **Tauri CLI** | 2.x | `cargo install tauri-cli` |
| **Windows SDK** | 10.0+ | Windows builds only |
| **WebView2** | Evergreen | Ships with Windows 10/11 |

### Platform-Specific Dependencies

**Windows:**
- WebView2 (pre-installed on Windows 10 1803+ / Windows 11)
- Visual Studio Build Tools with C++ workload

**Linux:**
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`

---

## Building from Source

### Development Mode (Hot Reload)

```bash
cd pufferchat
npm install
cargo tauri dev
```

This starts the Vite dev server with HMR for the frontend and compiles the Rust backend. The app window opens automatically.

### Production Build

```bash
cargo tauri build
```

Output locations:
- **Windows:** `src-tauri/target/release/bundle/msi/PufferChat_0.1.0_x64_en-US.msi`
- **Linux:** `src-tauri/target/release/bundle/appimage/PufferChat_0.1.0_amd64.AppImage`
- **macOS:** `src-tauri/target/release/bundle/dmg/PufferChat_0.1.0_x64.dmg`

### Debug Build

```bash
cargo tauri build --debug
```

Produces an unoptimized binary with debug symbols and `RUST_LOG` output enabled.

---

## First Launch

1. Launch PufferChat — the AOL-style sign-on screen appears
2. You'll see the classic connection animation
3. Enter your Matrix homeserver URL and credentials
4. The app syncs with your homeserver and loads your rooms

---

## Login & Authentication

### Homeserver URL

Enter your Matrix homeserver URL in the **Homeserver** field:

| Server | URL |
|--------|-----|
| matrix.org | `https://matrix.org` |
| Self-hosted | `https://matrix.yourdomain.com` |
| Local dev | `http://localhost:8008` |

**Security rules:**
- HTTPS is **required** for all remote servers
- HTTP is only allowed for `localhost`, `127.0.0.1`, and `::1` (development)
- URLs with embedded credentials (`https://user:pass@server`) are rejected
- The URL must have a valid scheme and host

### Credentials

- **Username:** Your Matrix username (e.g., `@user:matrix.org` or just `user`)
- **Password:** Your Matrix password

### Session Persistence

After successful login:
- Your access token is stored in the **OS keychain** (Windows Credential Manager / macOS Keychain / libsecret)
- The token is **never** stored in plaintext files
- The token is **never** sent to the frontend — it stays in the Rust backend
- Your session persists across app restarts

### Security Notes

- Passwords are zeroed from memory immediately after login
- The local SQLite database is encrypted with a random passphrase stored in the OS keychain
- No telemetry, analytics, or crash reporting — ever

---

## Navigating the Interface

PufferChat uses a classic AOL-inspired layout:

```
┌──────────────────────────────────────────────────┐
│  File   Edit   People   Rooms   Help             │  ← Menu Bar
├──────────────────────────────────────────────────┤
│  📨 Read  ✏️ Write  🏠 Rooms  👥 People  ⚙️ Setup │  ← Toolbar
├──────────────┬───────────────────────────────────┤
│              │  Room Name          🔒  👥 12     │  ← Room Header
│  Buddy List  │───────────────────────────────────│
│              │                                   │
│  ● Room 1    │  Messages...                      │  ← Message Timeline
│  ● Room 2    │  Messages...                      │
│  ○ Room 3    │  Messages...                      │
│              │                                   │
│              │───────────────────────────────────│
│              │  [Type a message...]      [Send]  │  ← Composer
├──────────────┴───────────────────────────────────┤
│  Connected ● @user:matrix.org        🔒 E2EE    │  ← Status Bar
└──────────────────────────────────────────────────┘
```

### Menu Bar
- **File** — App-level operations
- **Edit** — Text editing actions
- **People** — Contact management
- **Rooms** — Room browsing and creation
- **Help** — Documentation and about

### Toolbar
- **📨 Read** — View messages
- **✏️ Write** — Compose new message
- **🏠 Rooms** — Browse room directory
- **👥 People** — View contacts
- **⚙️ Setup** — App settings
- **🚪 Sign Off** — Log out

### Status Bar
- Connection status indicator (green dot = connected)
- Current user ID
- E2EE readiness indicator

---

## Buddy List (Room Sidebar)

The left sidebar displays all your joined Matrix rooms, styled as an AOL Buddy List.

### Room Categories
Rooms are organized into collapsible groups:
- **Direct Messages** — 1:1 conversations
- **Group Rooms** — Multi-user rooms

### Room Entry Information
Each room shows:
- **Room name** (or display name for DMs)
- **Unread badge** — Blue circle with unread count
- **Highlight badge** — Red circle for @mentions
- **Encryption icon** — 🔒 for encrypted rooms
- **Presence indicator:**
  - 🟢 Green = Online / Active
  - 🟡 Yellow = Away / Idle
  - ⚪ Gray = Offline

### Selecting a Room
Click any room to open it in the chat area. The selected room is highlighted with the AOL blue accent.

---

## Sending Messages

1. Select a room from the Buddy List
2. Click the message input area at the bottom
3. Type your message
4. Press **Enter** or click the **Send** button

### Message Input
- Supports multiline input (Shift+Enter for new line)
- Maximum message length: 64KB
- Empty messages are rejected

### Message Types
Currently supported:
- **Plain text** — Standard messages
- **Markdown** — Bold, italic, code, links (rendered in timeline)

### Font Toolbar
The AOL-style font toolbar above the composer provides:
- **B** — Bold
- **I** — Italic
- **U** — Underline
- **Font size** selector
- **Color** picker

*(Note: Font toolbar is visual placeholder in Phase 2 — full rich text editing in Phase 4)*

---

## Replying to Messages

1. **Right-click** a message in the timeline
2. Select **Reply** from the context menu
3. A reply preview bar appears above the composer showing the original message
4. Type your reply and send

The reply preview shows:
- Original sender's name
- Truncated original message text
- **✕** button to cancel the reply

Replies are displayed in the timeline with an indented quote of the original message.

---

## Editing Messages

You can edit your own messages:

1. **Right-click** your message
2. Select **Edit** from the context menu
3. The message text loads into the composer
4. Modify the text and send

Edited messages display an **(edited)** badge next to the timestamp.

**Constraints:**
- You can only edit your own messages
- Edit history is not stored locally (server maintains history)
- Empty edits are rejected

---

## Deleting Messages

You can delete (redact) your own messages:

1. **Right-click** your message
2. Select **Delete** from the context menu
3. The message is redacted on the server

Redacted messages are removed from the timeline. Other users see a "[message deleted]" placeholder.

**Note:** Redaction is permanent. The server removes the message content but retains the event shell for protocol integrity.

---

## Reactions

### Adding a Reaction

1. **Right-click** a message
2. Select **React** from the context menu
3. The emoji picker opens with common reactions:
   - 👍 👎 ❤️ 😂 😮 😢 🔥 🎉 ✅ ❌ 👀 🙏
4. Click an emoji to react

### Removing a Reaction

Click your existing reaction on a message to remove it.

### Reaction Display

Reactions appear below the message as emoji badges with count indicators:
```
👍 3  ❤️ 2  🔥 1
```

Your own reactions are highlighted with the AOL blue accent.

---

## Typing Indicators

### Outgoing
PufferChat automatically sends typing notifications when you're composing a message. The indicator is sent with a 4-second debounce to avoid excessive network traffic.

### Incoming
When other users are typing, you'll see a notification below the message list:
```
Alice is typing...
Alice and Bob are typing...
Alice, Bob, and 2 others are typing...
```

---

## Read Receipts

PufferChat automatically sends read receipts when you view messages in a room. The last visible message in the timeline is marked as read.

Read receipts are:
- Sent per-room when the room is open and messages are visible
- Threaded (using the Matrix receipt thread model)
- Not sent for your own messages

---

## Room Information

The **Room Header** at the top of the chat area displays:

| Element | Description |
|---------|-------------|
| **Room Name** | Display name of the current room |
| **Topic** | Room topic (if set), shown below the name |
| **🔒 Encrypted** | Shown if the room has E2EE enabled |
| **👥 Member Count** | Number of joined members |

---

## Signing Out

### From the Toolbar
Click **🚪 Sign Off** in the toolbar.

### What happens on sign-out:
1. Matrix logout API is called (invalidates the access token)
2. Stored session is cleared from the OS keychain
3. The app returns to the login screen

### Session Cleanup
- Access tokens are revoked server-side
- Local keychain entries are deleted
- The SQLite database remains on disk (encrypted) for potential re-login
- To fully purge local data, delete the data directory:
  - **Windows:** `%APPDATA%\pufferchat\`
  - **Linux:** `~/.local/share/pufferchat/`
  - **macOS:** `~/Library/Application Support/pufferchat/`

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift + Enter` | New line in composer |
| `Escape` | Cancel reply / close picker |

*(Additional shortcuts planned for future phases)*

---

## Troubleshooting

### Login Fails

| Error | Cause | Fix |
|-------|-------|-----|
| "Homeserver must use HTTPS" | Non-HTTPS URL for remote server | Use `https://` prefix |
| "Invalid homeserver URL" | Malformed URL | Check URL format |
| "Homeserver URL must not contain credentials" | URL has `user:pass@` | Remove credentials from URL |
| Auth error from server | Wrong username/password | Verify credentials in Element or another client |

### No Rooms Appear

- The sync loop may still be running — wait a few seconds after login
- Check that you've joined rooms on your homeserver
- Verify your account isn't deactivated

### Messages Not Loading

- Check network connectivity
- The room may have no messages yet
- Encrypted rooms require E2EE setup (Phase 3)

### App Crashes on Startup

- **Windows:** Ensure WebView2 is installed
- **Linux:** Ensure `libwebkit2gtk-4.1` is installed
- Delete the local database and try again:
  ```
  # Windows
  rmdir /s "%APPDATA%\pufferchat\matrix-store"
  
  # Linux/macOS
  rm -rf ~/.local/share/pufferchat/matrix-store
  ```

### OS Keychain Errors

- **Windows:** Check Windows Credential Manager has space
- **Linux:** Ensure `gnome-keyring` or `kwallet` is running
- **macOS:** Grant keychain access when prompted

---

## Architecture Overview

### Data Flow

```
User Input → React Component → Tauri IPC (invoke) → Rust Command → matrix-sdk → Homeserver
                                                                         ↓
User Display ← React Store ← Tauri Event (emit) ← Rust Sync Loop ← matrix-sdk
```

### Security Layers

1. **Network:** TLS 1.3 minimum, HTTPS enforced, no plaintext fallback
2. **Authentication:** Tokens in OS keychain only, never in frontend or files
3. **Local Storage:** SQLite encrypted with keychain-stored passphrase
4. **Memory:** Passwords and keys zeroed after use (zeroize crate)
5. **Frontend:** Strict CSP, no eval(), no external resource loading
6. **Input Validation:** All Tauri commands validate inputs before processing

### Tauri IPC Commands (Phase 1-2)

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `matrix_login` | homeserver, username, password | LoginResult | Authenticate with homeserver |
| `matrix_logout` | — | — | Logout and clear session |
| `get_rooms` | — | RoomSummary[] | List all joined rooms |
| `start_sync` | — | — | Start the Matrix sync loop |
| `get_room_messages` | room_id, from?, limit? | PaginationResult | Paginated message history |
| `send_message` | room_id, body | event_id | Send text message |
| `send_reply` | room_id, body, reply_to_event_id | event_id | Reply to a message |
| `edit_message` | room_id, event_id, new_body | event_id | Edit your message |
| `delete_message` | room_id, event_id, reason? | — | Redact a message |
| `send_reaction` | room_id, event_id, emoji | event_id | React with emoji |
| `remove_reaction` | room_id, reaction_event_id | — | Remove your reaction |
| `send_typing` | room_id, typing | — | Toggle typing indicator |
| `mark_read` | room_id, event_id | — | Send read receipt |
| `get_room_members` | room_id | RoomMember[] | List room members |

### Tauri Events (Backend → Frontend)

| Event | Payload | Description |
|-------|---------|-------------|
| `matrix://timeline` | { room_id, message: TimelineMessage } | New message received |
| `matrix://typing` | { room_id, user_ids: string[] } | Typing indicator update |
| `matrix://read-receipt` | { room_id, user_id, event_id } | Read receipt received |
| `matrix://room-update` | { room: RoomSummary } | Room metadata changed |

### Data Structures

**TimelineMessage:**
```typescript
{
  id: string;           // Matrix event ID ($xxx:server)
  sender: string;       // User ID (@user:server)
  body: string;         // Plain text content
  formattedBody?: string; // HTML formatted content
  timestamp: number;    // Unix timestamp (ms)
  isEdited: boolean;    // Whether the message was edited
  replyTo?: string;     // Event ID of parent (if reply)
  reactions: Record<string, string[]>; // emoji → user_ids
  msgType: string;      // "m.text", "m.image", etc.
}
```

**RoomSummary:**
```typescript
{
  roomId: string;
  name?: string;
  topic?: string;
  avatarUrl?: string;
  isDirect: boolean;
  isEncrypted: boolean;
  unreadCount: number;
  highlightCount: number;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  memberCount: number;
}
```

**RoomMember:**
```typescript
{
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  powerLevel: number;
}
```

---

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Foundation & Skeleton | ✅ Complete |
| Phase 2 | Core Messaging | ✅ Complete |
| Phase 3 | Encryption & Security | 🔲 Planned |
| Phase 4 | Media, Files & Rich Content | 🔲 Planned |
| Phase 5 | Spaces, Moderation & Organization | 🔲 Planned |
| Phase 6 | Voice/Video Calling | 🔲 Planned |
| Phase 7 | Plugin System & Widgets | 🔲 Planned |
| Phase 8 | Polish, Privacy & Release | 🔲 Planned |

---

## License

PufferChat is developed by Void Syndicate. All rights reserved.
