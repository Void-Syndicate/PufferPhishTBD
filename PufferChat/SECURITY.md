# PufferChat — DevSecOps Security Documentation

## Security Architecture Overview

### Threat Model

**Assets:**
- User credentials (Matrix access tokens, passwords)
- Encryption keys (Olm/Megolm session keys, cross-signing keys, SSSS keys)
- Message content (plaintext of E2EE messages)
- User metadata (room membership, presence, contacts)
- Local database (message cache, search index)

**Threat Actors:**
1. **Network Adversary** — MitM on homeserver connection, DNS hijack
2. **Compromised Homeserver** — Malicious server operator reading metadata
3. **Local Attacker** — Physical/malware access to user's machine
4. **Malicious Plugin** — Third-party plugin attempting data exfiltration
5. **Supply Chain** — Compromised dependency in Rust/npm ecosystem

**Trust Boundaries:**
```
[User Input] → [React Frontend] → [Tauri IPC] → [Rust Backend] → [Matrix Homeserver]
                     ↕                                ↕
              [Plugin Sandbox]                 [Local SQLCipher DB]
                                               [OS Keychain]
```

---

## Security Controls by Layer

### 1. Network Layer

| Control | Implementation | Status |
|---------|---------------|--------|
| TLS 1.3 minimum | matrix-rust-sdk reqwest config | Phase 1 |
| Certificate pinning | Custom TLS verifier (optional, user-configurable) | Phase 8 |
| No plaintext fallback | Reject non-HTTPS homeserver URLs | Phase 1 |
| Tor/SOCKS5 proxy | reqwest proxy configuration | Phase 8 |
| DNS-over-HTTPS | Trust-dns with DoH resolver | Phase 8 |
| User-Agent anonymization | Generic UA string, no version fingerprint | Phase 1 |

**Vuln Testing Checklist:**
- [ ] Verify TLS 1.3 enforcement (attempt TLS 1.2 downgrade)
- [ ] Test with self-signed cert (should reject)
- [ ] MitM proxy test (Burp/mitmproxy) — verify cert validation
- [ ] DNS rebinding attack test
- [ ] Verify no plaintext HTTP requests leak
- [ ] Check for hardcoded hostnames/IPs

### 2. Application Layer — Rust Backend

| Control | Implementation | Status |
|---------|---------------|--------|
| Input validation | All IPC commands validate input types/bounds | Phase 1 |
| Error handling | No panics in production; thiserror/anyhow | Phase 1 |
| Memory safety | Rust ownership model + no unsafe blocks (audit) | Ongoing |
| Crypto material zeroization | zeroize crate on all key types | Phase 3 |
| No secret logging | Log filter strips tokens/keys from output | Phase 1 |
| Command injection prevention | No shell exec from user input | Phase 1 |

**Vuln Testing Checklist:**
- [ ] Fuzz all Tauri IPC commands with malformed inputs
- [ ] Memory analysis — verify key material zeroed after use
- [ ] Audit all `unsafe` blocks (should be zero in our code)
- [ ] Check for TOCTOU races in file operations
- [ ] Verify no secrets in log output (grep logs for token patterns)
- [ ] Test integer overflow/underflow in pagination params
- [ ] Dependency audit: `cargo audit` + `cargo deny`

### 3. Application Layer — React Frontend

| Control | Implementation | Status |
|---------|---------------|--------|
| XSS prevention | React's default escaping + sanitize HTML messages | Phase 2 |
| CSP headers | Strict Content-Security-Policy in Tauri config | Phase 1 |
| No eval() | CSP blocks eval, no dynamic code execution | Phase 1 |
| Iframe sandboxing | Plugins in sandboxed iframes, no parent access | Phase 7 |
| No external resource loading | All assets bundled, no CDN | Phase 1 |
| Link sanitization | Validate/warn on external links before opening | Phase 2 |

**Vuln Testing Checklist:**
- [ ] XSS via Matrix message content (HTML subset injection)
- [ ] XSS via room name/topic/user display name
- [ ] CSP bypass attempts
- [ ] Prototype pollution via IPC response parsing
- [ ] DOM clobbering tests
- [ ] Click-jacking via iframe embedding (should be blocked)
- [ ] Test plugin sandbox escape attempts

### 4. Cryptographic Layer

| Control | Implementation | Status |
|---------|---------------|--------|
| E2EE (Megolm/Olm) | Vodozemac via matrix-rust-sdk | Phase 3 |
| Cross-signing | matrix-rust-sdk cross-signing API | Phase 3 |
| Key backup | SSSS with user-chosen recovery key | Phase 3 |
| Forward secrecy | Megolm ratchet (100 msgs / 1 week) | Phase 3 |
| Device verification | Emoji + QR code comparison | Phase 3 |
| Local DB encryption | SQLCipher (AES-256-CBC) | Phase 3 |

