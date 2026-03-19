import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from './Moderation.module.css';

interface BannedUser {
  userId: string;
  reason: string | null;
}

interface ModerationPanelProps {
  roomId: string;
  onClose: () => void;
}

type Tab = 'actions' | 'banned' | 'acl';

export default function ModerationPanel({ roomId, onClose }: ModerationPanelProps) {
  const [tab, setTab] = useState<Tab>('actions');
  const [targetUserId, setTargetUserId] = useState('');
  const [reason, setReason] = useState('');
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [aclAllow, setAclAllow] = useState('*');
  const [aclDeny, setAclDeny] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modLog, setModLog] = useState<string[]>([]);

  const addLog = (entry: string) => {
    setModLog((prev) => [`[${new Date().toLocaleTimeString()}] ${entry}`, ...prev.slice(0, 49)]);
  };

  const loadBanned = async () => {
    try {
      const list = await invoke<BannedUser[]>('get_banned_users', { roomId });
      setBannedUsers(list);
    } catch (e: any) {
      setError(e?.toString() || 'Failed to load banned users');
    }
  };

  useEffect(() => { if (tab === 'banned') loadBanned(); }, [tab, roomId]);

  const doAction = async (action: string) => {
    if (!targetUserId.trim()) { setError('User ID required'); return; }
    setError(null); setSuccess(null); setLoading(true);
    try {
      if (action === 'kick') {
        await invoke('kick_user', { roomId, userId: targetUserId, reason: reason || null });
        addLog(`Kicked ${targetUserId}${reason ? ': ' + reason : ''}`);
        setSuccess(`Kicked ${targetUserId}`);
      } else if (action === 'ban') {
        await invoke('ban_user', { roomId, userId: targetUserId, reason: reason || null });
        addLog(`Banned ${targetUserId}${reason ? ': ' + reason : ''}`);
        setSuccess(`Banned ${targetUserId}`);
      }
      setTargetUserId(''); setReason('');
    } catch (e: any) {
      setError(e?.toString() || `Failed to ${action}`);
    } finally {
      setLoading(false);
    }
  };

  const doUnban = async (userId: string) => {
    try {
      setError(null);
      await invoke('unban_user', { roomId, userId });
      addLog(`Unbanned ${userId}`);
      await loadBanned();
    } catch (e: any) {
      setError(e?.toString() || 'Failed to unban');
    }
  };

  const saveAcl = async () => {
    try {
      setError(null); setLoading(true);
      const allow = aclAllow.split('\n').map(s => s.trim()).filter(Boolean);
      const deny = aclDeny.split('\n').map(s => s.trim()).filter(Boolean);
      await invoke('set_server_acl', { roomId, allow, deny });
      addLog(`Updated server ACLs`);
      setSuccess('Server ACLs updated');
    } catch (e: any) {
      setError(e?.toString() || 'Failed to set ACLs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>?? Moderation</span>
        <button className={styles.closeBtn} onClick={onClose}>?</button>
      </div>

      <div className={styles.tabs}>
        <button className={tab === 'actions' ? styles.tabActive : styles.tab} onClick={() => setTab('actions')}>Actions</button>
        <button className={tab === 'banned' ? styles.tabActive : styles.tab} onClick={() => setTab('banned')}>Banned</button>
        <button className={tab === 'acl' ? styles.tabActive : styles.tab} onClick={() => setTab('acl')}>ACL</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {tab === 'actions' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Kick / Ban User</div>
          <input
            className={styles.input}
            placeholder="@user:server.com"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className={styles.actionButtons}>
            <button className={styles.kickBtn} onClick={() => doAction('kick')} disabled={loading}>
              ?? Kick
            </button>
            <button className={styles.banBtn} onClick={() => doAction('ban')} disabled={loading}>
              ?? Ban
            </button>
          </div>

          {modLog.length > 0 && (
            <div className={styles.modLog}>
              <div className={styles.sectionTitle}>Recent Actions</div>
              {modLog.map((entry, i) => (
                <div key={i} className={styles.logEntry}>{entry}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'banned' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Banned Users ({bannedUsers.length})</div>
          {bannedUsers.length === 0 ? (
            <div className={styles.empty}>No banned users</div>
          ) : (
            bannedUsers.map((u) => (
              <div key={u.userId} className={styles.bannedRow}>
                <div className={styles.bannedInfo}>
                  <span className={styles.bannedName}>{u.userId}</span>
                  {u.reason && <span className={styles.bannedReason}>{u.reason}</span>}
                </div>
                <button className={styles.unbanBtn} onClick={() => doUnban(u.userId)}>Unban</button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'acl' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Server ACLs (Advanced)</div>
          <label className={styles.label}>Allow (one per line)</label>
          <textarea
            className={styles.textarea}
            value={aclAllow}
            onChange={(e) => setAclAllow(e.target.value)}
            rows={3}
          />
          <label className={styles.label}>Deny (one per line)</label>
          <textarea
            className={styles.textarea}
            value={aclDeny}
            onChange={(e) => setAclDeny(e.target.value)}
            rows={3}
          />
          <button className={styles.saveBtn} onClick={saveAcl} disabled={loading}>
            Save ACLs
          </button>
        </div>
      )}
    </div>
  );
}