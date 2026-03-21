import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Window from "../retro/Window";

interface Account {
  id: string;
  userId: string;
  homeserver: string;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
}

interface Props {
  onClose: () => void;
}

export default function AccountSettings({ onClose }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newHomeserver, setNewHomeserver] = useState("https://matrix.org");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const list = await invoke<Account[]>("list_accounts");
      setAccounts(list);
    } catch (e) {
      console.error("Failed to load accounts:", e);
    }
  };

  const handleAddAccount = async () => {
    if (!newUsername.trim() || !newPassword) return;
    setAdding(true);
    setError(null);
    try {
      await invoke("add_account", {
        homeserver: newHomeserver.trim(),
        username: newUsername.trim(),
        password: newPassword,
      });
      setShowAdd(false);
      setNewUsername("");
      setNewPassword("");
      await loadAccounts();
    } catch (e: unknown) {
      setError(`Login failed: ${e}`);
    } finally {
      setAdding(false);
    }
  };

  const handleSwitch = async (accountId: string) => {
    try {
      await invoke("switch_account", { accountId });
      await loadAccounts();
    } catch (e: unknown) {
      setError(`Switch failed: ${e}`);
    }
  };

  const handleRemove = async (accountId: string) => {
    try {
      await invoke("remove_account", { accountId });
      setConfirmRemove(null);
      await loadAccounts();
    } catch (e: unknown) {
      setError(`Remove failed: ${e}`);
    }
  };

  const fieldsetStyle: React.CSSProperties = {
    border: "2px solid", borderColor: "#808080 #fff #fff #808080",
    padding: 8, marginBottom: 8,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: 2,
    border: "2px solid", borderColor: "#404040 #fff #fff #404040",
  };
  const btnStyle: React.CSSProperties = {
    padding: "3px 12px", background: "#C0C0C0",
    border: "2px solid", borderColor: "#fff #404040 #404040 #fff",
    cursor: "pointer", fontSize: 11,
  };

  return (
    <div style={{ position: "fixed", top: 50, left: "50%", transform: "translateX(-50%)", zIndex: 700 }}>
      <Window title="👤 Account Management" onClose={onClose} width={420}>
        <div style={{ padding: 12, fontFamily: "var(--font-system)", fontSize: 11 }}>

          <fieldset style={fieldsetStyle}>
            <legend>Accounts ({accounts.length})</legend>
            {accounts.length === 0 ? (
              <div style={{ color: "#666", fontStyle: "italic", padding: 8, textAlign: "center" }}>
                No accounts configured.
              </div>
            ) : (
              <div style={{ maxHeight: 250, overflowY: "auto" }}>
                {accounts.map((acct) => (
                  <div key={acct.id} style={{
                    padding: 8, marginBottom: 4,
                    background: acct.isActive ? "#d4e8ff" : "#f0f0f0",
                    border: acct.isActive ? "2px solid #004B87" : "1px solid #ccc",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 4,
                      background: "#004B87", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: "bold", fontSize: 14,
                    }}>
                      {acct.displayName?.[0]?.toUpperCase() || acct.userId[1]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold" }}>
                        {acct.displayName || acct.userId}
                        {acct.isActive && <span style={{ color: "#006400", marginLeft: 6, fontSize: 10 }}>● Active</span>}
                      </div>
                      <div style={{ fontSize: 9, color: "#666" }}>{acct.userId}</div>
                      <div style={{ fontSize: 9, color: "#888" }}>{acct.homeserver}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {!acct.isActive && (
                        <button onClick={() => handleSwitch(acct.id)} style={{ ...btnStyle, fontSize: 10, padding: "1px 8px" }}>
                          Switch
                        </button>
                      )}
                      {confirmRemove === acct.id ? (
                        <>
                          <button onClick={() => handleRemove(acct.id)} style={{ ...btnStyle, fontSize: 10, padding: "1px 8px", color: "red" }}>
                            Confirm
                          </button>
                          <button onClick={() => setConfirmRemove(null)} style={{ ...btnStyle, fontSize: 10, padding: "1px 8px" }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmRemove(acct.id)} style={{ ...btnStyle, fontSize: 10, padding: "1px 8px" }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          {showAdd ? (
            <fieldset style={fieldsetStyle}>
              <legend>Add Account</legend>
              <div style={{ marginBottom: 6 }}>
                <label style={{ display: "block", marginBottom: 2 }}>Homeserver:</label>
                <input type="text" value={newHomeserver} onChange={(e) => setNewHomeserver(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label style={{ display: "block", marginBottom: 2 }}>Username:</label>
                <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="@user:matrix.org" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", marginBottom: 2 }}>Password:</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <button onClick={handleAddAccount} disabled={adding} style={{ ...btnStyle, fontWeight: "bold" }}>
                  {adding ? "Signing in..." : "Sign In"}
                </button>
                <button onClick={() => { setShowAdd(false); setError(null); }} style={btnStyle}>Cancel</button>
              </div>
            </fieldset>
          ) : (
            <button onClick={() => setShowAdd(true)} style={{ ...btnStyle, width: "100%", marginBottom: 8 }}>
              ➕ Add Account
            </button>
          )}

          {error && (
            <div style={{ padding: 4, marginBottom: 6, background: "#ffd4d4", border: "1px solid red", fontSize: 10 }}>{error}</div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ ...btnStyle, fontWeight: "bold", padding: "3px 16px" }}>Close</button>
          </div>
        </div>
      </Window>
    </div>
  );
}
