import { useState, FormEvent, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../../stores/auth";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./LoginScreen.module.css";

const SsoLogin = lazy(() => import("./SsoLogin"));

interface LoginResponse {
  userId: string;
  displayName: string | null;
  deviceId: string;
}

export default function LoginScreen() {
  const [homeserver, setHomeserver] = useState("https://matrix.org");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showDialup, setShowDialup] = useState(false);
  const [showSso, setShowSso] = useState(false);

  const { isConnecting, error, setConnecting, setError, login } = useAuthStore();

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      setError("Screen name and password are required.");
      return;
    }

    setConnecting(true);
    setShowDialup(true);

    try {
      const result = await invoke<LoginResponse>("matrix_login", {
        homeserver,
        username,
        password,
      });

      login({
        userId: result.userId,
        homeserver,
        displayName: result.displayName,
        deviceId: result.deviceId,
      });
    } catch (err) {
      setError(String(err));
      setShowDialup(false);
    }
  }

  return (
    <div className={styles.backdrop} role="main" aria-label="Login screen">
      {/* Dialup animation overlay */}
      {showDialup && !error && (
        <div className={styles.dialupOverlay} role="status" aria-live="polite" aria-label="Connecting">
          <Window title="Connecting..." showMinimize={false} showMaximize={false} showClose={false} width={320}>
            <div className={styles.dialupContent}>
              <div className={styles.runningMan}>{"\uD83D\uDC21"}</div>
              <div className={styles.dialupSteps}>
                <p className={styles.stepActive}>Connecting to homeserver...</p>
                <p>Authenticating...</p>
                <p>Loading rooms...</p>
              </div>
              <div className={styles.dialupProgress}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} />
                </div>
              </div>
              <Button onClick={() => { setShowDialup(false); setConnecting(false); }} size="sm">
                Cancel
              </Button>
            </div>
          </Window>
        </div>
      )}

      {/* Main Sign-On Window */}
      <Window
        title="PufferChat Sign On"
        width={420}
        showMinimize={false}
        showMaximize={false}
        showClose={false}
      >
        <div className={styles.loginContainer}>
          {/* AOL Triangle Logo Area */}
          <div className={styles.logoArea}>
            <div className={styles.logoTriangle}>{"\uD83D\uDC21"}</div>
            <h1 className={styles.logoText}>PufferChat</h1>
            <p className={styles.logoTagline}>Secure Matrix Messaging</p>
          </div>

          {showSso ? (
            <Suspense fallback={<div style={{ textAlign: "center", padding: 16 }}>{"\u231B"} Loading SSO...</div>}>
              <SsoLogin homeserver={homeserver} onBack={() => setShowSso(false)} />
            </Suspense>
          ) : (
            /* Login Form */
            <form onSubmit={handleLogin} className={styles.form} aria-label="Login form">
              <TextInput
                label="Homeserver"
                value={homeserver}
                onChange={(e) => setHomeserver(e.target.value)}
                placeholder="https://matrix.org"
                disabled={isConnecting}
              />

              <TextInput
                label="Screen Name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@user:matrix.org"
                disabled={isConnecting}
                autoFocus
              />

              <TextInput
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isConnecting}
              />

              {error && (
                <div className={styles.error} role="alert" aria-live="assertive">
                  {"\u26A0"} {error}
                </div>
              )}

              <div className={styles.actions}>
                <Button type="submit" variant="primary" size="lg" disabled={isConnecting}>
                  {isConnecting ? "Signing On..." : "Sign On"}
                </Button>
              </div>

              <div style={{ textAlign: "center", margin: "8px 0" }}>
                <button
                  type="button"
                  onClick={() => setShowSso(true)}
                  aria-label="Sign in with SSO"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--chat-link, #0000FF)",
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontFamily: "var(--font-system)",
                    fontSize: 11,
                  }}
                >
                  {"\uD83D\uDD11"} Sign in with SSO
                </button>
              </div>

              <div className={styles.footer}>
                <p className={styles.version}>Version 1.0.0</p>
              </div>
            </form>
          )}
        </div>
      </Window>
    </div>
  );
}