**Vuln Testing Checklist:**
- [ ] Verify encryption is enabled by default for new rooms
- [ ] Test key backup encryption (recovery key entropy)
- [ ] Attempt to read SQLCipher DB without passphrase
- [ ] Verify Megolm session rotation occurs on schedule
- [ ] Test device verification flow — can unverified device read messages?
- [ ] Key export file — verify it's encrypted
- [ ] Brute force test on DB passphrase (timing analysis)

### 5. Local Storage & Secrets

| Control | Implementation | Status |
|---------|---------------|--------|
| OS Keychain | keyring-rs (Win Credential Manager, macOS Keychain, libsecret) | Phase 1 |
| No plaintext secrets | Tokens/keys never written to plaintext files | Phase 1 |
| Secure delete | Overwrite before delete for sensitive files | Phase 3 |
| Auto-lock | Passphrase required after idle timeout | Phase 3 |
| File permissions | Restrict DB file to user-only (0600 on *nix) | Phase 1 |

**Vuln Testing Checklist:**
- [ ] Verify tokens not in plaintext config files
- [ ] Check Windows Credential Manager entries are properly scoped
- [ ] Memory dump analysis — search for tokens/keys in process memory
- [ ] Verify file permissions on SQLite DB and config files
- [ ] Test auto-lock actually clears sensitive data from memory
- [ ] Check temp files for leaked secrets
- [ ] Verify secure delete actually overwrites (not just unlink)

### 6. Plugin Security

| Control | Implementation | Status |
|---------|---------------|--------|
| Iframe sandbox | `sandbox="allow-scripts"` only | Phase 7 |
| Message passing API | Structured clone, no direct DOM access | Phase 7 |
| Permission system | Plugins declare required permissions | Phase 7 |
| No network access | Plugins cannot make HTTP requests directly | Phase 7 |
| No filesystem access | Plugins have no Tauri API access | Phase 7 |
| Content Security Policy | Per-plugin CSP enforcement | Phase 7 |

**Vuln Testing Checklist:**
- [ ] Sandbox escape via prototype pollution
- [ ] postMessage origin validation
- [ ] Plugin attempting to access parent frame
- [ ] Plugin attempting to invoke Tauri commands
- [ ] Resource exhaustion (CPU/memory) from malicious plugin
- [ ] Plugin attempting to read other plugins' data

---

## Dependency Security

### Rust Dependencies
```bash
# Run before every release
cargo audit                    # Known vulnerability check
cargo deny check               # License + advisory check
cargo tree --duplicates        # Duplicate dependency detection
cargo geiger                   # Unsafe code detection
```

### Node.js Dependencies
```bash
# Run before every release
npm audit                      # Known vulnerability check
npx license-checker            # License compliance
npx depcheck                   # Unused dependency detection
```

### Supply Chain Hardening
- [ ] Pin all dependency versions (Cargo.lock + package-lock.json committed)
- [ ] Enable Dependabot / Renovate for automated updates
- [ ] Review all new dependencies before adding (min 1000 downloads, active maintenance)
- [ ] Verify crate/package checksums in CI
- [ ] Use `cargo vet` for Rust supply chain auditing

---

## CI/CD Security Pipeline

```yaml
# Planned GitHub Actions pipeline
security-checks:
  - cargo audit          # Rust CVE check
  - cargo deny check     # License + advisory
  - cargo clippy         # Lint for common mistakes
  - npm audit            # Node CVE check
  - cargo test           # Unit + integration tests
  - SAST scan            # Semgrep or similar
  - Binary signing       # Code signing for releases
```

### Release Security
- [ ] All releases are code-signed (Windows Authenticode, macOS notarization)
- [ ] Reproducible builds (same source → same binary)
- [ ] Release checksums published (SHA256)
- [ ] Auto-updater verifies signature before applying update
- [ ] GitHub Actions — no third-party actions without hash pinning

---

## Incident Response

### If a vulnerability is found:
1. **Assess severity** (CVSS score)
2. **Patch and test** in private branch
3. **Release hotfix** with security advisory
4. **Notify users** via in-app update prompt
5. **Post-mortem** documented in `docs/security/`

### Responsible Disclosure
- Security issues: report via GitHub Security Advisories (private)
- PGP key for encrypted reports: _(TBD — generate before v1.0)_
- Response SLA: acknowledge within 48 hours

---

## Compliance & Privacy

- **GDPR:** No data collection, all data local. User can delete all data by removing app.
- **No telemetry:** Zero analytics, zero crash reporting (unless explicit opt-in)
- **No CDN:** All assets bundled. No requests to third-party servers.
- **Minimal metadata:** User-agent is generic. No version fingerprinting.
- **Data portability:** Key export, message export planned for Phase 8.

---

## Security Audit Schedule

| Milestone | Audit Type | Scope |
|-----------|-----------|-------|
| Phase 1 complete | Dependency audit | `cargo audit`, `npm audit` |
| Phase 3 complete | Crypto review | E2EE implementation, key management |
| Phase 7 complete | Plugin sandbox audit | Escape testing, permission bypass |
| Pre-v1.0 | Full security audit | All layers, penetration test |
| Post-v1.0 | Ongoing | Quarterly dependency audits, annual pen test |
