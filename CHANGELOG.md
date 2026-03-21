# PufferChat Changelog

## [1.1.0] - 2026-03-21

### Phase 9 — Theme Modernization & Polish

#### New Features
- **AOL 2026 theme** — Modern glassmorphism dark theme replacing the old AOL Dark theme. Deep navy (`#0a0e1a`) background, Inter/JetBrains Mono font stack, glass-morphic surfaces with `rgba` transparency, blue accent glow effects, smooth transitions, and sleek 6px scrollbars. A 2026 reimagination of the AOL aesthetic.
- **Updated theme engine** — Three-theme system: AOL Classic (original retro), AOL 2026 (modern glass), High Contrast (accessibility). Theme switching via `data-theme` attribute with localStorage persistence and `theme-changed` custom events.
- **High Contrast theme improvements** — Pure black background, white borders, yellow focus outlines (`3px solid #ffeb3b`), forced font-weight 700 on buttons, all animations/transitions disabled (`animation: none !important; transition: none !important`) for reduced motion.

#### Improvements
- **LoginScreen accessibility** — Added `role="main"`, `aria-label` on login screen, form, and dialup overlay. Status overlay uses `aria-live="polite"`. Error messages use `role="alert"` with `aria-live="assertive"`.
- **Backend refinements** — Rust matrix client, crypto, and VoIP modules updated with stability improvements.
- **Sync module** — Added to matrix backend module exports.

#### Theme Details

| Theme | Style | Background | Font |
|-------|-------|-----------|------|
| AOL Classic | Retro 1997 | Steel gray/beveled | System UI |
| AOL 2026 | Glassmorphism | Deep navy #0a0e1a | Inter + JetBrains Mono |
| High Contrast | Accessibility | Pure black #000000 | System UI, 1.0625rem |

## [0.2.0] - 2026-03-18

### Phase 2 — Core Messaging (Complete)

#### New Features
- **Full chat functionality** — Send, receive, reply, edit, delete messages in 1:1 and group rooms
- **Emoji reactions** — Send and display reactions on messages via context menu
- **Typing indicators** — Real-time "X is typing..." display in message composer
- **Read receipts** — Sent on room view, received from other users
- **Message pagination** — Scroll up to load older messages with "Load older messages" button
- **Message search** — Ctrl+F search bar in chat view, searches room messages with debounced input
- **Sound effects engine** — Web Audio API synthesized AOL-inspired tones (message received/sent, welcome, door open/close, notification, error). Configurable volume, per-sound enable, global mute. Settings persist in localStorage.
- **Sound settings panel** — Win98-styled settings dialog accessible from ⚙️ Setup toolbar button. Per-sound test buttons, volume slider, mute toggle.
- **OS desktop notifications** — Tauri notification plugin. Sends desktop notifications for new messages when window is unfocused. Respects per-room notification settings.
- **Per-room notification settings** — Right-click rooms in Buddy List to set: All Messages / Mentions Only / Mute. Visual indicators (🔕/💬) on muted/mentions-only rooms.
- **Live room list updates** — Room list refreshes automatically after each sync cycle via `matrix://rooms-changed` events.
- **Unread count updates** — Real-time unread badge updates on new messages for non-selected rooms.
- **AOL Buddy List** — Collapsible groups (Buddies/DMs, Chat Rooms), presence icons, unread badges, encryption indicators.
- **Message context menu** — Right-click messages for Reply, Edit (own), React, Delete (own).
- **Inline message editing** — Edit mode in composer with pre-filled text, "Save Edit" button, cancel option.
- **Reply threading** — Reply indicator in composer, reply preview on messages showing original content.
- **Welcome sound** — AOL-style welcome tone plays on successful login.

#### Bug Fixes
- Fixed pagination parameter mismatch (`fromToken` → `from`) — pagination was silently failing
- Fixed camelCase serialization mismatch in `GetRoomMessagesResult` interface
- Fixed message ordering — pagination results reversed to show oldest-at-top
- Fixed edit sync events — replacement events now update in-place instead of duplicating
- Fixed XSS vulnerability in formatted messages — added DOMPurify sanitization with strict tag whitelist

