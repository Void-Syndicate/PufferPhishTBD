import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "./stores/auth";
import LoginScreen from "./components/login/LoginScreen";
import MainShell from "./components/shell/MainShell";

interface LoginResponse {
  userId: string;
  displayName: string | null;
  deviceId: string;
}

function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const login = useAuthStore((s) => s.login);
  const [checking, setChecking] = useState(true);

  // Try to restore saved session on startup
  useEffect(() => {
    async function tryRestore() {
      try {
        const result = await invoke<LoginResponse | null>("restore_session");
        if (result) {
          login({
            userId: result.userId,
            homeserver: "", // restored server-side
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
  }, []);

  if (checking) {
    return (
      <div className="aol-app" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#008080" }}>
        <div style={{ color: "white", fontFamily: "monospace", fontSize: "18px" }}>
          🐡 Restoring session...
        </div>
      </div>
    );
  }

  return (
    <div className="aol-app">
      {isLoggedIn ? <MainShell /> : <LoginScreen />}
    </div>
  );
}

export default App;
