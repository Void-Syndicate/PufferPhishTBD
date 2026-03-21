import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Window from "../retro/Window";
import Button from "../retro/Button";
import TextInput from "../retro/TextInput";
import styles from "./RoomDialogs.module.css";

interface PublicRoomInfo {
  roomId: string;
  name: string | null;
  topic: string | null;
  memberCount: number;
  avatarUrl: string | null;
  alias: string | null;
  worldReadable: boolean;
  guestCanJoin: boolean;
}

interface RoomDirectoryDialogProps {
  onClose: () => void;
  onJoined?: (roomId: string) => void;
}

export default function RoomDirectoryDialog({ onClose, onJoined }: RoomDirectoryDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicRoomInfo[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const handleSearch = async () => {
    setError("");
    setLoading(true);
    try {
      const rooms = await invoke<PublicRoomInfo[]>("search_public_rooms", {
        query: query || null,
        limit: 30,
      });
      setResults(rooms);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (roomId: string) => {
    setJoining(roomId);
    setError("");
    try {
      const joined = await invoke<string>("join_room", { roomIdOrAlias: roomId });
      onJoined?.(joined);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Window
          title="🔍 Room Directory  AOL Keyword"
          onClose={onClose}
          showMinimize={false}
          showMaximize={false}
          width={440}
        >
          <div className={styles.dialogBody}>
            <div className={styles.searchRow}>
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search public rooms..."
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button variant="primary" onClick={handleSearch} disabled={loading}>
                {loading ? "..." : "Go"}
              </Button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.resultsList}>
              {results.length === 0 ? (
                <div className={styles.emptyResults}>
                  {loading ? "Searching..." : "Enter a keyword and click Go"}
                </div>
              ) : (
                results.map((room) => (
                  <div
                    key={room.roomId}
                    className={styles.resultItem}
                    onClick={() => handleJoin(room.roomId)}
                  >
                    <div>
                      <span className={styles.resultName}>
                        {room.name || room.alias || room.roomId}
                      </span>
                      {room.topic && (
                        <div className={styles.resultTopic}>{room.topic}</div>
                      )}
                    </div>
                    <span className={styles.resultMeta}>
                      {joining === room.roomId
                        ? "Joining..."
                        : `?? ${room.memberCount}`}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className={styles.buttonRow}>
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}
