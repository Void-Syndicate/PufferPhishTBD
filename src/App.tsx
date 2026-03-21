import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "./stores/auth";
import { useEncryptionStore } from "./stores/encryption";
import { useEncryption } from "./hooks/useEncryption";
import LoginScreen from "./components/login/LoginScreen";
import MainShell from "./components/shell/MainShell";
import LockScreen from "./components/security/LockScreen";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { SkipNavLink } from "./components/accessibility/SkipNavLink";
import "./themes/aol-dark/dark.css";

interface LoginResponse {
  userId: string;
  displayName: string | null;
  deviceId: string;
}

function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const login = useAuthStore((s) => s.login);
  const [checking, setChecking] = useState(true);

  const isLocked = useEncryptionStore((s) => s.isLocked);
  const autoLockEnabled = useEncryptionStore((s) => s.autoLockEnabled);
  const { checkLockState } = useEncryption();

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem("pufferchat_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  // Try to restore saved session on startup (with frontend timeout safety)
  useEffect(() => {
    async function tryRestore() {
      try {
        const timeout = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("Session restore timed out")), 20000)
        );
        const result = await Promise.race([
          invoke<LoginResponse | null>("restore_session"),
          timeout,
        ]);
        if (result) {
          login({
            userId: result.userId,
            homeserver: "",
            displayName: result.displayName,
            deviceId: result.deviceId,
          });
        }
      } catch (err) {
        console.error("Session restore failed:", err);
      } finally {
        setChecking(false);
      }
    }
    tryRestore();
  }, [login]);

  // Check lock state after login
  useEffect(() => {
    if (isLoggedIn) {
      checkLockState();
    }
  }, [isLoggedIn, checkLockState]);

  // Run integrity check on startup
  useEffect(() => {
    if (isLoggedIn) {
      invoke("check_integrity")
        .then((report: unknown) => {
          const r = report as { databaseOk: boolean; cryptoKeysOk: boolean; issues: string[] };
          if (!r.databaseOk || !r.cryptoKeysOk) {
            console.warn("Integrity issues detected:", r.issues);
          }
        })
        .catch(() => {});
    }
  }, [isLoggedIn]);

  if (checking) {
    return (
      <div className="aol-app" role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#008080" }}>
        <div style={{ color: "white", fontFamily: "monospace", fontSize: "18px" }}>
          {"\u231B"} Restoring session...
        </div>
      </div>
    );
  }

  // Show lock screen if logged in and locked
  if (isLoggedIn && autoLockEnabled && isLocked) {
    return (
      <ErrorBoundary>
        <div className="aol-app">
          <LockScreen onUnlocked={() => useEncryptionStore.getState().setIsLocked(false)} />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="aol-app">
        <SkipNavLink targetId="main-content" label="Skip to main content" />
        {isLoggedIn ? <MainShell /> : <LoginScreen />}
      </div>
    </ErrorBoundary>
  );
}

export default App;
