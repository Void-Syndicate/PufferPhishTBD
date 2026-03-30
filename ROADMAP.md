# PufferChat Roadmap

Updated: 2026-03-29

This roadmap is ordered from the most important work to ship first down to the work that can wait. The intent is simple: cross off items from top to bottom, and avoid jumping into polish before the Matrix desktop baseline feels complete.

Notes:
- This list is based on the current codebase plus a Matrix client feature gap audit.
- Some items already have partial implementation in the repo; those should be finished before starting net-new features.
- If a higher section is still mostly unchecked, do not treat lower sections as the main focus.

## First

### Auth and onboarding
- [ ] Add homeserver discovery from Matrix IDs and `/.well-known/matrix/client`
- [ ] Replace the hardcoded login default with a real server picker
- [ ] Add recent homeservers and sensible presets
- [ ] Add account registration / sign-up flow
- [ ] Add supported-login-flow discovery before rendering auth options
- [ ] Add SSO / OIDC / MAS login flow
- [ ] Improve login errors for bad server config, unsupported auth, and rate limits

### Safety and moderation baseline
- [ ] Add ignore / block user support backed by `m.ignored_user_list`
- [ ] Add report message flow
- [ ] Add report room flow
- [ ] Add report user flow
- [ ] Add basic safety actions to message and member context menus

### Discovery and joining
- [ ] Add room preview before join
- [ ] Add knock support for knockable rooms
- [ ] Add better public room directory filters
- [ ] Add room alias and permalink handling throughout the app
- [ ] Add people search for starting DMs and inviting users
- [ ] Replace raw-ID-only invite flow with searchable invite UX

### Product honesty
- [ ] Reconcile README / PROJECT feature claims with what is actually shipped while roadmap work is in progress

## Next

### Notifications
- [ ] Add per-room notification settings: all, mentions only, mute
- [ ] Add Matrix push rule management UI
- [ ] Add unread and mention count parity across room list, title bar, and app badges
- [ ] Add richer desktop notification behavior for replies, mentions, and DMs
- [ ] Add notification troubleshooting and permission diagnostics

### Search
- [ ] Upgrade search from local timeline scanning to hybrid local + server-side Matrix search
- [ ] Add cross-room search UI
- [ ] Add search filters for room, sender, and date
- [ ] Add better result navigation and context jumping

### Threads
- [ ] Add true thread timeline support
- [ ] Add thread composer and reply targeting UX
- [ ] Add thread list / thread preview UI
- [ ] Add unread state and receipts for threaded conversations

## Later

### Account and device quality
- [ ] Polish device management so sessions, trust state, and current device are easy to understand
- [ ] Improve cross-signing onboarding and recovery language
- [ ] Add QR-based login / device transfer if feasible with chosen auth path
- [ ] Add smoother multi-account switching UX

### Rooms and spaces
- [ ] Finish spaces UX polish for larger hierarchies
- [ ] Add better room creation presets and sensible defaults
- [ ] Add canonical alias management UI
- [ ] Add stronger room settings coverage for join rules, history visibility, and discoverability
- [ ] Add moderation policy list tooling if you want stronger community admin support

### Messaging completion
- [ ] Review poll support and add first-class UI if plugin-only behavior is not enough
- [ ] Review widget UX and add clearer permission / trust prompts
- [ ] Improve permalink, quote, and share flows
- [ ] Add better media sending and browsing polish where current flows feel raw

### Calls
- [ ] Review current VoIP implementation against real-world Matrix call expectations
- [ ] Add call setup diagnostics for TURN / media failures
- [ ] Improve in-call UX, device switching, and reconnect states
- [ ] Revisit group call strategy and decide on MatrixRTC vs bridge-first approach

## Last

### Performance and protocol depth
- [ ] Investigate faster initial sync strategies such as Sliding Sync or equivalent SDK support
- [ ] Add more resilient offline cache and cache repair tooling
- [ ] Add large-account performance profiling and timeline stress testing

### Advanced ecosystem work
- [ ] Expand third-party network and bridge discovery only after core Matrix UX is solid
- [ ] Expand plugin and widget ecosystem features only after trust and permission UX is mature
- [ ] Add advanced admin tooling for power users and homeserver operators

### Nice-to-have polish
- [ ] Add more onboarding polish, demos, and first-run helpers
- [ ] Add higher-fidelity room and member cards
- [ ] Add extra retro presentation touches only after functional gaps are closed

## Already in Good Shape

These areas appear to have meaningful implementation already and should generally be refined, not restarted:
- End-to-end encryption foundation
- Device verification and key backup foundation
- Presence, typing indicators, and read receipts
- Spaces foundation
- Public room directory foundation
- Native packaging and release automation
