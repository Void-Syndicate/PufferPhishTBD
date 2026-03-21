import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAccountStore, AccountEntry } from "../../stores/accountStore";
import { useAuthStore } from "../../stores/auth";

interface Props {
  onManageAccounts?: () => void;
}

export default function AccountSwitcher({ onManageAccounts }: Props) {
  const { accounts, activeAccountId, setAccounts, setActiveAccount } = useAccountStore();
  const userId = useAuthStore((s) => s.userId);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    invoke<AccountEntry[]>("list_accounts")
      .then(setAccounts)
      .catch(() => {});
  }, [setAccounts]);

  const handleSwitch = async (targetUserId: string) => {
    if (targetUserId === activeAccountId) {
      setExpanded(false);
      return;
    }
    setLoading(true);
    try {
      await invoke("switch_account", { userId: targetUserId });
      setActiveAccount(targetUserId);
      setExpanded(false);
      // Trigger session restore for the new account
      window.location.reload();
    } catch (e) {
      console.error("Failed to switch account:", e);
    } finally {
      setLoading(false);
    }
  };

  if (accounts.length <= 1) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 4px",
          fontSize: 10,
          fontFamily: "var(--font-system)",
          color: "#404040",
        }}
      >
        <span style={{ fontSize: 12 }}>{"\uD83D\uDC64"}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {userId || "Not signed in"}
        </span>
        {onManageAccounts && (
          <button
            onClick={onManageAccounts}
            aria-label="Manage accounts"
            title="Add account"
            style={{
              marginLeft: "auto",
              padding: "0 4px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            +
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", fontSize: 10, fontFamily: "var(--font-system)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        aria-label="Switch account"
        aria-expanded={expanded}
        aria-haspopup="listbox"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "100%",
          padding: "2px 4px",
          background: "transparent",
          border: "1px solid transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 12 }}>{"\uD83D\uDC64"}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {userId || "Not signed in"}
        </span>
        <span style={{ fontSize: 8 }}>{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>

      {expanded && (
        <div
          role="listbox"
          aria-label="Account list"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            border: "2px solid",
            borderColor: "#404040 #fff #fff #404040",
            zIndex: 100,
            boxShadow: "2px 2px 0 rgba(0,0,0,0.2)",
          }}
        >
          {accounts.map((account) => (
            <button
              key={account.userId}
              onClick={() => handleSwitch(account.userId)}
              disabled={loading}
              role="option"
              aria-selected={account.userId === activeAccountId}
              aria-label={`Switch to ${account.displayName || account.userId}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                width: "100%",
                padding: "3px 6px",
                background: account.userId === activeAccountId ? "#000080" : "transparent",
                color: account.userId === activeAccountId ? "#fff" : "#000",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 10,
              }}
            >
              <span>{account.userId === activeAccountId ? "\u2714" : "\u00A0\u00A0"}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {account.displayName || account.userId}
              </span>
            </button>
          ))}
          {onManageAccounts && (
            <button
              onClick={() => {
                setExpanded(false);
                onManageAccounts();
              }}
              aria-label="Manage accounts"
              style={{
                width: "100%",
                padding: "3px 6px",
                background: "transparent",
                border: "none",
                borderTop: "1px solid #C0C0C0",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 10,
                color: "#000080",
              }}
            >
              {"\u2699"} Manage Accounts...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

