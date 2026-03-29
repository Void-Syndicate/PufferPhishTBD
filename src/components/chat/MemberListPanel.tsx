import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../../stores/auth';
import { useModeration } from '../../hooks/useModeration';
import { useModerationStore } from '../../stores/moderation';
import ModerationDialog from '../moderation/ModerationDialog';
import styles from './MemberListPanel.module.css';
import modStyles from '../rooms/Moderation.module.css';

interface RoomMember {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  powerLevel: number;
}

interface MemberListPanelProps {
  roomId: string;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  member: RoomMember | null;
}

function getRoleBadge(powerLevel: number): string {
  if (powerLevel >= 100) return '?';
  if (powerLevel >= 50) return '?';
  return '';
}

function getRoleLabel(powerLevel: number): string {
  if (powerLevel >= 100) return 'Admin';
  if (powerLevel >= 50) return 'Mod';
  return '';
}

export default function MemberListPanel({ roomId }: MemberListPanelProps) {
  const currentUserId = useAuthStore((state) => state.userId);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, member: null,
  });
  const [reasonDialog, setReasonDialog] = useState<{
    action: 'kick' | 'ban';
    userId: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [showIgnoreDialog, setShowIgnoreDialog] = useState<RoomMember | null>(null);
  const [showUnignoreDialog, setShowUnignoreDialog] = useState<RoomMember | null>(null);
  const [showReportDialog, setShowReportDialog] = useState<RoomMember | null>(null);
  const ignoredUsers = useModerationStore((state) => state.ignoredUsers);
  const { ignoreUser, unignoreUser, reportUser } = useModeration();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<RoomMember[]>('get_room_members', { roomId })
      .then((result) => {
        if (!cancelled) {
          setMembers(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        console.error('Failed to load members:', e);
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [roomId]);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, member: null });
  }, []);

  useEffect(() => {
    const handler = () => closeContextMenu();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [closeContextMenu]);

  const handleContextMenu = (e: React.MouseEvent, member: RoomMember) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, member });
  };

  const doKickBan = async (action: 'kick' | 'ban') => {
    if (!reasonDialog) return;
    try {
      if (action === 'kick') {
        await invoke('kick_user', { roomId, userId: reasonDialog.userId, reason: reason || null });
      } else {
        await invoke('ban_user', { roomId, userId: reasonDialog.userId, reason: reason || null });
      }
      setReasonDialog(null);
      setReason('');
      // Refresh
      const result = await invoke<RoomMember[]>('get_room_members', { roomId });
      setMembers(result);
    } catch (e) {
      console.error(`Failed to ${action}:`, e);
    }
  };

  const setPowerLevel = async (userId: string, level: number) => {
    try {
      await invoke('set_user_power_level', { roomId, userId, level });
      const result = await invoke<RoomMember[]>('get_room_members', { roomId });
      setMembers(result);
    } catch (e) {
      console.error('Failed to set power level:', e);
    }
    closeContextMenu();
  };

  const admins = members.filter((m) => m.powerLevel >= 100);
  const mods = members.filter((m) => m.powerLevel >= 50 && m.powerLevel < 100);
  const regulars = members.filter((m) => m.powerLevel < 50);

  const renderMember = (member: RoomMember) => (
    <div
      key={member.userId}
      className={styles.memberItem}
      title={`${member.userId} (Power: ${member.powerLevel})`}
      onContextMenu={(e) => handleContextMenu(e, member)}
    >
      <span className={styles.avatar}>??</span>
      <div className={styles.memberInfo}>
        <span className={styles.displayName}>
          {member.displayName || member.userId}
          {ignoredUsers.includes(member.userId) && (
            <span className={styles.ignoredBadge} title="Ignored user">
              Ignored
            </span>
          )}
          {getRoleBadge(member.powerLevel) && (
            <span className={styles.roleBadge} title={`${getRoleLabel(member.powerLevel)} (${member.powerLevel})`}>
              {getRoleBadge(member.powerLevel)}
            </span>
          )}
          {member.powerLevel > 0 && member.powerLevel < 50 && (
            <span className={styles.powerNum} title={`Power: ${member.powerLevel}`}>
              [{member.powerLevel}]
            </span>
          )}
        </span>
        <span className={styles.userId}>{member.userId}</span>
      </div>
    </div>
  );

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span>?? Members ({members.length})</span>
      </div>
      <div className={styles.memberList}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : error ? (
          <div className={styles.loading}>{error}</div>
        ) : (
          <>
            {admins.length > 0 && (
              <div className={styles.roleGroup}>
                <div className={styles.roleHeader}>?? Admins ({admins.length})</div>
                {admins.map(renderMember)}
              </div>
            )}
            {mods.length > 0 && (
              <div className={styles.roleGroup}>
                <div className={styles.roleHeader}>??? Moderators ({mods.length})</div>
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

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.member && (
        <div
          className={modStyles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '3px 12px', fontWeight: 'bold', fontSize: '10px', color: '#666' }}>
            {contextMenu.member.displayName || contextMenu.member.userId}
          </div>
          <div className={modStyles.contextMenuSep} />
          {contextMenu.member.userId !== currentUserId && (
            <>
              <button className={modStyles.contextMenuItem} onClick={() => {
                if (ignoredUsers.includes(contextMenu.member!.userId)) {
                  setShowUnignoreDialog(contextMenu.member);
                } else {
                  setShowIgnoreDialog(contextMenu.member);
                }
                closeContextMenu();
              }}>
                {ignoredUsers.includes(contextMenu.member.userId) ? '?? Unblock / Unignore' : '?? Block / Ignore'}
              </button>
              <button className={modStyles.contextMenuItem} onClick={() => {
                setShowReportDialog(contextMenu.member);
                closeContextMenu();
              }}>?? Report User</button>
              <div className={modStyles.contextMenuSep} />
            </>
          )}
          <button className={modStyles.contextMenuItem} onClick={() => {
            setReasonDialog({ action: 'kick', userId: contextMenu.member!.userId });
            closeContextMenu();
          }}>?? Kick</button>
          <button className={modStyles.contextMenuItem} onClick={() => {
            setReasonDialog({ action: 'ban', userId: contextMenu.member!.userId });
            closeContextMenu();
          }}>?? Ban</button>
          <div className={modStyles.contextMenuSep} />
          <button className={modStyles.contextMenuItem} onClick={() => setPowerLevel(contextMenu.member!.userId, 100)}>
            ?? Make Admin
          </button>
          <button className={modStyles.contextMenuItem} onClick={() => setPowerLevel(contextMenu.member!.userId, 50)}>
            ??? Make Moderator
          </button>
          <button className={modStyles.contextMenuItem} onClick={() => setPowerLevel(contextMenu.member!.userId, 0)}>
            ?? Remove Role
          </button>
        </div>
      )}

      {/* Reason Dialog */}
      {reasonDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--win-bg)', border: '2px solid',
            borderColor: 'var(--win-border-light) var(--win-border-dark) var(--win-border-dark) var(--win-border-light)',
            padding: '8px', width: '260px',
          }}>
            <div style={{
              padding: '3px 6px', background: 'linear-gradient(180deg, var(--aol-blue), var(--aol-blue-dark))',
              color: 'white', fontWeight: 'bold', fontSize: '11px', marginBottom: '6px',
            }}>
              {reasonDialog.action === 'kick' ? '?? Kick' : '?? Ban'} {reasonDialog.userId}
            </div>
            <input
              style={{
                width: '100%', boxSizing: 'border-box', padding: '3px 6px',
                fontFamily: 'var(--font-system)', fontSize: '11px', border: '2px inset', marginBottom: '6px',
              }}
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doKickBan(reasonDialog.action); }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button
                style={{
                  padding: '3px 12px', fontFamily: 'var(--font-system)', fontSize: '11px',
                  cursor: 'pointer', border: '2px solid',
                  borderColor: 'var(--win-border-light) var(--win-border-dark) var(--win-border-dark) var(--win-border-light)',
                  background: 'var(--win-bg)',
                }}
                onClick={() => { setReasonDialog(null); setReason(''); }}
              >Cancel</button>
              <button
                style={{
                  padding: '3px 12px', fontFamily: 'var(--font-system)', fontSize: '11px',
                  fontWeight: 'bold', cursor: 'pointer', border: '2px solid',
                  borderColor: 'var(--win-border-light) var(--win-border-dark) var(--win-border-dark) var(--win-border-light)',
                  background: 'var(--win-bg)',
                }}
                onClick={() => doKickBan(reasonDialog.action)}
              >{reasonDialog.action === 'kick' ? 'Kick' : 'Ban'}</button>
            </div>
          </div>
        </div>
      )}

      {showIgnoreDialog && (
        <ModerationDialog
          title="Block / Ignore User"
          description={`Hide future messages and reactions from ${showIgnoreDialog.displayName || showIgnoreDialog.userId}?`}
          confirmLabel="Block User"
          onClose={() => setShowIgnoreDialog(null)}
          onConfirm={async () => { await ignoreUser(showIgnoreDialog.userId); }}
        />
      )}

      {showUnignoreDialog && (
        <ModerationDialog
          title="Unblock / Unignore User"
          description={`Allow ${showUnignoreDialog.displayName || showUnignoreDialog.userId} to appear in chat again?`}
          confirmLabel="Unblock User"
          onClose={() => setShowUnignoreDialog(null)}
          onConfirm={async () => { await unignoreUser(showUnignoreDialog.userId); }}
        />
      )}

      {showReportDialog && (
        <ModerationDialog
          title="Report User"
          description={`Send a moderation report for ${showReportDialog.displayName || showReportDialog.userId}.`}
          confirmLabel="Report User"
          onClose={() => setShowReportDialog(null)}
          onConfirm={(reportReason) => reportUser(showReportDialog.userId, reportReason)}
          reasonLabel="Reason"
          reasonPlaceholder="Describe the abusive or suspicious behavior."
        />
      )}
    </div>
  );
}