#### Security
- **VULN-005 FIXED:** XSS via unsanitized `dangerouslySetInnerHTML` on formatted Matrix messages. Added DOMPurify with allowed tags: b, i, u, em, strong, a, br, p, code, pre, blockquote, ul, ol, li, span.
- **VULN-006 FIXED:** Sync edit events arrived as new messages instead of updating originals. Added `replaces` field to track replacement relations.
- Installed `@tauri-apps/plugin-notification` for OS notification integration
- Notification permission requested on first launch

#### Documentation
- `docs/PHASE2-COMPLETION-PLAN.md` — Full development plan with test matrix
- `docs/VULNERABILITY-MANAGEMENT.md` — Vulnerability tracking process, current register, audit schedule
- `docs/PHASE3-SECURITY-PLAN.md` — Encryption implementation plan with threat model
- npm audit: **0 vulnerabilities**
- cargo audit: **3 vulnerabilities** (matrix-sdk upstream, documented and risk-assessed), **20 warnings** (GTK3 unmaintained — Tauri upstream)

## [0.1.1] - 2026-03-18

### Security Remediations (High Severity)

#### VULN-001: Access Token Leaked to Frontend (CRITICAL → FIXED)
- **Issue:** `LoginResult` struct included `access_token` field, sent via IPC to React frontend and stored in Zustand state (JavaScript memory). Exposed to any XSS or devtools inspection.
- **Fix:** Removed `access_token` from `LoginResult`. Token now stays exclusively in Rust backend memory and OS keychain. Frontend `AuthState` no longer has `accessToken` field.
- **Files:** `src-tauri/src/matrix/client.rs`, `src-tauri/src/commands.rs`, `src/stores/auth.ts`, `src/components/login/LoginScreen.tsx`

#### VULN-002: SQLite Store Unencrypted (HIGH → FIXED)
- **Issue:** `sqlite_store(&data_dir, None)` — local Matrix database stored with no passphrase. Messages, room state, and crypto material readable by any process with filesystem access.
- **Fix:** Auto-generate 256-bit random passphrase via `getrandom`, store in OS keychain under `db_passphrase` key, pass to `sqlite_store()`. DB now encrypted at rest.
- **Files:** `src-tauri/src/matrix/client.rs`, `src-tauri/Cargo.toml` (added `getrandom`, `hex`)

#### VULN-003: Insufficient Homeserver URL Validation (HIGH → FIXED)
- **Issue:** URL validation used simple string prefix checks. Vulnerable to: userinfo injection (`https://evil@legit.com`), non-HTTP schemes, malformed URLs.
- **Fix:** Full URL parsing via `url::Url`. Validates scheme (https required, http only for localhost/127.0.0.1/::1), rejects URLs with embedded credentials, requires valid host.
- **Files:** `src-tauri/src/commands.rs`, `src-tauri/Cargo.toml` (added `url`)

#### VULN-004: CSP Allows unsafe-inline Styles (HIGH → FIXED)
- **Issue:** `style-src 'self' 'unsafe-inline'` in Tauri CSP. Enables style-based injection attacks if an attacker can inject HTML content.
- **Fix:** Removed `unsafe-inline` from `style-src`. Added `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` for defense-in-depth.
- **Files:** `src-tauri/tauri.conf.json`

### Other Fixes
- Fixed `tsconfig.node.json` missing `composite: true` (build error)
- Added `getrandom`, `hex`, `url` crate dependencies

## [0.1.0] - 2026-03-18

### Initial Phase 1 Implementation
- Tauri 2.x + React + TypeScript scaffold
- Matrix login/logout via matrix-rust-sdk
- Room list with unread counts
- AOL retro login screen with dialup animation
- OS keychain integration for session persistence
- Retro component library (Window, Button, TextInput)
- Zustand state management
- Error sanitization (token redaction)
