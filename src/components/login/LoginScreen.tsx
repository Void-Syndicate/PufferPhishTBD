import { useState, FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../../stores/auth";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./LoginScreen.module.css";

const DEFAULT_HOMESERVER = "https://matrix.org";

interface LoginResponse {
  userId: string;
  displayName: string | null;
  deviceId: string;
}

interface HomeserverDiscoveryResponse {
  serverName: string;
  homeserverUrl: string;
}

interface AuthIdentityProvider {
  id: string;
  name: string;
  brand: string | null;
  icon: string | null;
}

interface AuthFlowDiscoveryResponse {
  homeserverUrl: string;
  supportsPasswordLogin: boolean;
  supportsSsoLogin: boolean;
  supportsTokenLogin: boolean;
  advertisedLoginTypes: string[];
  identityProviders: AuthIdentityProvider[];
}

type AuthMode = "login" | "register";

function looksLikeMatrixId(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("@") && trimmed.includes(":");
}

function normalizeHomeserver(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function joinLabels(labels: string[]) {
  if (labels.length === 0) {
    return "";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function buildAuthStatusMessage(result: AuthFlowDiscoveryResponse) {
  const supportedMethods: string[] = [];

  if (result.supportsPasswordLogin) {
    supportedMethods.push("password sign-in");
  }
  if (result.supportsSsoLogin) {
    supportedMethods.push("browser sign-in");
  }
  if (result.supportsTokenLogin) {
    supportedMethods.push("token login");
  }

  let message = supportedMethods.length > 0
    ? `${result.homeserverUrl} supports ${joinLabels(supportedMethods)}.`
    : `${result.homeserverUrl} did not advertise any common login methods.`;

  if (result.identityProviders.length > 0) {
    message += ` Providers: ${result.identityProviders.map((provider) => provider.name).join(", ")}.`;
  }

  return message;
}

export default function LoginScreen() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [homeserver, setHomeserver] = useState(DEFAULT_HOMESERVER);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [showDialup, setShowDialup] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [homeserverEdited, setHomeserverEdited] = useState(false);
  const [authDiscovery, setAuthDiscovery] = useState<AuthFlowDiscoveryResponse | null>(null);

  const { isConnecting, error, setConnecting, setError, login } = useAuthStore();

  const isWorking = isConnecting || isDiscovering || isCheckingServer;
  const knownServerBlocksPassword = authDiscovery !== null && !authDiscovery.supportsPasswordLogin;
  const canUsePasswordSubmit = !isWorking && !knownServerBlocksPassword;
  const showBrowserButton = authDiscovery?.supportsSsoLogin ?? true;

  function switchMode(mode: AuthMode) {
    setAuthMode(mode);
    setError(null);
    setStatusMessage(null);

    if (mode === "login") {
      setConfirmPassword("");
      setRegistrationToken("");
    }
  }

  function clearServerState() {
    setStatusMessage(null);
    setAuthDiscovery(null);
  }

  async function discoverHomeserver(matrixId: string) {
    const trimmedMatrixId = matrixId.trim();

    if (!looksLikeMatrixId(trimmedMatrixId)) {
      setError("Enter a full Matrix ID like @user:example.org to discover the homeserver.");
      return null;
    }

    setError(null);
    setIsDiscovering(true);

    try {
      const result = await invoke<HomeserverDiscoveryResponse>("discover_homeserver_from_matrix_id", {
        matrixId: trimmedMatrixId,
      });

      setHomeserver(result.homeserverUrl);
      setHomeserverEdited(false);
      setStatusMessage(`Discovered ${result.homeserverUrl} from ${result.serverName}.`);
      setAuthDiscovery(null);

      return result.homeserverUrl;
    } catch (err) {
      setStatusMessage(null);
      setError(String(err));
      return null;
    } finally {
      setIsDiscovering(false);
    }
  }

  async function discoverServerAuthFlows(targetHomeserver: string) {
    const trimmedHomeserver = targetHomeserver.trim();

    if (!trimmedHomeserver) {
      setError("Homeserver URL is required.");
      return null;
    }

    setError(null);
    setIsCheckingServer(true);

    try {
      const result = await invoke<AuthFlowDiscoveryResponse>("discover_auth_flows", {
        homeserver: trimmedHomeserver,
      });

      setHomeserver(result.homeserverUrl);
      setHomeserverEdited(false);
      setAuthDiscovery(result);
      setStatusMessage(buildAuthStatusMessage(result));

      return result;
    } catch (err) {
      setAuthDiscovery(null);
      setStatusMessage(null);
      setError(String(err));
      return null;
    } finally {
      setIsCheckingServer(false);
    }
  }

  async function ensureAuthDiscovery(targetHomeserver: string) {
    if (
      authDiscovery
      && normalizeHomeserver(authDiscovery.homeserverUrl) === normalizeHomeserver(targetHomeserver)
    ) {
      return authDiscovery;
    }

    return discoverServerAuthFlows(targetHomeserver);
  }

  async function resolveHomeserverForAuth() {
    let resolvedHomeserver = homeserver.trim();
    const trimmedUsername = username.trim();

    if (
      authMode === "login"
      && looksLikeMatrixId(trimmedUsername)
      && (!homeserverEdited || !resolvedHomeserver || resolvedHomeserver === DEFAULT_HOMESERVER)
    ) {
      const discoveredHomeserver = await discoverHomeserver(trimmedUsername);

      if (!discoveredHomeserver) {
        return null;
      }

      resolvedHomeserver = discoveredHomeserver;
    }

    if (!resolvedHomeserver) {
      setError("Homeserver URL is required.");
      return null;
    }

    return resolvedHomeserver;
  }

  async function handleDiscoverClick() {
    await discoverHomeserver(username);
  }

  async function handleCheckServerClick() {
    const resolvedHomeserver = await resolveHomeserverForAuth();

    if (!resolvedHomeserver) {
      return;
    }

    await discoverServerAuthFlows(resolvedHomeserver);
  }

  async function completeLogin(result: LoginResponse, resolvedHomeserver: string) {
    login({
      userId: result.userId,
      homeserver: resolvedHomeserver,
      displayName: result.displayName,
      deviceId: result.deviceId,
    });
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();

    if (!username.trim() || !password) {
      setError("Screen name and password are required.");
      return;
    }

    const resolvedHomeserver = await resolveHomeserverForAuth();

    if (!resolvedHomeserver) {
      return;
    }

    const discovery = await ensureAuthDiscovery(resolvedHomeserver);

    if (!discovery) {
      return;
    }

    if (!discovery.supportsPasswordLogin && discovery.supportsSsoLogin) {
      setError("This homeserver advertises browser-based sign-in. Use Continue in Browser instead.");
      return;
    }

    setConnecting(true);
    setShowDialup(true);

    try {
      const result = await invoke<LoginResponse>("matrix_login", {
        homeserver: resolvedHomeserver,
        username: username.trim(),
        password,
      });

      await completeLogin(result, resolvedHomeserver);
    } catch (err) {
      setError(String(err));
      setShowDialup(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const resolvedHomeserver = homeserver.trim();

    if (!trimmedUsername || !password) {
      setError("Username and password are required.");
      return;
    }

    if (trimmedUsername.startsWith("@") || trimmedUsername.includes(":")) {
      setError("Use only the username part for new accounts, like puffer.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!resolvedHomeserver) {
      setError("Homeserver URL is required.");
      return;
    }

    const discovery = await ensureAuthDiscovery(resolvedHomeserver);

    if (!discovery) {
      return;
    }

    if (!discovery.supportsPasswordLogin && discovery.supportsSsoLogin) {
      setError("This homeserver uses browser-based auth. Use Continue in Browser instead.");
      return;
    }

    setConnecting(true);
    setShowDialup(true);

    try {
      const result = await invoke<LoginResponse>("matrix_register", {
        homeserver: resolvedHomeserver,
        username: trimmedUsername,
        password,
        registrationToken: registrationToken.trim() || null,
      });

      await completeLogin(result, resolvedHomeserver);
    } catch (err) {
      setError(String(err));
      setShowDialup(false);
    }
  }

  async function handleBrowserLogin(identityProviderId?: string) {
    const resolvedHomeserver = await resolveHomeserverForAuth();

    if (!resolvedHomeserver) {
      return;
    }

    const discovery = await ensureAuthDiscovery(resolvedHomeserver);

    if (!discovery) {
      return;
    }

    if (!discovery.supportsSsoLogin) {
      setError("This homeserver does not advertise browser-based sign-in.");
      return;
    }

    setError(null);
    setConnecting(true);
    setShowDialup(true);

    try {
      const result = await invoke<LoginResponse>("matrix_login_sso", {
        homeserver: resolvedHomeserver,
        identityProviderId: identityProviderId ?? null,
      });

      await completeLogin(result, resolvedHomeserver);
    } catch (err) {
      setError(String(err));
      setShowDialup(false);
    }
  }

  return (
    <div className={styles.backdrop} role="main" aria-label="Login screen">
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

      <Window
        title="PufferChat Sign On"
        width={420}
        showMinimize={false}
        showMaximize={false}
        showClose={false}
      >
        <div className={styles.loginContainer}>
          <div className={styles.logoArea}>
            <div className={styles.logoTriangle}>{"\uD83D\uDC21"}</div>
            <h1 className={styles.logoText}>PufferChat</h1>
            <p className={styles.logoTagline}>Secure Matrix Messaging</p>
          </div>

          <div className={styles.modeToggle} role="tablist" aria-label="Authentication mode">
            <Button
              type="button"
              size="sm"
              className={`${styles.modeButton} ${authMode === "login" ? styles.modeButtonActive : ""}`}
              onClick={() => switchMode("login")}
              aria-pressed={authMode === "login"}
            >
              Sign In
            </Button>
            <Button
              type="button"
              size="sm"
              className={`${styles.modeButton} ${authMode === "register" ? styles.modeButtonActive : ""}`}
              onClick={() => switchMode("register")}
              aria-pressed={authMode === "register"}
            >
              Create Account
            </Button>
          </div>

          <form
            onSubmit={authMode === "login" ? handleLogin : handleRegister}
            className={styles.form}
            aria-label={authMode === "login" ? "Login form" : "Registration form"}
          >
            <div className={styles.discoveryRow}>
              <TextInput
                className={styles.discoveryInput}
                label="Homeserver"
                value={homeserver}
                onChange={(e) => {
                  setHomeserver(e.target.value);
                  setHomeserverEdited(true);
                  clearServerState();
                  setError(null);
                }}
                placeholder="https://matrix.org"
                disabled={isWorking}
              />
              <Button
                type="button"
                size="sm"
                className={styles.discoveryButton}
                onClick={() => { void handleDiscoverClick(); }}
                disabled={isWorking || authMode !== "login" || !looksLikeMatrixId(username)}
              >
                {isDiscovering ? "..." : "Discover"}
              </Button>
            </div>

            <div className={styles.discoveryHint}>
              {authMode === "login"
                ? "Enter a full Matrix ID like @user:example.org to auto-find the right homeserver."
                : "Create accounts with a localpart like puffer. Some servers may require a registration token or browser sign-in."}
            </div>

            <div className={styles.secondaryActions}>
              <Button
                type="button"
                size="sm"
                onClick={() => { void handleCheckServerClick(); }}
                disabled={isWorking}
              >
                {isCheckingServer ? "Checking..." : "Check Server"}
              </Button>

              {showBrowserButton && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => { void handleBrowserLogin(); }}
                  disabled={isWorking}
                >
                  Continue in Browser
                </Button>
              )}
            </div>

            <TextInput
              label={authMode === "login" ? "Screen Name" : "Username"}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setStatusMessage(null);
                setError(null);
              }}
              placeholder={authMode === "login" ? "@user:matrix.org" : "puffer"}
              disabled={isWorking}
              autoFocus
            />

            <TextInput
              label={authMode === "login" ? "Password" : "Choose Password"}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isWorking}
            />

            {authMode === "register" && (
              <TextInput
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isWorking}
              />
            )}

            {authMode === "register" && (
              <TextInput
                label="Registration Token (Optional)"
                value={registrationToken}
                onChange={(e) => setRegistrationToken(e.target.value)}
                placeholder="Only needed on some servers"
                disabled={isWorking}
              />
            )}

            {error && (
              <div className={styles.error} role="alert" aria-live="assertive">
                {"\u26A0"} {error}
              </div>
            )}

            {statusMessage && !error && (
              <div className={styles.discoveryNote} role="status" aria-live="polite">
                {statusMessage}
              </div>
            )}

            {authDiscovery?.supportsSsoLogin && authDiscovery.identityProviders.length > 0 && (
              <div className={styles.browserProviders}>
                {authDiscovery.identityProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    type="button"
                    size="sm"
                    className={styles.browserProviderButton}
                    onClick={() => { void handleBrowserLogin(provider.id); }}
                    disabled={isWorking}
                  >
                    Continue with {provider.name}
                  </Button>
                ))}
              </div>
            )}

            {knownServerBlocksPassword && authDiscovery?.supportsSsoLogin && (
              <div className={styles.discoveryHint}>
                This server advertises browser-based auth instead of password sign-in.
              </div>
            )}

            <div className={styles.actions}>
              <Button type="submit" variant="primary" size="lg" disabled={!canUsePasswordSubmit}>
                {isConnecting
                  ? authMode === "login" ? "Signing On..." : "Creating Account..."
                  : authMode === "login" ? "Sign On" : "Create Account"}
              </Button>
            </div>

            <div className={styles.footer}>
              <p className={styles.version}>Version 1.0.0</p>
            </div>
          </form>
        </div>
      </Window>
    </div>
  );
}
