# PufferChat — Phase 3 Security & Encryption Plan

**Date:** 2026-03-18
**Phase:** 3 — Encryption & Security (Weeks 8-10)
**Prerequisites:** Phase 2 complete, vulnerability register current

---

## Objective

Enable full end-to-end encryption (E2EE) with device verification, key backup, and secure local storage. After Phase 3, no message content should be readable without proper cryptographic keys.

---

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│                 PufferChat                    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │         Vodozemac (Rust)             │    │
│  │  ┌─────────┐  ┌──────────────────┐   │    │
│  │  │   Olm   │  │     Megolm       │   │    │
│  │  │  (1:1)  │  │  (group rooms)   │   │    │
│  │  └─────────┘  └──────────────────┘   │    │
│  │  ┌─────────────────────────────────┐  │    │
│  │  │    Cross-Signing Keys           │  │    │
│  │  │  Master → Self-signing          │  │    │
│  │  │        → User-signing           │  │    │
│  │  └─────────────────────────────────┘  │    │
│  │  ┌─────────────────────────────────┐  │    │
│  │  │    SSSS (4S)                    │  │    │
│  │  │  Recovery key → encrypted keys  │  │    │
│  │  └─────────────────────────────────┘  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │         Key Storage                  │    │
│  │  OS Keychain: master keys, recovery  │    │
│  │  SQLite (encrypted): session keys    │    │
│  │  Memory: active ratchet state        │    │
│  │  Zeroize: all keys on drop           │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

---

## Implementation Tasks

### 3.1 — SDK Upgrade & Crypto Foundation
**Priority:** BLOCKING

1. Evaluate upgrading `matrix-sdk` from 0.10.0 → latest stable
   - Fixes RUSTSEC-2025-0065, RUSTSEC-2025-0135, RUSTSEC-2025-0041
   - May have breaking API changes — requires migration work
   - If upgrade blocked, document accepted risks and pin 0.10.0
2. Verify `e2e-encryption` feature is active (already in Cargo.toml ✅)
3. Verify Vodozemac is the crypto backend (matrix-sdk default ✅)
4. Test that encrypted room messages decrypt on sync

### 3.2 — Encrypted Room Support
1. Detect encrypted rooms in room list (already tracked: `is_encrypted` ✅)
2. Auto-enable encryption for new DM rooms
3. Show encryption status in room header (already shown: 🔒 ✅)
4. Handle `m.room.encryption` state events
5. Ensure messages in encrypted rooms go through Megolm pipeline
6. Handle UTD (Unable To Decrypt) messages with retry UI

### 3.3 — Device Verification
1. **Emoji Verification Flow**
   - Start verification request (SAS)
   - Display 7 emoji for comparison
   - Confirm/deny match
   - Exchange MAC keys
   - Mark device as verified
2. **QR Code Verification**
   - Generate QR from verification data
   - Scan QR from other device (camera or screen capture)
   - Confirm verification
3. **Verification UI**
   - Modal dialog with step-by-step flow
   - AOL-style dialog boxes for each step
   - Trust badges on verified users (✅ checkmark)
   - Unverified device warnings

### 3.4 — Cross-Signing
1. Bootstrap cross-signing keys on first login
   - Master key (identity)
   - Self-signing key (own devices)
   - User-signing key (other users)
2. Upload cross-signing keys to homeserver
3. Sign own device with self-signing key
4. Sign other users with user-signing key after verification
5. Display trust levels:
   - 🟢 Verified (cross-signed)
   - 🟡 Unverified (encrypted but not cross-signed)
   - 🔴 Blocked (user-blacklisted device)

### 3.5 — SSSS (Secure Secret Storage & Sharing)
1. Generate recovery key (or passphrase)
2. Encrypt cross-signing keys with recovery key
3. Upload encrypted secrets to homeserver (`m.secret_storage.*`)
4. Recovery flow: enter key/passphrase → decrypt secrets → restore cross-signing
5. Recovery key display with copy/save option
6. AOL-style "Save your key!" dialog on first setup

