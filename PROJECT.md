# PufferChat — Custom Matrix Communication Client

> *"You've got mail... encrypted."*

## Overview

**PufferChat** is a native desktop Matrix client with a retro AOL Instant Messenger aesthetic. Full Element-level functionality wrapped in nostalgic 90s UI — E2EE by default, zero telemetry, plugin system, voice/video calls, and a Buddy List that'll make you feel like it's 1999.

**Version:** 1.1.0  
**Stack:** Tauri 2.x (Rust) + React 18 + TypeScript + matrix-rust-sdk  
**Platforms:** Windows 10+, macOS 12+, Linux (Ubuntu 22.04+)  
**License:** MIT

---

## Features

### 💬 Communication
- Matrix login (password, SSO/OIDC, multi-account)
- 1:1 DMs and group rooms with full message lifecycle (send, edit, delete, reply, react)
- Rich text (markdown, HTML subset, code blocks)
- Typing indicators, read receipts, unread badges
- Local + server-side message search
- Room notification controls (all / mentions only / mute)

### 📁 Media & Files
- Image, video, audio upload with inline preview
- File attachments with AOL-styled transfer progress UI
- Voice message recording and playback
- GIF picker (Tenor/Giphy), sticker packs (Matrix protocol)
- Link previews with OG metadata
- Per-room media gallery
- Clipboard paste and drag-and-drop upload

### 🔐 Security & Encryption
- End-to-end encryption via Megolm/Vodozemac (enabled by default)
- Cross-signing and device verification (emoji + QR)
- Secure Secret Storage and Sharing (SSSS)
- Key backup and recovery to homeserver
- Session/device management with verification badges
- Room key export/import
- SQLCipher encrypted local database
- Auto-lock with passphrase after idle timeout
- Memory zeroization for crypto material (zeroize crate)

### 🏠 Spaces & Organization
- Full Matrix Spaces with nested hierarchy
- Room creation wizard, settings panel, directory browser
- Power level management and role assignment
- Moderation tools: kick, ban, mute, redact, server ACLs
- Room aliases, canonical addresses, room upgrades
- Invite management (send, accept, reject)

### 📞 Voice & Video
- 1:1 VoIP and video calls via Matrix VoIP (WebRTC)
- Group calls (MatrixRTC / Jitsi bridge)
- Screen sharing
- Push-to-talk, device selection, call quality indicators
- Call history log
- AOL-styled ringing/dialing animations and sound effects

### 🧩 Plugin System
- TypeScript Plugin SDK with sandboxed iframe execution
- Plugin lifecycle management (install, enable, disable, remove)
- Matrix Widget API support (MSC1960/MSC2762)
- Integration manager compatibility (Dimension/hookshot)
- Hot-reload for plugin development
- 3 built-in plugins:
  - **🎲 Dice Roller** — `/roll 2d20` with animated results
  - **📊 Polls** — `/poll "Question" "Yes" "No"` with vote tracking
  - **💻 Code Paste** — `/paste` with syntax highlighting and line numbers

### 🛡️ Privacy Hardening
- Zero telemetry, zero analytics — ever
- Tor/SOCKS5 proxy support for network-level privacy
- DNS-over-HTTPS (Cloudflare, Google, or custom resolver)
- Certificate pinning with TOFU (Trust On First Use) model
- No CDN or third-party asset loading
- Generic user-agent string (no version fingerprinting)
- All external requests routed through homeserver only
- Local-only search index

### 🎨 AOL Retro Aesthetic
- Classic beveled 3D window chrome (Windows 95 / AOL 3.0 style)
- Buddy List with real-time presence (online/away/idle/offline)
- AOL IM-style chat panels with font/color/size toolbar
- Sound scheme engine (door open/close, "You've Got Mail", IM chime)
- Dial-up connection animation on login
- Running Man and hourglass loading states
- Away message system with templates
- AOL-style profile cards
- **Three themes:** AOL Classic (light), AOL 2026 (glassmorphism dark), High Contrast
- High contrast accessibility mode

### ♿ Accessibility
- ARIA labels on all interactive elements
- Full keyboard navigation with visible focus rings
- Screen reader live regions for chat messages
- Skip navigation links
- Focus trapping in modal dialogs
- Reduced motion support
- High contrast theme option

