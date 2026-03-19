# PufferChat Phase 2 — Completion & Hardening Plan

**Date:** 2026-03-18
**Goal:** Complete all Phase 2 features, document everything, prepare for Phase 3 (Encryption)

---

## Work Packages

### WP-1: Sound Effects Engine (AOL Sounds)
**Priority:** HIGH | **Complexity:** MEDIUM

- Create `src/audio/SoundEngine.ts` — singleton manager for all app sounds
- Sound events: `message-received`, `message-sent`, `door-open` (user joins), `door-close` (user leaves), `welcome` (login success), `notification`
- Settings: global mute, per-sound enable/disable, volume control
- Store sound preferences in localStorage via Zustand persist
- Use Web Audio API for low-latency playback
- Ship placeholder sounds (generate with simple tones), document where to drop AOL `.wav` files
- Add sound settings panel accessible from toolbar ⚙️ Setup button
- Wire into: `useMatrixEvents` (message received), `LoginScreen` (welcome), `MessageComposer` (sent)

### WP-2: OS Desktop Notifications
**Priority:** HIGH | **Complexity:** LOW

- Install `@tauri-apps/plugin-notification` 
- Add notification permission request on first launch
- Trigger notifications on: new messages (when window unfocused), mentions, DMs
- Notification content: sender name + message preview (truncated)
- Respect room notification settings (WP-4)
- Add Tauri notification plugin to `tauri.conf.json` capabilities

### WP-3: Live Room List Updates
**Priority:** HIGH | **Complexity:** MEDIUM

- Currently room list only loads once at startup
- Add periodic room refresh (poll `get_rooms` every 30s)
- Also refresh on sync events — emit `matrix://room-list-update` from Rust when rooms change
- Update unread counts in real-time from sync responses
- Increment unread count in Zustand on new timeline messages for non-selected rooms
- Clear unread on room select (already sends read receipt)

### WP-4: Room Notification Settings
**Priority:** MEDIUM | **Complexity:** MEDIUM

- Per-room notification level: `all` | `mentions` | `mute`
- Store in localStorage (Zustand persist) — keyed by room_id
- Create `stores/settings.ts` for app-wide and per-room settings
- Add UI: right-click room in BuddyList → notification setting
- Filter OS notifications based on room setting
- Filter sound effects based on room setting

### WP-5: Message Search
**Priority:** MEDIUM | **Complexity:** HIGH

- **Local search:** Filter loaded messages in Zustand (instant, client-side)
- **Server search:** Add `search_messages` Tauri command using Matrix `/search` API
- Add search bar component in ChatView header
- Search results displayed inline with highlight
- Keyboard shortcut: Ctrl+F

### WP-6: Room List Refresh on New Messages
**Priority:** HIGH | **Complexity:** LOW

- In `useMatrixEvents`, when a timeline event arrives for a room that isn't selected:
  - Increment that room's `unreadCount` in the rooms store
  - Update `lastMessage` and `lastMessageTimestamp`
- Re-sort room list by activity

### WP-7: Documentation & Phase 3 Prep
**Priority:** HIGH | **Complexity:** MEDIUM

- Update `CHANGELOG.md` with all Phase 2 work
- Write `docs/PHASE2-VERIFICATION.md` — test matrix for every feature
- Write `docs/PHASE3-SECURITY-PLAN.md` — encryption implementation plan
- Write `docs/VULNERABILITY-MANAGEMENT.md` — process for tracking and fixing vulns
- Update `PROJECT.md` phase status
- Run `npm audit` and `cargo audit` — document results
- Create vulnerability register with current known issues

---

## Deployment Order

1. **WP-3 + WP-6** (Live room updates + unread counts) — foundational for UX
2. **WP-1** (Sound effects) — core AOL identity
3. **WP-2** (OS notifications) — requires Tauri plugin
4. **WP-4** (Room notification settings) — depends on WP-2
5. **WP-5** (Message search) — independent
6. **WP-7** (Documentation) — after all features complete

---

## Test Matrix (Pre-Phase 3 Gate)

| Test | Expected Result | Status |
|------|----------------|--------|
| Login with valid credentials | AOL dialup animation → room list loads | ⬜ |
| Login with bad password | Error displayed, no crash | ⬜ |
| Session restore on restart | Auto-login, room list loads | ⬜ |
| Logout and re-login | Clean state, new session | ⬜ |
| Send text message | Appears in timeline immediately | ⬜ |
| Receive text message | Appears in timeline, sound plays, unread updates | ⬜ |
| Reply to message | Reply indicator shown, threaded correctly | ⬜ |
| Edit own message | Inline edit, "edited" badge appears | ⬜ |
| Delete own message | Message shows "[deleted]" | ⬜ |
| Send reaction | Emoji appears under message | ⬜ |
| Typing indicator | Shows when other user types | ⬜ |
| Read receipts | Sent on room view, received for others | ⬜ |
| Scroll up for history | Older messages load (pagination) | ⬜ |
| Room switch | Correct messages load, composer resets | ⬜ |
| Unread badges | Increment on new messages, clear on view | ⬜ |
| Room list sort | Most active rooms rise to top | ⬜ |
| Sound on message | AOL chime plays (when enabled) | ⬜ |
| Sound mute | No sound when muted | ⬜ |
| OS notification | Desktop notification when unfocused | ⬜ |
| Room mute | No notification or sound for muted room | ⬜ |
| Message search | Finds messages by keyword | ⬜ |
| Context menu | Reply/Edit/React/Delete all functional | ⬜ |
| XSS test | `<script>alert(1)</script>` in message body — no execution | ⬜ |
| Long message | 65536 char limit enforced, no UI break | ⬜ |
| Network disconnect | Sync retries, UI shows disconnected state | ⬜ |

---

## Phase 3 Security Prerequisites

Before starting encryption work:
1. ✅ All Phase 2 features stable
2. ✅ XSS sanitization (DOMPurify) — DONE
3. ✅ Token never in frontend state — DONE
4. ✅ DB encryption with keychain passphrase — DONE
5. ✅ CSP hardened — DONE
6. ⬜ npm audit clean
7. ⬜ cargo audit documented (known upstream issues)
8. ⬜ Vulnerability management process documented
9. ⬜ All test matrix items pass
