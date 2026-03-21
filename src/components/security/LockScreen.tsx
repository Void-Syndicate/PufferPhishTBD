import { useState, useEffect, FormEvent } from "react";
import { useEncryption } from "../../hooks/useEncryption";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./Security.module.css";

interface LockScreenProps {
  onUnlocked: () => void;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000; // 30 seconds

export default function LockScreen({ onUnlocked }: LockScreenProps) {
  const { verifyUnlockPassphrase } = useEncryption();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.max(0, lockedUntil - Date.now());
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        setError("");
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLockedOut = lockedUntil !== null && Date.now() < lockedUntil;

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!passphrase || isLockedOut) return;
    setLoading(true);
    setError("");
    try {
      const valid = await verifyUnlockPassphrase(passphrase);
      if (valid) {
        setAttempts(0);
        onUnlocked();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_MS);
          setError(`Too many failed attempts. Locked for 30 seconds.`);
        } else {
          setError(`Incorrect passphrase. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`);
        }
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
      setPassphrase("");
    }
  };

  return (
    <div className={styles.lockBackdrop}>
      <Window
        title="🔒 PufferChat Locked"
        showMinimize={false}
        showMaximize={false}
        showClose={false}
        width={380}
      >
        <div className={styles.lockContent}>
          <div className={styles.lockIcon}>??</div>
          <h2 className={styles.lockTitle}>PufferChat is Locked</h2>
          <p className={styles.lockDescription}>
            Enter your passphrase to unlock.
          </p>
          <form onSubmit={handleUnlock}>
            <div className={styles.field}>
              <TextInput
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter passphrase"
                autoFocus
                disabled={isLockedOut}
              />
            </div>
            {error && <div className={styles.error}>?? {error}</div>}
            {isLockedOut && (
              <div className={styles.error}>
                ?? Try again in {Math.ceil(lockoutRemaining / 1000)}s
              </div>
            )}
            <div className={styles.buttonRow}>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || !passphrase || isLockedOut}
              >
                {loading ? "Verifying..." : "Unlock"}
              </Button>
            </div>
          </form>
        </div>
      </Window>
    </div>
  );
}