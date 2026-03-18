import { useState, FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../../stores/auth";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./LoginScreen.module.css";

interface LoginResponse {
  user_id: string;
  display_name: string | null;
  device_id: string;
}

export default function LoginScreen() {
  const [homeserver, setHomeserver] = useState("https://matrix.org");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showDialup, setShowDialup] = useState(false);

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
        userId: result.user_id,
        homeserver,
        displayName: result.display_name,
        deviceId: result.device_id,
      });
    } catch (err) {
      setError(String(err));
      setShowDialup(false);
    }
  }

  return (
    <div className={styles.backdrop}>
      {/* Dialup animation overlay */}
      {showDialup && !error && (
        <div className={styles.dialupOverlay}>
          <Window title="Connecting..." showMinimize={false} showMaximize={false} showClose={false} width={320}>
            <div className={styles.dialupContent}>
              <div className={styles.runningMan}>🏃</div>
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
            <div className={styles.logoTriangle}>🐡</div>
            <h1 className={styles.logoText}>PufferChat</h1>
            <p className={styles.logoTagline}>Secure Matrix Messaging</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className={styles.form}>
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
              <div className={styles.error}>
                ⚠ {error}
              </div>
            )}

            <div className={styles.actions}>
              <Button type="submit" variant="primary" size="lg" disabled={isConnecting}>
                {isConnecting ? "Signing On..." : "Sign On"}
              </Button>
            </div>

            <div className={styles.footer}>
              <p className={styles.version}>Version 0.1.0</p>
            </div>
          </form>
        </div>
      </Window>
    </div>
  );
}
