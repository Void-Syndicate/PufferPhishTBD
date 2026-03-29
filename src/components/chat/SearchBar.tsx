import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TimelineMessage } from "../../stores/messages";
import { useModerationStore } from "../../stores/moderation";
import styles from "./SearchBar.module.css";

interface SearchBarProps {
  roomId: string;
  onClose: () => void;
}

type SearchResult = TimelineMessage;

export default function SearchBar({ roomId, onClose }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const ignoredUsers = useModerationStore((state) => state.ignoredUsers);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await invoke<SearchResult[]>("search_messages", { roomId, query: q.trim(), limit: 20 });
      setResults(res);
    } catch (e) {
      console.error("Search failed:", e);
      setResults([]);
    } finally { setSearching(false); }
  }, [roomId]);

  const handleInput = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  const visibleResults = results.filter((result) => !ignoredUsers.includes(result.sender));

  return (
    <div className={styles.searchBar}>
      <div className={styles.inputRow}>
        <span className={styles.icon}>{"\uD83D\uDD0D"}</span>
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search messages... (Esc to close)"
        />
        <button className={styles.closeBtn} onClick={onClose}>{"\u2715"}</button>
      </div>
      {searching && <div className={styles.status}>Searching...</div>}
      {visibleResults.length > 0 && (
        <div className={styles.results}>
          {visibleResults.map((r) => (
            <div key={r.eventId} className={styles.resultItem}>
              <span className={styles.resultSender}>{r.senderName || r.sender}</span>
              <span className={styles.resultBody}>{r.body}</span>
              <span className={styles.resultTime}>
                {new Date(r.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
      {!searching && query.length >= 2 && visibleResults.length === 0 && (
        <div className={styles.status}>No results found.</div>
      )}
    </div>
  );
}
