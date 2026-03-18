import RoomHeader from "./RoomHeader";
import MessageList from "./MessageList";
import MessageComposer from "./MessageComposer";
import styles from "./ChatView.module.css";

interface ChatViewProps {
  roomId: string;
}

export default function ChatView({ roomId }: ChatViewProps) {
  return (
    <div className={styles.chatView}>
      <RoomHeader roomId={roomId} />
      <MessageList roomId={roomId} />
      <MessageComposer roomId={roomId} />
    </div>
  );
}
