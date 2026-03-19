import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from './MemberListPanel.module.css';

interface RoomMember {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  powerLevel: number;
}

interface MemberListPanelProps {
  roomId: string;
}

function getRoleBadge(powerLevel: number): string {
  if (powerLevel >= 100) return '\u2605'; // star
  if (powerLevel >= 50) return '\u2666'; // diamond
  return '';
}

export default function MemberListPanel({ roomId }: MemberListPanelProps) {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    invoke<RoomMember[]>('get_room_members', { roomId })
      .then((result) => {
        if (!cancelled) {
          setMembers(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        console.error('Failed to load members:', e);
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [roomId]);

  const admins = members.filter((m) => m.powerLevel >= 100);
  const mods = members.filter((m) => m.powerLevel >= 50 && m.powerLevel < 100);
  const regulars = members.filter((m) => m.powerLevel < 50);

  const renderMember = (member: RoomMember) => (
    <div key={member.userId} className={styles.memberItem} title={member.userId}>
      <span className={styles.avatar}>\uD83D\uDC64</span>
      <div className={styles.memberInfo}>
        <span className={styles.displayName}>
          {member.displayName || member.userId}
          {getRoleBadge(member.powerLevel) && (
            <span className={styles.roleBadge}>{getRoleBadge(member.powerLevel)}</span>
          )}
        </span>
        <span className={styles.userId}>{member.userId}</span>
      </div>
    </div>
  );

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span>\uD83D\uDC65 Members ({members.length})</span>
      </div>
      <div className={styles.memberList}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <>
            {admins.length > 0 && (
              <div className={styles.roleGroup}>
                <div className={styles.roleHeader}>Admins ({admins.length})</div>
                {admins.map(renderMember)}
              </div>
            )}
            {mods.length > 0 && (
              <div className={styles.roleGroup}>
                <div className={styles.roleHeader}>Moderators ({mods.length})</div>
                {mods.map(renderMember)}
              </div>
            )}
            {regulars.length > 0 && (
              <div className={styles.roleGroup}>
                <div className={styles.roleHeader}>Members ({regulars.length})</div>
                {regulars.map(renderMember)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
