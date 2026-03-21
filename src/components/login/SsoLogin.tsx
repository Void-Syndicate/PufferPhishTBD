import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";

interface SsoProvider {
  id: string;
  name: string;
  icon: string | null;
  brand: string | null;
}

interface Props {
  homeserver: string;
  onBack: () => void;
}

export default function SsoLogin({ homeserver, onBack }: Props) {
  const [providers, setProviders] = useState<SsoProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waitingForCallback, setWaitingForCallback] = useState(false);

  useEffect(() => {
    if (!homeserver) return;
    setLoading(true);
    setError(null);
    invoke<SsoProvider[]>("get_sso_providers", { homeserver })
      .then((p) => {
        setProviders(p);
        if (p.length === 0) {
          setError("This homeserver does not support SSO login.");
        }
      })
      .catch((e) => setError(`Failed to load SSO providers: ${e}`))
      .finally(() => setLoading(false));
  }, [homeserver]);

  const handleSsoLogin = async (providerId: string) => {
    try {
      const redirectUrl = "pufferchat://sso-callback";
      const result = await invoke<{ url: string }>("get_sso_login_url", {
        homeserver,
        providerId,
        redirectUrl,
      });
      setWaitingForCallback(true);
      await open(result.url);
    } catch (e) {
      setError(`Failed to start SSO login: ${e}`);
    }
  };

  return (
    <div style={{ fontFamily: "var(--font-system)", fontSize: 11 }}>
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={onBack}
          aria-label="Back to password login"
          style={{
            padding: "2px 8px",
            background: "#C0C0C0",
            border: "2px solid",
            borderColor: "#fff #404040 #404040 #fff",
            cursor: "pointer",
            fontSize: 10,
          }}
        >
          {"\u25C4"} Back
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 16 }}>
          <span style={{ fontSize: 18 }}>{"\u231B"}</span>
          <p>Discovering SSO providers...</p>
        </div>
      )}

      {error && (
        <div role="alert" style={{ padding: 6, background: "#ffd4d4", border: "1px solid #cc0000", marginBottom: 8, fontSize: 10 }}>
          {error}
        </div>
      )}

      {waitingForCallback && (
        <div style={{ textAlign: "center", padding: 16 }}>
          <span style={{ fontSize: 24 }}>{"\uD83C\uDF10"}</span>
          <p style={{ fontWeight: "bold", marginTop: 8 }}>
            Complete sign-in in your browser
          </p>
          <p style={{ color: "#808080", fontSize: 10 }}>
            A browser window has been opened. Complete the sign-in process there.
            PufferChat will detect when you are done.
          </p>
        </div>
      )}

      {!loading && !waitingForCallback && providers.length > 0 && (
        <div>
          <p style={{ marginBottom: 8, color: "#404040" }}>
            Sign in with your identity provider:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleSsoLogin(provider.id)}
                aria-label={`Sign in with ${provider.name}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  background: "#C0C0C0",
                  border: "2px solid",
                  borderColor: "#fff #404040 #404040 #fff",
                  cursor: "pointer",
                  fontSize: 11,
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 16 }}>
                  {provider.brand === "google" ? "\uD83C\uDF10" :
                   provider.brand === "github" ? "\uD83D\uDC31" :
                   provider.brand === "apple" ? "\uD83C\uDF4E" :
                   "\uD83D\uDD11"}
                </span>
                <span>Sign in with {provider.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

