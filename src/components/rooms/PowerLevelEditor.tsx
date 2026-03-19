import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from './Moderation.module.css';

interface PowerLevelInfo {
  usersDefault: number;
  eventsDefault: number;
  stateDefault: number;
  ban: number;
  kick: number;
  invite: number;
  redact: number;
  userLevels: Record<string, number>;
}

interface RoomMember {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  powerLevel: number;
}

interface PowerLevelEditorProps {
  roomId: string;
  onClose: () => void;
}

function getRoleName(level: number): string {
  if (level >= 100) return 'Admin';
  if (level >= 50) return 'Moderator';
  return 'Member';
}

function getRoleClass(level: number): string {
  if (level >= 100) return styles.roleAdmin;
  if (level >= 50) return styles.roleMod;
  return styles.roleMember;
}

export default function PowerLevelEditor({ roomId, onClose }: PowerLevelEditorProps) {
  const [powerLevels, setPowerLevels] = useState<PowerLevelInfo | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [customLevel, setCustomLevel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pl, mem] = await Promise.all([
        invoke<PowerLevelInfo>('get_power_levels', { roomId }),
        invoke<RoomMember[]>('get_room_members', { roomId }),
      ]);
      setPowerLevels(pl);
      setMembers(mem);
    } catch (e: any) {
      setError(e?.toString() || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [roomId]);

  const setLevel = async (userId: string, level: number) => {
    try {
      setError(null);
      await invoke('set_user_power_level', { roomId, userId, level });
      setEditingUser(null);
      await loadData();
    } catch (e: any) {
      setError(e?.toString() || 'Failed to set power level');
    }
  };

  if (loading) return <div className={styles.panel}><div className={styles.loading}>Loading power levels...</div></div>;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>? Power Levels</span>
        <button className={styles.closeBtn} onClick={onClose}>?</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {powerLevels && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Required Power for Actions</div>
          <div className={styles.actionGrid}>
            <span>Kick:</span><span className={styles.levelBadge}>{powerLevels.kick}</span>
            <span>Ban:</span><span className={styles.levelBadge}>{powerLevels.ban}</span>
            <span>Invite:</span><span className={styles.levelBadge}>{powerLevels.invite}</span>
            <span>Redact:</span><span className={styles.levelBadge}>{powerLevels.redact}</span>
            <span>Events:</span><span className={styles.levelBadge}>{powerLevels.eventsDefault}</span>
            <span>State:</span><span className={styles.levelBadge}>{powerLevels.stateDefault}</span>
          </div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Members</div>
        <div className={styles.memberPowerList}>
          {members.map((m) => (
            <div key={m.userId} className={styles.memberPowerRow}>
              <div className={styles.memberPowerInfo}>
                <span className={styles.memberName}>{m.displayName || m.userId}</span>
                <span className={`${styles.rolePill} ${getRoleClass(m.powerLevel)}`}>
                  {getRoleName(m.powerLevel)} ({m.powerLevel})
                </span>
              </div>
              {editingUser === m.userId ? (
                <div className={styles.editControls}>
                  <button onClick={() => setLevel(m.userId, 100)} title="Admin">??</button>
                  <button onClick={() => setLevel(m.userId, 50)} title="Mod">???</button>
                  <button onClick={() => setLevel(m.userId, 0)} title="Member">??</button>
                  <input
                    type="number"
                    className={styles.customInput}
                    placeholder="#"
                    value={customLevel}
                    onChange={(e) => setCustomLevel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customLevel) {
                        setLevel(m.userId, parseInt(customLevel, 10));
                      }
                    }}
                  />
                  <button onClick={() => setEditingUser(null)}>?</button>
                </div>
              ) : (
                <button
                  className={styles.editBtn}
                  onClick={() => { setEditingUser(m.userId); setCustomLevel(''); }}
                  title="Change power level"
                >??</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}