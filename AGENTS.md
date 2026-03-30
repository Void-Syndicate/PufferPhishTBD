# AGENTS.md — PufferChat Contributor Guide for AI Agents

## Project Summary

**PufferChat** is a custom Matrix protocol communication client with a retro AOL-inspired UI, built as a native desktop executable using Tauri 2 (Rust) + React + TypeScript + matrix-rust-sdk.

Full project spec: [PROJECT.md](./PROJECT.md)

---

## Architecture at a Glance

```
Tauri 2 (Rust backend)          React/TS (Frontend)
├── matrix-rust-sdk integration  ├── AOL retro component library
├── SQLCipher local storage      ├── Zustand state management
├── OS keychain (keyring-rs)     ├── Theme engine (AOL Classic default)
├── Plugin sandbox host          ├── Sound effect engine
└── Tauri IPC commands           └── Plugin SDK (TypeScript)
```

- **Backend (Rust):** All Matrix protocol operations, encryption, storage, and OS integration happen in `src-tauri/`. The frontend never touches the network directly.
- **Frontend (React/TS):** UI rendering, state management, and user interaction in `src/`. Communicates with Rust via Tauri's IPC command system.
- **IPC Boundary:** Frontend calls `invoke("command_name", { args })` → Rust handles it → returns result. All Matrix data flows through this boundary.

---

## Key Design Decisions

### 1. UI/UX — AOL Retro Aesthetic
The entire UI mimics AOL Instant Messenger / AOL 3.0-5.0 era. This is non-negotiable for the project identity:
- Beveled 3D window chrome (Windows 95 style)
- AOL Buddy List sidebar with online/away/offline grouping
- IM-style chat panels with font/color toolbar
- AOL sign-on screen for Matrix login
- Sound effects: door open/close, IM chime, "You've Got Mail"
- Retro components live in `src/components/retro/`

### 2. Security First
- **E2EE by default** for all rooms (Megolm/Olm via Vodozemac)
- **Zero telemetry** — no analytics, no crash reporting without opt-in
- **SQLCipher** for local database encryption
- **OS Keychain** for all secrets (never plaintext on disk)
- **Memory zeroization** for crypto material (zeroize crate)

### 3. Matrix Protocol Compliance
- Full Matrix Client-Server API spec compliance
- Element feature parity is the target (see PROJECT.md Tier 1-7)
- matrix-rust-sdk is the sole Matrix interface — no custom protocol code
- For Matrix protocol work, agents must verify current behavior against primary sources before implementing:
  - Matrix spec (`spec.matrix.org`)
  - matrix-rust-sdk docs and current SDK source
  - Current Matrix Foundation docs/blog posts when auth, discovery, OIDC/MAS, or other evolving behavior is involved
- If repo docs and current Matrix sources disagree, follow current Matrix sources and update the repo docs or comments to match

### 4. Plugin Architecture
- Plugins are sandboxed (iframe + message passing)
- Plugins get a TypeScript SDK, no direct Matrix SDK access
- Plugin directory: `plugins/`

---

## Directory Structure

```
pufferchat/
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── main.rs            # Entry point
│   │   ├── commands.rs        # Tauri IPC commands (frontend ↔ backend)
│   │   ├── matrix/            # Matrix SDK wrapper
│   │   │   ├── client.rs      # Client lifecycle
│   │   │   ├── sync.rs        # Sync engine
│   │   │   ├── crypto.rs      # E2EE operations
│   │   │   ├── media.rs       # Media upload/download
│   │   │   └── voip.rs        # Voice/video calls
│   │   ├── store/             # Local persistence
│   │   │   ├── db.rs          # SQLCipher database
│   │   │   └── keychain.rs    # OS keychain
│   │   └── plugins/           # Plugin host + sandbox
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                        # React frontend
│   ├── components/
│   │   ├── retro/             # AOL-style reusable components
│   │   ├── login/             # Sign-on screen
│   │   ├── buddy-list/        # Buddy List sidebar
│   │   ├── chat/              # Chat panels
│   │   ├── rooms/             # Room management
│   │   ├── spaces/            # Spaces hierarchy
│   │   ├── calls/             # Voice/video UI
│   │   ├── settings/          # Settings panels
│   │   └── widgets/           # Widget container
│   ├── hooks/                 # React hooks (useRoom, useTimeline, etc.)
│   ├── stores/                # Zustand stores
│   ├── themes/                # Theme engine + AOL themes
│   ├── sounds/                # Audio assets
│   └── plugins/               # Plugin SDK + built-in plugins
├── plugins/                    # User-installed plugins
├── docs/                       # Documentation
└── tests/                      # Tests
```

