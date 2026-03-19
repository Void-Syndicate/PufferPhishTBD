# PufferChat — Custom Matrix Communication Client

> *"You've got mail... encrypted."*

## Overview

**PufferChat** is a custom Matrix protocol communication client with a retro AOL-inspired UI, packaged as a native desktop executable. Full Element-level functionality with a modular architecture designed for extensibility, security, and privacy-first communication.

**Status:** Phase 2 Complete — Phase 3 Ready (~25%)
**Start Date:** 2026-03-18
**Stack:** Rust (Tauri) + React + TypeScript + matrix-rust-sdk
**Target Platforms:** Windows, Linux, macOS

---

## Design Philosophy

### UI/UX — AOL Retro Aesthetic
- **Window chrome:** Classic beveled 3D borders, title bars with minimize/maximize/close buttons styled like Windows 95/AOL 3.0
- **Color palette:** AOL blue (#004B87), white, steel gray, yellow highlights — CRT phosphor glow optional
- **Typography:** Bitmap-style fonts (Chicago, MS Sans Serif, Fixedsys) with optional modern fallback
- **Buddy List panel:** Left sidebar mimicking the AOL Buddy List with expandable groups, online/offline/away indicators
- **Chat windows:** AOL IM-style floating or tabbed chat panels with the classic "Send" button, font/color toolbar
- **Sound effects:** AOL door open/close sounds on join/leave, "You've Got Mail" notification, IM received chime (all configurable/disableable)
- **Welcome screen:** AOL sign-on screen recreation with Matrix homeserver login fields
- **Away messages:** Retro away message editor with preset templates
- **Profile cards:** AOL member profile style with avatar, status, bio
- **Animations:** Dial-up connection animation on login, loading spinners styled as hourglass cursors

### Core Principles
1. **Matrix Protocol Native** — Full Matrix spec compliance via matrix-rust-sdk
2. **Security First** — E2EE by default, cross-signing, SSSS, device verification
3. **Privacy by Design** — No telemetry, no analytics, local-first data
4. **Modular Architecture** — Plugin/widget system for extensibility
5. **Desktop Native** — Tauri for lightweight native executable (<50MB)

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
│  │ SQLite     │  │  │  Theme Engine           │  │
│  │ (sled/     │  │  │  (AOL Classic default)  │  │
│  │  indexed)  │  │  │                        │  │
│  └────────────┘  │  └────────────────────────┘  │
│                  │                              │
│  ┌────────────┐  │  ┌────────────────────────┐  │
│  │ Keychain   │  │  │  Notification Engine    │  │
│  │ (OS-native │  │  │  (AOL sounds + OS      │  │
│  │  secrets)  │  │  │   native)              │  │
│  └────────────┘  │  └────────────────────────┘  │
└──────────────────┴──────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Shell/Backend** | Tauri 2.x (Rust) | Lightweight native binary, OS integration, no Electron bloat |
| **Matrix SDK** | matrix-rust-sdk | Official Rust SDK, best E2EE support, Vodozemac crypto |
| **Frontend** | React 18 + TypeScript | Component modularity, ecosystem, Tauri compatibility |
| **Styling** | CSS Modules + custom AOL theme engine | Pixel-perfect retro styling with theme swap capability |
| **Local DB** | SQLite via rusqlite | Message cache, search index, session persistence |
| **Secrets** | OS Keychain (keyring-rs) | Secure credential storage (Windows Credential Manager, macOS Keychain, libsecret) |
| **Build** | Cargo + Vite + Tauri CLI | Fast builds, HMR in dev, optimized production bundles |
| **Packaging** | Tauri bundler | MSI/NSIS (Win), DMG (Mac), AppImage/deb (Linux) |

---

## Feature Matrix (Element Parity + Extensions)

### Tier 1 — Core Communication
- [ ] Matrix login (password, SSO, QR code)
- [ ] Multi-account support
- [ ] Room list with categories (DMs, Groups, Spaces)
- [ ] 1:1 direct messages
- [ ] Group rooms (create, join, invite, leave)
- [ ] Message types: text, rich text, markdown, code blocks
- [ ] Message editing and deletion
- [ ] Reply threading
- [ ] Reactions (emoji)
- [ ] Read receipts and typing indicators
- [ ] Message search (local + server-side)
- [ ] Unread badges and notification counts
- [ ] Room notifications (all/mentions/mute)

### Tier 2 — Media & Files
- [ ] Image/video/audio upload and preview
- [ ] File attachments with download manager
- [ ] Voice messages (record + send)
- [ ] GIF picker integration
- [ ] Sticker packs (Matrix sticker protocol)
- [ ] Link previews with OG metadata
- [ ] Media gallery per room
- [ ] Clipboard paste (images, files)

### Tier 3 — Security & Privacy
- [ ] End-to-end encryption (Megolm/Olm via Vodozemac)
- [ ] Cross-signing and device verification (emoji/QR)
- [ ] Secure Secret Storage and Sharing (SSSS)
- [ ] Key backup and recovery
- [ ] Session management (view/remove devices)
- [ ] Room key export/import
- [ ] Verification badge on users/devices
- [ ] Message key requesting (for missed messages)
- [ ] Local data encryption at rest (SQLite encryption)
- [ ] No telemetry, no analytics, no tracking — ever
- [ ] Tor/proxy support for network-level privacy
- [ ] Certificate pinning for homeserver connections

### Tier 4 — Spaces & Organization
- [ ] Matrix Spaces (nested hierarchy)
- [ ] Space creation and management
- [ ] Room directory browsing
- [ ] Room aliases and canonical addresses
- [ ] Room topics, avatars, settings
- [ ] Room permissions and power levels
- [ ] Moderation tools (kick, ban, redact, ACLs)
- [ ] Room upgrades (version migration)

### Tier 5 — Voice/Video
- [ ] 1:1 VoIP calls (Matrix VoIP / WebRTC)
- [ ] Group voice/video calls (Jitsi or MatrixRTC)
- [ ] Screen sharing
- [ ] Call UI with AOL phone-ringing aesthetic
- [ ] Push-to-talk option

### Tier 6 — Widgets & Integrations
- [ ] Matrix widget API support (embedded web apps)
- [ ] Integration manager compatibility (Dimension/hookshot)
- [ ] Bot interaction support
- [ ] Custom widget development SDK
- [ ] Plugin system (see Phase 5)

### Tier 7 — AOL-Specific Features
- [ ] Buddy List with presence (online/away/idle/offline)
- [ ] Away message system with templates
- [ ] AOL-style profile cards
- [ ] Sound scheme engine (AOL classic, custom packs)
- [ ] "Running Man" loading animation on sync
- [ ] Buddy info tooltip on hover
- [ ] Chat room directory (AOL keyword style)
- [ ] Member list in chat rooms (AOL style)
- [ ] Font/color/size toolbar in message composer
- [ ] Warn level display (mapped to Matrix power levels / reputation)

---

## Security Architecture

### Encryption
- **Protocol:** Matrix Megolm (group) + Olm (1:1 key exchange)
- **Implementation:** Vodozemac (Rust, audited)
- **Key Storage:** OS keychain for master keys, SQLite (encrypted) for session keys
- **Key Backup:** SSSS to homeserver, encrypted with recovery key
- **Forward Secrecy:** Megolm ratchet per 100 messages or 1 week

### Authentication
- Password login with PBKDF2/Argon2 on client side
- SSO (OIDC) support for enterprise homeservers
- Device verification mandatory for E2EE rooms
- Session tokens stored in OS keychain, never plaintext

### Network Security
- TLS 1.3 minimum for all homeserver connections
- Certificate pinning (configurable)
- Optional Tor/SOCKS5 proxy routing
- DNS-over-HTTPS for homeserver resolution
- No plaintext fallback — ever

### Local Security
- SQLite database encrypted with SQLCipher
- Sensitive data (keys, tokens) in OS keychain only
- Memory zeroization for crypto material (zeroize crate)
- Secure delete for message purge operations
- Auto-lock with passphrase after idle timeout (configurable)

### Privacy Guarantees
- Zero telemetry, zero analytics
- No crash reporting without explicit opt-in
- Local-only message search index
- No CDN or third-party asset loading
- All external requests go through homeserver only
- User-agent string is generic (no version fingerprinting)

---

## Phase Plan

### Phase 1 — Foundation & Skeleton (Weeks 1-3)
**Goal:** Tauri app boots, connects to Matrix, renders room list

**Tasks:**
1. Initialize Tauri 2.x + React + TypeScript project scaffold
2. Configure Vite for Tauri with HMR
3. Integrate matrix-rust-sdk as Tauri Rust plugin
4. Implement Matrix login flow (password auth)
5. Implement sync loop (initial + incremental)
6. Build room list component with unread counts
7. Create AOL theme engine foundation (CSS custom properties + retro component library)
8. Build AOL-style login/sign-on screen
9. OS keychain integration for token persistence
10. Basic error handling and connection state management

**Deliverables:**
- Bootable Tauri app with AOL login screen
- Successful Matrix login and sync
- Room list populated with joined rooms
- AOL visual foundation established

**Exit Criteria:** Can log into matrix.org, see room list, persist session across restarts

**Phase 1 Security Audit (2026-03-18):** ✅ COMPLETE
- VULN-001 (CRITICAL): Access token leaked to frontend → FIXED
- VULN-002 (HIGH): SQLite store unencrypted → FIXED
- VULN-003 (HIGH): Insufficient URL validation → FIXED
- VULN-004 (HIGH): CSP unsafe-inline → FIXED
- npm audit: 0 vulnerabilities
- Rust cargo audit (2026-03-18): 3 vulnerabilities in matrix-sdk deps, 20 warnings (GTK3 unmaintained — Tauri upstream)
  - matrix-sdk-base 0.10.0: panic + DoS vectors → mitigate by upgrading to 0.10.1+ when available
  - matrix-sdk-crypto 0.10.0: sender spoofing by HS admin → accept risk (requires compromised HS)
  - GTK3/glib warnings: Tauri upstream dependency, no action needed on Windows

---

### Phase 2 — Core Messaging (Weeks 4-7)
**Goal:** Full chat functionality in AOL-style IM windows

**Tasks:**
1. Room timeline view with paginated message loading
2. Message composer with send functionality
3. Rich text rendering (markdown, HTML subset)
4. Message editing and deletion
5. Reply threading UI
6. Emoji reactions (send and display)
7. Typing indicators
8. Read receipts (sent and displayed)
9. AOL IM window styling (chat bubbles, fonts, colors)
10. AOL Buddy List component with presence
11. Sound effect engine (join/leave/message sounds)
12. Notification system (OS native + in-app)
13. Unread badge system
14. Room notification settings (all/mentions/mute)
15. DM vs Group room differentiation in UI

**Deliverables:**
- Fully functional chat in 1:1 and group rooms
- AOL IM aesthetic fully realized
- Sound effects and notifications working
- Buddy List with real-time presence

**Exit Criteria:** Can have a real conversation with another Matrix user, full message lifecycle works

---

### Phase 2.5 — Functional Expansion (Weeks 5-7)
**Goal:** Every visible UI element is functional. No dead buttons. Fix data mismatches.

**Status:** In Progress

**Tasks:**
1. ✅ **[CRITICAL] Fix reaction data shape** — Backend HashMap<String, Vec<String>> → Frontend {emoji, senders}[] alignment
2. **Room member list panel** — Wire `get_room_members` to collapsible sidebar/panel in chat view
3. **Room creation dialog** — AOL "Create a Room" style dialog, backend `create_room` command
4. **Room join/leave/invite** — Backend commands + UI flows (join by alias/ID, leave confirmation, invite dialog)
5. **Avatar resolution** — Resolve mxc:// URLs to HTTP for rooms + users, display in buddy list + message bubbles
6. **Room header expansion** — Show topic, member count, encryption badge, clickable for room settings
7. **Menu bar dropdowns** — File (Settings, Sign Off), Edit (Preferences), People (Member List, Invite), Rooms (Create, Join, Directory), Help (About)
8. **Toolbar buttons** — Wire Read (unread rooms), Write (compose to user), Rooms (room browser), People (member list)
9. **Font toolbar** — Markdown wrapping for bold/italic/underline, font color picker, font size selector
10. **Presence tracking** — Parse presence events from sync, display online/away/offline indicators in buddy list
11. **Last message preview** — Populate last message + timestamp in room summaries for buddy list display + sort
12. **Read receipt display** — Track per-user read position, show read indicators under messages
13. **Room directory browsing** — Public room search dialog with AOL Keyword aesthetic

**Deliverables:**
- All menu bar items functional with dropdown menus
- All toolbar buttons wired to panels/dialogs
- Room CRUD (create, join, leave, invite) working
- Avatars displayed throughout UI
- Presence indicators live in buddy list
- Font formatting toolbar functional
- Read receipts visible in chat

**Exit Criteria:** Zero dead buttons. Every clickable element performs an action or opens a dialog.

---

### Phase 3 — Encryption & Security (Weeks 8-10)
**Goal:** Full E2EE with device verification and key management

**Tasks:**
1. Enable Megolm encryption for rooms
2. Device verification flow (emoji comparison)
3. QR code verification
4. Cross-signing implementation
5. SSSS (Secure Secret Storage and Sharing)
6. Key backup to homeserver
7. Key recovery flow
8. Session/device management UI
9. Key export/import
10. SQLCipher integration for local DB encryption
11. Memory zeroization for crypto material
12. Auto-lock with passphrase
13. Verification badges in UI
14. Encrypted room indicators in room list

**Deliverables:**
- E2EE enabled by default for all new rooms
- Full device verification flow
- Key backup and recovery working
- Local data encrypted at rest

**Exit Criteria:** Messages unreadable without proper keys, verification flow complete, key recovery works

---

### Phase 4 — Media, Files & Rich Content (Weeks 11-13)
**Goal:** Full media support with AOL flair

**Tasks:**
1. Image upload, thumbnail generation, lightbox viewer
2. Video upload and inline player
3. Audio upload and playback
4. File attachment system with download manager
5. Voice message recording and playback
6. GIF picker (Tenor/Giphy API)
7. Sticker pack support (Matrix protocol)
8. Link preview with OG metadata extraction
9. Media gallery per room
10. Clipboard paste handler (images, files)
11. Drag-and-drop file upload
12. Upload progress indicators (AOL file transfer style)
13. Media cache management

**Deliverables:**
- All media types supported
- AOL-styled file transfer UI
- Voice messages working
- Rich link previews

**Exit Criteria:** Can send/receive all media types, encrypted media works, cache managed

---

### Phase 5 — Spaces, Moderation & Organization (Weeks 14-16)
**Goal:** Full room management, Spaces, and moderation tools

**Tasks:**
1. Matrix Spaces support (create, join, browse)
2. Nested Space hierarchy in sidebar
3. Room creation wizard (AOL "Create a Room" style)
4. Room settings panel (topic, avatar, permissions)
5. Room directory browser (AOL Keyword style)
6. Power level management UI
7. Moderation tools (kick, ban, mute, redact)
8. Server ACL management
9. Room aliases and canonical address management
10. Room upgrade/migration flow
11. Invite management (send, accept, reject)
12. Room categories and tagging in sidebar
13. Member list with roles and power levels

**Deliverables:**
- Spaces fully functional
- Room management complete
- Moderation toolkit ready
- AOL-style room directory

**Exit Criteria:** Can create/manage Spaces, moderate rooms, browse directory

---

### Phase 6 — Voice/Video Calling (Weeks 17-19)
**Goal:** VoIP and video calls with AOL phone aesthetic

**Tasks:**
1. 1:1 VoIP calls via Matrix VoIP (WebRTC)
2. Call UI with AOL-style ringing/dialing animation
3. In-call controls (mute, hold, speaker)
4. 1:1 video calls
5. Group calls (MatrixRTC or Jitsi bridge)
6. Screen sharing
7. Call history log
8. Push-to-talk option
9. Audio device selection
10. Call quality indicators
11. AOL "phone ringing" sound effect

**Deliverables:**
- 1:1 voice and video calls working
- Group calls functional
- Screen sharing operational
- Full AOL call aesthetic

**Exit Criteria:** Can make calls to Element users, screen share works, group calls stable

---

### Phase 7 — Plugin System & Widgets (Weeks 20-22)
**Goal:** Extensible plugin architecture and Matrix widget support

**Tasks:**
1. Design plugin API (TypeScript SDK)
2. Plugin sandboxing (iframe + message passing)
3. Plugin lifecycle management (install, enable, disable, remove)
4. Plugin settings UI
5. Matrix widget API support (embedded web apps in rooms)
6. Integration manager compatibility (Dimension)
7. Bot interaction UI improvements
8. Plugin marketplace UI (local catalog)
9. Built-in plugins: dice roller, polls, code paste
10. Plugin development documentation
11. Hot-reload for plugin development

**Deliverables:**
- Working plugin system with SDK
- Matrix widgets rendering in rooms
- 3+ built-in plugins shipped
- Plugin developer docs

**Exit Criteria:** Third-party plugins can be loaded, widgets render, SDK documented

---

### Phase 8 — Polish, Privacy & Release (Weeks 23-26)
**Goal:** Production-ready release with full privacy hardening

**Tasks:**
1. Tor/SOCKS5 proxy support
2. Certificate pinning
3. DNS-over-HTTPS
4. Accessibility audit (screen readers, keyboard nav)
5. Performance optimization (virtual scrolling, lazy loading)
6. Memory usage optimization
7. Multi-account support
8. SSO/OIDC login flow
9. Settings migration and export
10. Auto-updater (Tauri updater plugin)
11. Crash recovery and data integrity checks
12. Cross-platform testing (Win/Mac/Linux)
13. Installer packaging (MSI, DMG, AppImage, deb)
14. User documentation / help system
15. Beta release and feedback cycle
16. Security audit (external or self-conducted)

**Deliverables:**
- Production-ready executables for all platforms
- Full privacy hardening complete
- Auto-update mechanism
- Documentation complete
- v1.0.0 release

**Exit Criteria:** Stable, secure, private Matrix client with full Element parity and AOL aesthetic

---

## Directory Structure

```
pufferchat/
├── src-tauri/                  # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs            # Entry point
│   │   ├── matrix/            # Matrix SDK integration
│   │   │   ├── mod.rs
│   │   │   ├── client.rs      # Client wrapper
│   │   │   ├── sync.rs        # Sync engine
│   │   │   ├── crypto.rs      # E2EE operations
│   │   │   ├── media.rs       # Media handling
│   │   │   └── voip.rs        # VoIP/WebRTC
│   │   ├── store/             # Local storage
│   │   │   ├── mod.rs
│   │   │   ├── db.rs          # SQLCipher database
│   │   │   └── keychain.rs    # OS keychain access
│   │   ├── plugins/           # Plugin host
│   │   │   ├── mod.rs
│   │   │   └── sandbox.rs     # Plugin isolation
│   │   └── commands.rs        # Tauri IPC commands
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                        # React frontend
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── login/             # AOL sign-on screen
│   │   ├── buddy-list/        # Buddy List sidebar
│   │   ├── chat/              # Chat windows/panels
│   │   ├── rooms/             # Room management
│   │   ├── spaces/            # Spaces hierarchy
│   │   ├── calls/             # Voice/video UI
│   │   ├── settings/          # Settings panels
│   │   ├── widgets/           # Widget container
│   │   └── retro/             # Reusable AOL-style components
│   │       ├── Window.tsx     # Classic window chrome
│   │       ├── Button.tsx     # 3D beveled button
│   │       ├── Toolbar.tsx    # AOL toolbar
│   │       ├── MenuBar.tsx    # Classic menu bar
│   │       ├── ListBox.tsx    # Classic list component
│   │       └── Dialog.tsx     # Modal dialog (AOL style)
│   ├── hooks/                 # React hooks for Matrix
│   ├── stores/                # Zustand state management
│   ├── themes/
│   │   ├── aol-classic/       # Default AOL theme
│   │   ├── aol-dark/          # Dark mode retro
│   │   └── engine.ts          # Theme switching
│   ├── sounds/                # AOL sound effects
│   │   ├── welcome.wav
│   │   ├── im-received.wav
│   │   ├── door-open.wav
│   │   ├── door-close.wav
│   │   └── file-done.wav
│   └── plugins/               # Plugin SDK + built-ins
├── plugins/                    # Installable plugins directory
├── docs/                       # User and developer docs
├── tests/                      # E2E and unit tests
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## Development Environment Requirements

- **Rust:** stable toolchain (1.75+)
- **Node.js:** 20 LTS+
- **Tauri CLI:** 2.x
- **Platform SDKs:** Windows SDK (Win), Xcode CLI (Mac), webkit2gtk + deps (Linux)
- **Protobuf compiler:** for matrix-rust-sdk (if needed)
- **SQLCipher:** for encrypted local storage

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| matrix-rust-sdk API instability | High | Pin SDK version, maintain abstraction layer |
| Tauri 2.x breaking changes | Medium | Pin Tauri version, test upgrades in branch |
| WebRTC in Tauri complexity | High | Evaluate Tauri WebRTC plugins early, fallback to system browser for calls |
| AOL aesthetic limiting UX | Medium | Ensure all retro elements have modern alternatives in settings |
| E2EE complexity/key management | High | Follow Element's proven UX patterns for verification flows |
| Cross-platform audio/video | High | Abstract media layer, test early on all 3 platforms |
| Plugin sandboxing security | High | Strict CSP, no direct Matrix SDK access from plugins |

---

## Success Metrics

- **Element Feature Parity:** 100% of Tier 1-5 features
- **Binary Size:** <50MB installer
- **Memory Usage:** <200MB idle, <500MB active with 50+ rooms
- **Startup Time:** <3 seconds to room list
- **E2EE Coverage:** 100% of messages in encrypted rooms
- **Platform Support:** Windows 10+, macOS 12+, Ubuntu 22.04+

---

## References

- [Matrix Spec](https://spec.matrix.org/)
- [matrix-rust-sdk](https://github.com/matrix-org/matrix-rust-sdk)
- [Tauri 2.0](https://v2.tauri.app/)
- [Element Web Source](https://github.com/element-hq/element-web)
- [Vodozemac](https://github.com/matrix-org/vodozemac)
- [AOL Instant Messenger UI Reference](https://en.wikipedia.org/wiki/AOL_Instant_Messenger)
