# PufferChat Changelog

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