---

## Development Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Rust | stable 1.75+ | Backend, matrix-rust-sdk |
| Node.js | 20 LTS+ | Frontend build tooling |
| Tauri CLI | 2.x | App shell, packaging |
| React | 18+ | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Frontend bundler + HMR |
| Zustand | 4.x | State management |
| SQLCipher | latest | Encrypted local DB |

---

## Coding Standards

### Rust (`src-tauri/`)
- Follow Rust 2021 edition idioms
- Use `thiserror` for error types, `anyhow` for application errors
- All Matrix SDK calls wrapped in abstraction layer (don't leak SDK types to IPC)
- Crypto material must use `zeroize` on drop
- No `unwrap()` in production paths — use proper error handling
- Document public functions with `///` doc comments

### TypeScript/React (`src/`)
- Strict TypeScript (`strict: true`)
- Functional components only (no class components)
- Custom hooks for all Matrix data access (`useRoom`, `useTimeline`, `usePresence`, etc.)
- Zustand for global state, React state for local UI state
- CSS Modules for component styling (no global CSS except theme variables)
- All retro UI components go in `src/components/retro/` and must be reusable

### General
- Commits: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- Branch naming: `phase-N/feature-name` (e.g., `phase-1/matrix-login`)
- PR required for merge to `main`
- No secrets in code — environment variables or OS keychain only

---

## IPC Command Pattern

All frontend ↔ backend communication uses Tauri's invoke system:

**Rust side (define command):**
```rust
#[tauri::command]
async fn get_rooms(state: State<'_, AppState>) -> Result<Vec<RoomSummary>, String> {
    // Matrix SDK call
}
```

**TypeScript side (call command):**
```typescript
const rooms = await invoke<RoomSummary[]>("get_rooms");
```

Keep commands granular. One command per operation. Return serializable types only.

---

## Phase Roadmap (Summary)

| Phase | Focus | Weeks |
|-------|-------|-------|
| 1 | Foundation — Tauri + Matrix login + room list + AOL theme | 1-3 |
| 2 | Core messaging — chat, Buddy List, sounds, notifications | 4-7 |
| 3 | Encryption — E2EE, verification, key management | 8-10 |
| 4 | Media — images, video, voice, files, GIFs | 11-13 |
| 5 | Spaces, moderation, room management | 14-16 |
| 6 | Voice/video calls | 17-19 |
| 7 | Plugin system + widgets | 20-22 |
| 8 | Privacy hardening, polish, v1.0.0 | 23-26 |

See [PROJECT.md](./PROJECT.md) for detailed task breakdowns per phase.

---

## Important Context for AI Agents

1. **This is a real product** — not a prototype. Code quality matters from Phase 1.
2. **The AOL aesthetic is core identity** — don't "modernize" the UI unless explicitly asked.
3. **Security is non-negotiable** — every feature must consider E2EE implications.
4. **matrix-rust-sdk is the source of truth** for protocol behavior. When in doubt, check its docs and Element's implementation.
5. **Test on all 3 platforms** — Tauri renders differently on Windows/Mac/Linux.
6. **The IPC boundary is the API contract** — keep Rust and TypeScript concerns separated.
7. **No telemetry, no tracking, no external requests** outside the Matrix homeserver.
8. **Research before Matrix changes** — for login, homeserver discovery, `.well-known`, SSO/OIDC/MAS, room relations, moderation, notifications, encryption, and other protocol-sensitive work, check the web for the current spec-compliant behavior before coding.
9. **Prefer primary sources over memory** — do not rely on stale recollection for Matrix behavior if it can be verified from current spec/docs/source.
