import { useRoomsStore } from "../../stores/rooms";
import styles from "./MemberList.module.css";

interface MemberListProps {
  roomId: string;
}

export default function MemberList({ roomId }: MemberListProps) {
  const room = useRoomsStore((s) => s.rooms.find((r) => r.roomId === roomId));

  return (
    <div className={styles.memberList}>
      <div className={styles.header}>Members ({room?.memberCount ?? 0})</div>
      <div className={styles.placeholder}>
        Member list will be populated when member data is available.
      </div>
    </div>
  );
}
