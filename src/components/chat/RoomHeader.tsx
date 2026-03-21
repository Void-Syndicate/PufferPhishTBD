import { useState, useEffect, useCallback } from "react";
import { useRoomsStore } from "../../stores/rooms";
import { RoomEncryptionStatus } from "../../stores/encryption";
import { useEncryption } from "../../hooks/useEncryption";
import MediaGallery from "./MediaGallery";
import RoomSettingsPanel from "../rooms/RoomSettingsPanel";
import CallButton from "../calls/CallButton";
import { WidgetPicker } from '../../plugins/widgets/WidgetContainer';
import IntegrationManager from '../../plugins/integrations/IntegrationManager';
import styles from "./RoomHeader.module.css";

interface RoomHeaderProps {
  roomId: string;
  onToggleMembers?: () => void;
  showMembers?: boolean;
}

function EncryptionDetails({ status, onClose }: { status: RoomEncryptionStatus; onClose: () => void }) {
  return (
    <div className={styles.encryptionPopup}>
      <div className={styles.encryptionPopupHeader}>
        <span>&#x1F512; Encryption Details</span>
        <button className={styles.encryptionPopupClose} onClick={onClose}>&#x2716;</button>
      </div>
      <div className={styles.encryptionPopupBody}>
        <div className={styles.encryptionRow}>
          <span className={styles.encryptionLabel}>Status:</span>
          <span className={styles.encryptionValue}>
            {status.isEncrypted ? "&#x2705; Encrypted" : "&#x274C; Not Encrypted"}
          </span>
        </div>
        {status.algorithm && (
          <div className={styles.encryptionRow}>
            <span className={styles.encryptionLabel}>Algorithm:</span>
            <span className={styles.encryptionValue}>{status.algorithm}</span>
          </div>
        )}
        {status.rotationPeriodMsgs && (
          <div className={styles.encryptionRow}>
            <span className={styles.encryptionLabel}>Key Rotation:</span>
            <span className={styles.encryptionValue}>Every {status.rotationPeriodMsgs} messages</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoomHeader({ roomId, onToggleMembers, showMembers }: RoomHeaderProps) {
  const room = useRoomsStore((s) => s.rooms.find((r) => r.roomId === roomId));
  const { getRoomEncryptionStatus } = useEncryption();
  const [encDetails, setEncDetails] = useState<RoomEncryptionStatus | null>(null);
  const [showEncPopup, setShowEncPopup] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

  const handleEncryptionClick = useCallback(async () => {
    if (showEncPopup) {
      setShowEncPopup(false);
      return;
    }
    try {
      const status = await getRoomEncryptionStatus(roomId);
      setEncDetails(status);
      setShowEncPopup(true);
    } catch (e) {
      console.error("Failed to get encryption status:", e);
    }
  }, [roomId, showEncPopup, getRoomEncryptionStatus]);

  useEffect(() => {
    setShowEncPopup(false);
  }, [roomId]);

  if (!room) return null;

  const membersBtnClass = [styles.membersBtn, showMembers ? styles.membersBtnActive : ""].filter(Boolean).join(" ");

  return (
    <div className={styles.roomHeader}>
      <span className={styles.roomName}>{room.name || room.roomId}</span>
      {room.topic && <span className={styles.topic}>{room.topic}</span>}
      <div className={styles.roomMeta}>
        <CallButton roomId={roomId} />
        {room.isEncrypted && (          <span
            className={styles.encryptedBadge}
            title="Encrypted â€” click for details"
            onClick={handleEncryptionClick}
          >
            &#x1F512;
          </span>
        )}
        <button
          className={styles.membersBtn}
          onClick={() => setShowWidgetPicker(!showWidgetPicker)}
          title="Room widgets"
        >
          &#x1F4C4; Widgets
        </button>
        <button
          className={styles.membersBtn}
          onClick={() => setShowIntegrations(!showIntegrations)}
          title="Integrations"
        >
          &#x1F527; Integrations
        </button>
        <button
          className={styles.membersBtn}
          onClick={() => setShowSettings(true)}
          title="Room settings"
        >
          âš™ï¸ Settings
        </button>
        <button
          className={styles.membersBtn}
          onClick={() => setShowMediaGallery(true)}
          title="Media gallery"
        >
          ðŸ–¼ï¸ Media
        </button>
        <button
          className={membersBtnClass}
          onClick={onToggleMembers}
          title="Toggle member list"
        >
          &#x1F465; {room.memberCount}
        </button>
      </div>
      {showEncPopup && encDetails && (
        <EncryptionDetails status={encDetails} onClose={() => setShowEncPopup(false)} />
      )}
      {showSettings && (
        <RoomSettingsPanel roomId={roomId} onClose={() => setShowSettings(false)} />
      )}
      {showMediaGallery && (
        <MediaGallery roomId={roomId} onClose={() => setShowMediaGallery(false)} />
      )}
      {showWidgetPicker && (
        <WidgetPicker roomId={roomId} onClose={() => setShowWidgetPicker(false)} />
      )}
      {showIntegrations && (
        <IntegrationManager roomId={roomId} onClose={() => setShowIntegrations(false)} />
      )}
    </div>
  );
}