### 3.6 — Key Backup
1. Enable server-side key backup (`m.megolm_backup.v1.curve25519-aes-sha2`)
2. Automatically backup room keys after encryption
3. Restore keys from backup on new device login
4. Key backup progress indicator
5. Key export to file (encrypted JSON)
6. Key import from file

### 3.7 — Session/Device Management
1. List all devices/sessions for current user
2. Display last seen time, IP, device name
3. Rename devices
4. Delete/deactivate remote sessions
5. Show verification status per device
6. "Sign out all other devices" option

### 3.8 — Local Security Hardening
1. SQLCipher integration for local DB (already done: encrypted with keychain passphrase ✅)
2. Verify `zeroize` is applied to all crypto material in memory
3. Auto-lock with passphrase after configurable idle timeout
4. Lock screen UI (AOL "Please enter your password" style)
5. Clear clipboard after copying recovery key (timed)
6. Secure delete for message purge operations

### 3.9 — UI Indicators
1. Lock icon in room list for encrypted rooms (already done ✅)
2. Shield icon per message showing encryption status
3. "Encrypted" banner in room header for E2EE rooms
4. Warning banner for rooms with unverified devices
5. Verification prompt when new device joins encrypted room
6. UTD placeholder with "Request keys" button

---

## Threat Model

### What We Protect Against
| Threat | Protection |
|--------|-----------|
| Homeserver reading message content | Megolm E2EE — server sees ciphertext only |
| MITM on homeserver connection | TLS 1.3 + certificate validation |
| Local data theft (disk) | SQLite encrypted with keychain-stored passphrase |
| Local data theft (memory) | Zeroize on drop for all key material |
| Stolen access token | Token in OS keychain only, not in frontend |
| Device impersonation | Cross-signing + device verification |
| Key loss on device change | SSSS + server-side key backup |

### What We Do NOT Protect Against (Accepted Risks)
| Threat | Reason |
|--------|--------|
| Compromised homeserver admin spoofing senders | RUSTSEC-2025-0041 — requires HS compromise. Fix: upgrade SDK. |
| Metadata (who talks to whom, when) | Matrix protocol limitation — metadata visible to homeserver |
| OS-level keylogger/RAT | Out of scope — requires OS compromise |
| Physical access with unlocked screen | Mitigated by auto-lock timeout |
| Quantum computing attacks | Vodozemac uses classical crypto. Post-quantum migration TBD. |

---

## Testing Plan

| Test | Method | Expected |
|------|--------|----------|
| Create encrypted room | UI | Room shows 🔒, messages encrypt |
| Send/receive in encrypted room | Two clients | Messages decrypt on both sides |
| New device joins | Second login | UTD until key backup restored |
| Emoji verification | Two devices | 7 emoji match, device marked verified |
| Key backup | Enable + restore | All room keys recovered |
| Recovery key | Generate + use | Cross-signing keys restored |
| Auto-lock | Wait idle timeout | Lock screen appears |
| UTD message | Block key sharing | "Unable to decrypt" shown with retry |
| Device logout | Remote sign-out | Session invalidated, keys cleaned |
| Key export/import | Export → import on new device | Room history readable |

---

## Dependencies

- `matrix-sdk` with `e2e-encryption` feature ✅
- `vodozemac` (via matrix-sdk) ✅
- `zeroize` ✅
- `keyring` for OS keychain ✅
- QR code generation crate (TBD — `qrcode` crate)
- Camera/screen capture for QR scanning (Tauri plugin or WebRTC)

---

## Estimated Timeline

| Week | Focus |
|------|-------|
| Week 8 | SDK upgrade assessment, crypto foundation, encrypted room support |
| Week 9 | Device verification (SAS + QR), cross-signing, SSSS |
| Week 10 | Key backup, session management, auto-lock, testing |