### ⚡ Performance
- Virtual scrolling for message timelines (windowed rendering)
- Lazy media loading with LRU thumbnail cache
- Web Worker for search indexing and markdown parsing
- Code splitting (React.lazy) for settings, calls, plugins
- Message cache eviction (paginated from local store)
- Draft auto-persistence across rooms

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  PufferChat App                  │
├──────────────────┬──────────────────────────────┤
│   Tauri Shell    │     React/TS Frontend        │
│   (Rust core)    │     (Retro AOL UI)           │
│                  │                              │
│  ┌────────────┐  │  ┌────────────────────────┐  │
│  │ matrix-    │  │  │  Room Views             │  │
│  │ rust-sdk   │  │  │  Buddy List             │  │
│  │            │  │  │  Chat Panels            │  │
│  │ E2EE       │  │  │  Settings               │  │
│  │ Sync       │  │  │  Plugin Host            │  │
│  │ Media      │  │  │  Widget Container       │  │
│  └────────────┘  │  └────────────────────────┘  │
│                  │                              │
│  ┌────────────┐  │  ┌────────────────────────┐  │
│  │ SQLCipher  │  │  │  Theme Engine           │  │
│  │ (encrypted │  │  │  (AOL Classic / Dark)   │  │
│  │  store)    │  │  │                        │  │
│  └────────────┘  │  └────────────────────────┘  │
│                  │                              │
│  ┌────────────┐  │  ┌────────────────────────┐  │
│  │ OS Keychain│  │  │  Notification Engine    │  │
│  │ (secrets)  │  │  │  (AOL sounds + native) │  │
│  └────────────┘  │  └────────────────────────┘  │
└──────────────────┴──────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Shell/Backend** | Tauri 2.x (Rust) | Lightweight native binary (<50MB), OS integration, no Electron bloat |
| **Matrix SDK** | matrix-rust-sdk | Official Rust SDK, best E2EE support, Vodozemac crypto |
| **Frontend** | React 18 + TypeScript | Component modularity, ecosystem, Tauri compatibility |
| **Styling** | CSS Modules + AOL theme engine | Pixel-perfect retro styling with theme switching |
| **Local DB** | SQLite via SQLCipher | Encrypted message cache, search index, session persistence |
| **Secrets** | OS Keychain (keyring-rs) | Windows Credential Manager, macOS Keychain, libsecret |
| **State** | Zustand | Lightweight reactive stores for rooms, messages, encryption, calls, plugins |
| **Build** | Cargo + Vite + Tauri CLI | Fast builds, HMR in dev, optimized production bundles |
| **Packaging** | Tauri bundler | NSIS/MSI (Win), DMG (Mac), AppImage/deb (Linux) |

---

## Project Structure

```
pufferchat/
├── src-tauri/                  # Rust backend
│   └── src/
│       ├── main.rs             # Entry point
│       ├── lib.rs              # Tauri app builder + command registration
│       ├── commands.rs         # 100+ Tauri IPC commands
│       ├── error.rs            # Error types
│       ├── link_preview.rs     # OG metadata extraction
│       ├── matrix/
│       │   ├── client.rs       # Matrix client wrapper (auth, sync, rooms, media, crypto)
│       │   ├── crypto.rs       # E2EE operations (verification, key backup, SSSS)
│       │   ├── voip.rs         # VoIP signaling (Matrix call events, SDP/ICE)
│       │   ├── media.rs        # Media upload/download
│       │   └── sync.rs         # Sync engine
│       └── store/
│           ├── db.rs           # SQLCipher database
│           └── keychain.rs     # OS keychain access
├── src/                        # React frontend
│   ├── App.tsx                 # Root component
│   ├── components/
│   │   ├── accessibility/      # A11y provider, skip nav, focus trap
│   │   ├── buddy-list/         # Buddy List sidebar
│   │   ├── calls/              # Voice/video call UI (10 components)
│   │   ├── chat/               # Chat panels, virtual timeline
│   │   ├── common/             # ErrorBoundary, LoadingStates, EmptyStates
│   │   ├── login/              # AOL sign-on screen
│   │   ├── retro/              # Reusable AOL components (Window, Button, Toolbar, MenuBar, Dialog)
│   │   ├── rooms/              # Room management, moderation, directory
│   │   ├── security/           # Verification, key backup, device management
│   │   ├── settings/           # 15+ settings panels (proxy, certs, DNS, accounts, updates, data)
│   │   └── shell/              # App shell, menu bar, toolbar
│   ├── hooks/                  # useCall, useKeyboardShortcuts, useDraftPersistence, useMediaLazyLoad
│   ├── plugins/                # Plugin SDK, bridge, host, widget API, integration manager
│   ├── stores/                 # Zustand stores (rooms, messages, auth, encryption, calls, plugins, accounts)
│   ├── themes/
│   │   ├── aol-classic/        # Default light theme
│   │   └── aol-dark/           # Dark mode with CRT glow
│   ├── workers/                # Web Workers (search indexing)
│   └── sounds/                 # AOL sound effects (.wav)
├── plugins/                    # Built-in plugins (dice-roller, polls, code-paste)
├── docs/
│   ├── user-guide.md           # Complete user documentation
│   ├── keyboard-shortcuts.md   # Hotkey reference
│   └── plugin-development.md   # Plugin SDK developer guide
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## Installation

### Pre-built Binaries

Download from [Releases](https://github.com/Void-Syndicate/PufferChat/releases):

| Platform | Format | File |
|----------|--------|------|
| Windows | NSIS Installer | `PufferChat-1.0.0-setup.exe` |
| Windows | MSI | `PufferChat-1.0.0.msi` |
| macOS | DMG | `PufferChat-1.0.0.dmg` |
| Linux | AppImage | `PufferChat-1.0.0.AppImage` |
| Linux | Debian | `pufferchat_1.0.0_amd64.deb` |

### Build from Source

**Prerequisites:**
- Rust stable toolchain (1.75+)
- Node.js 20 LTS+
- Tauri CLI 2.x: `cargo install tauri-cli`
- Platform SDKs:
  - **Windows:** Windows SDK
  - **macOS:** Xcode Command Line Tools
  - **Linux:** `webkit2gtk-4.1`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`

