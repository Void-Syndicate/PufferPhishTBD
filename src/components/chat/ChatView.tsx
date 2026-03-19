import { useState, useEffect } from "react";
import RoomHeader from "./RoomHeader";
import MessageList from "./MessageList";
import MessageComposer from "./MessageComposer";
import SearchBar from "./SearchBar";
import MemberListPanel from "./MemberListPanel";
import styles from "./ChatView.module.css";

interface ChatViewProps {
  roomId: string;
}

export default function ChatView({ roomId }: ChatViewProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => { setShowSearch(false); }, [roomId]);

  return (
    <div className={styles.chatView}>
      <RoomHeader roomId={roomId} onToggleMembers={() => setShowMembers((v) => !v)} showMembers={showMembers} />
      {showSearch && <SearchBar roomId={roomId} onClose={() => setShowSearch(false)} />}
      <div className={styles.chatBody}>
        <div className={styles.chatMain}>
          <MessageList roomId={roomId} />
          <MessageComposer roomId={roomId} />
        </div>
        {showMembers && <MemberListPanel roomId={roomId} />}
      </div>
    </div>
  );
}
