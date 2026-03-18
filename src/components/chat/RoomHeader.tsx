import { useRoomsStore } from "../../stores/rooms";
import styles from "./RoomHeader.module.css";

interface RoomHeaderProps {
  roomId: string;
}

export default function RoomHeader({ roomId }: RoomHeaderProps) {
  const room = useRoomsStore((s) => s.rooms.find((r) => r.roomId === roomId));

  if (!room) return null;

  return (
    <div className={styles.roomHeader}>
      <span className={styles.roomName}>{room.name || room.roomId}</span>
      {room.topic && <span className={styles.topic}>{room.topic}</span>}
      <div className={styles.roomMeta}>
        {room.isEncrypted && <span className={styles.encryptedBadge} title="Encrypted">🔒</span>}
        <span>👥 {room.memberCount}</span>
      </div>
    </div>
  );
}
