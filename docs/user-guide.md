# PufferChat User Guide

> *"You've Got Mail... Encrypted."*

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Messaging](#messaging)
4. [Security & Encryption](#security--encryption)
5. [Voice & Video Calls](#voice--video-calls)
6. [Rooms & Spaces](#rooms--spaces)
7. [Plugins](#plugins)
8. [Privacy Settings](#privacy-settings)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

**Windows:** Run the PufferChat installer (.msi or .exe). Follow the prompts.

**macOS:** Open the .dmg file and drag PufferChat to Applications.

**Linux:** Use the AppImage (chmod +x, then run) or install the .deb package.

### First Login

1. Launch PufferChat — you'll see the AOL-style sign-on screen
2. Enter your Matrix homeserver URL (default: `https://matrix.org`)
3. Enter your username and password
4. Click **Sign On**
5. Wait for the dial-up connection animation (your data is syncing!)
6. You'll see your Buddy List populated with your rooms and contacts

### SSO Login

If your homeserver uses Single Sign-On:
1. Click **Sign In with SSO** on the login screen
2. Your system browser will open to your identity provider
3. Complete authentication in the browser
4. PufferChat will automatically receive your session

---

## Interface Overview

### Buddy List (Left Sidebar)

The Buddy List shows all your conversations, organized into categories:

- **Online** — Contacts currently active
- **Away** — Contacts with away status
- **Offline** — Contacts not currently online
- **Rooms** — Group conversations
- **Spaces** — Matrix Spaces (organizational hierarchies)

Each entry shows:
- Username/room name
- Online/away/offline indicator
- Last message preview
- Unread message count badge
- Encryption lock icon (for E2EE rooms)

### Chat Window (Center)

Click any buddy or room to open the chat view:
- **Header** — Room name, topic, member count, call buttons, widget picker
- **Timeline** — Message history with virtual scrolling for performance
- **Composer** — Message input with formatting toolbar (bold, italic, underline, font size, color)
- **Member List** — Collapsible panel showing room members and their roles

### Menu Bar

- **File** — Settings, Sign Off, Exit
- **Edit** — Preferences, Appearance
- **People** — Member List, Invite to Room
- **Rooms** — Create Room, Join Room, Room Directory
- **Help** — About, Keyboard Shortcuts, User Guide

### Toolbar

Quick-access buttons: Read (unread rooms), Write (compose), Rooms (browser), People (members), Call (voice/video)

---

## Messaging

### Sending Messages
Type in the composer and press **Enter** to send. Use **Shift+Enter** for line breaks.

### Formatting
- **Bold:** `**text**` or Ctrl+B
- **Italic:** `*text*` or Ctrl+I
- **Code:** `` `code` `` for inline, ` ``` ` for code blocks
- **Links:** Automatically detected

### Reactions
Hover over a message and click the emoji icon, or right-click for the reaction picker.

### Replies
Click the reply arrow on any message to create a threaded reply.

### Editing & Deleting
- **Edit:** Press Up arrow to edit your last message, or right-click → Edit
- **Delete:** Right-click → Delete (redact)

### Media
- Drag & drop files into the chat
- Paste images from clipboard (Ctrl+V)
- Click the attachment button for file picker
- Record voice messages with the microphone button

---

## Security & Encryption

### End-to-End Encryption (E2EE)
PufferChat uses the Matrix Megolm protocol (via Vodozemac) for E2EE. All new DMs are encrypted by default.

### Device Verification
1. Click a user's name → **Verify**
2. Choose emoji comparison or QR code scanning
3. Both sides confirm matching emojis
4. Verified devices show a green shield ✅

### Key Backup
1. Go to **Settings → Security → Key Backup**
2. Create a recovery key or passphrase
3. Your keys are encrypted and stored on the homeserver
4. Restore keys on new devices using your recovery key

### Cross-Signing
After verifying your own devices, you can cross-sign to trust all your devices automatically.

### Auto-Lock
Configure automatic screen lock under **Settings → Security → Auto-Lock**. PufferChat will require your passphrase after the idle timeout.

---

## Voice & Video Calls

### 1:1 Calls
1. Open a DM with the person you want to call
2. Click the **📞 Voice** or **📹 Video** button in the room header
3. Wait for them to answer — you'll hear the AOL ringing sound!
4. Use in-call controls: Mute, Hold, Speaker, Camera toggle

### Group Calls
1. In a group room, click the **Call** button
2. Choose **Start Group Call**
3. Participants can join from the room header
4. Switch between Grid View and Speaker View

### Screen Sharing
During any call, click the **🖥️ Share Screen** button. Select the window or screen to share. Click again to stop sharing.

### Push-to-Talk
Enable in **Settings → Calls → Push-to-Talk**. Hold Spacebar (configurable) to transmit audio.

### Device Selection
Change microphone, camera, or speakers in **Settings → Calls → Devices** or from the in-call device menu.

---

## Rooms & Spaces

### Creating a Room
1. **Rooms → Create Room** or Ctrl+N
2. Enter room name, topic, and configure settings
3. Choose encryption (recommended), visibility, and permissions
4. Invite initial members

### Joining a Room
1. **Rooms → Join Room** and enter the room address (e.g., `#room:matrix.org`)
2. Or browse the **Room Directory** for public rooms

### Room Settings
Click the room name header → **Settings** to manage:
- Topic and avatar
- Permissions and power levels
- Encryption settings
- Notification preferences
- Moderation tools (kick, ban, mute)

### Spaces
Spaces are hierarchical groups of rooms. Create a Space from the sidebar, then add rooms to organize your communities.

---

## Plugins

### Installing Plugins
1. Go to **Settings → Plugins**
2. Browse available plugins or install from file
3. Review requested permissions
4. Click **Install**

### Built-in Plugins

**Dice Roller** — Type `/roll 2d6` to roll dice. Supports d4, d6, d8, d10, d12, d20, d100.

**Polls** — Create polls with `/poll "Question" "Option 1" "Option 2"`. Members vote inline.

**Code Paste** — Share syntax-highlighted code with `/paste`. Opens a code editor with language detection.

### Developing Plugins
See `docs/plugin-development.md` for the full SDK reference.

---

## Privacy Settings

### Proxy (Tor/SOCKS5)
Route all traffic through a proxy: **Settings → Privacy → Proxy**
- Supports SOCKS5 (Tor-compatible) and HTTP proxies
- Test connection before applying

### DNS-over-HTTPS
Encrypt DNS queries: **Settings → Privacy → DNS**
- Providers: Cloudflare (1.1.1.1), Google, or custom DoH URL
- Prevents ISP from seeing which homeservers you connect to

### Certificate Pinning
Pin homeserver certificates: **Settings → Privacy → Certificates**
- TOFU (Trust On First Use) mode: auto-pin on first connection
- Manual pinning: fetch and verify certificate fingerprints
- Alerts if a pinned certificate changes unexpectedly

### What PufferChat NEVER Does
- ❌ No telemetry or analytics
- ❌ No crash reporting without opt-in
- ❌ No CDN or third-party asset loading
- ❌ No tracking pixels or fingerprinting
- ❌ No plaintext connections — ever

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Search rooms & messages |
| `Ctrl+N` | Create new room |
| `Ctrl+,` | Open settings |
| `Ctrl+T` | Focus message composer |
| `Ctrl+/` | Show keyboard shortcuts |
| `Alt+↑` | Previous room |
| `Alt+↓` | Next room |
| `Ctrl+Shift+M` | Toggle mute (in call) |
| `Ctrl+Shift+E` | Toggle video (in call) |
| `Escape` | Close panel / dialog |
| `Enter` | Send message |
| `Shift+Enter` | New line in composer |
| `↑` (empty composer) | Edit last message |

---

## Troubleshooting

### Can't connect to homeserver
- Check the homeserver URL (include `https://`)
- Try disabling proxy if configured
- Check your internet connection
- Verify the homeserver is online

### Messages not decrypting
- Verify your device with another session
- Restore key backup: Settings → Security → Key Backup → Restore
- Request keys from other devices in the room

### Call quality issues
- Check your internet speed (recommended: 1 Mbps up for video)
- Try disabling video for audio-only
- Check if your firewall allows WebRTC (UDP ports)
- Switch to a different TURN server if available

### App crashes on startup
- Run **Data & Recovery → Integrity Check** from settings
- Use **Repair Database** if corruption is detected
- Export settings before reinstalling if needed

### High memory usage
- Clear media cache: Settings → Storage → Clear Cache
- Reduce loaded rooms (close unused rooms)
- Restart PufferChat to free memory

---

*PufferChat v1.0.0 — You've Got Encrypted Mail!*