```bash
git clone https://github.com/Void-Syndicate/PufferChat.git
cd PufferChat

# Install frontend dependencies
npm install

# Development mode (with hot module replacement)
npm run tauri dev

# Production build
npm run tauri build
```

---

## Quick Start

1. **Launch** PufferChat
2. **Connect** — Enter your Matrix homeserver (e.g., `https://matrix.org`)
3. **Sign in** — Username/password or SSO
4. **Chat** — Your Buddy List populates automatically. Click a buddy or room to start messaging.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Search rooms & messages |
| `Ctrl+N` | Create new room |
| `Ctrl+,` | Open settings |
| `Ctrl+T` | Focus message composer |
| `Alt+↑/↓` | Navigate rooms |
| `Ctrl+Shift+M` | Toggle mute (in call) |
| `Ctrl+Shift+E` | Toggle video (in call) |
| `Ctrl+/` | Show all shortcuts |
| `Escape` | Close panel / dialog |

Full reference: [docs/keyboard-shortcuts.md](docs/keyboard-shortcuts.md)

---

## Security Architecture

### Encryption
| Component | Implementation |
|-----------|---------------|
| Group encryption | Matrix Megolm |
| 1:1 key exchange | Olm |
| Crypto library | Vodozemac (Rust, audited) |
| Key storage | OS keychain (master keys), SQLCipher (session keys) |
| Key backup | SSSS to homeserver, encrypted with recovery key |
| Forward secrecy | Megolm ratchet per 100 messages or 1 week |

### Authentication
- Password login with Argon2id on client side
- SSO/OIDC for enterprise homeservers
- Device verification mandatory for E2EE rooms
- Session tokens stored in OS keychain only

### Network Security
- TLS 1.3 minimum for all connections
- Certificate pinning (TOFU model, configurable)
- Tor/SOCKS5 proxy routing
- DNS-over-HTTPS for homeserver resolution
- No plaintext fallback

### Local Security
- SQLCipher encrypted database
- OS keychain for all sensitive data
- Memory zeroization for crypto material
- Secure delete for message purge
- Auto-lock with configurable timeout

---

## Plugin Development

PufferChat supports custom plugins via a TypeScript SDK with iframe sandboxing.

```typescript
// Example: Hello World plugin
import { PufferPlugin } from '@pufferchat/sdk';

const plugin: PufferPlugin = {
  name: 'hello-world',
  version: '1.0.0',
  
  onLoad(api) {
    api.registerCommand('/hello', () => {
      api.sendMessage('Hello from my plugin! 🐡');
    });
  }
};

export default plugin;
```

Plugins declare permissions in `manifest.json` and run in sandboxed iframes — no direct Matrix SDK access. See [Plugin Development Guide](docs/plugin-development.md) for the full API reference.

---

## Themes

| Theme | Description |
|-------|-------------|
| **AOL Classic** | Default light theme — steel gray, AOL blue (#004B87), beveled borders |
| **AOL 2026** | Modern glassmorphism — deep navy, Inter font, glass surfaces, blue glow |
| **High Contrast** | Accessibility mode with maximum contrast, disabled animations |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Installer size | < 50 MB |
| Memory (idle) | < 200 MB |
| Memory (active, 50+ rooms) | < 500 MB |
| Startup to room list | < 3 seconds |
| E2EE coverage | 100% in encrypted rooms |

---

## Documentation

- [User Guide](docs/user-guide.md) — Getting started, features, troubleshooting
- [Keyboard Shortcuts](docs/keyboard-shortcuts.md) — Complete hotkey reference
- [Plugin Development](docs/plugin-development.md) — SDK reference, manifest format, examples
- [Vulnerability Management](docs/VULNERABILITY-MANAGEMENT.md) — Security audit details

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "Add my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

Please follow existing code patterns (CSS Modules, Zustand stores, Tauri command registration in `lib.rs`).

---

## References

- [Matrix Specification](https://spec.matrix.org/)
- [matrix-rust-sdk](https://github.com/matrix-org/matrix-rust-sdk)
- [Tauri 2.0](https://v2.tauri.app/)
- [Element Web](https://github.com/element-hq/element-web) — Feature reference
- [Vodozemac](https://github.com/matrix-org/vodozemac) — Crypto implementation
- [AOL Instant Messenger](https://en.wikipedia.org/wiki/AOL_Instant_Messenger) — Aesthetic inspiration (RIP 1997–2017)

---

*Built with 🐡 by the Void Syndicate*
