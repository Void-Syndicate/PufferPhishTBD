import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

const drafts = new Map<string, string>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function flushDrafts() {
  const entries = Array.from(drafts.entries());
  if (entries.length === 0) return;
  try {
    await invoke("save_drafts", { drafts: Object.fromEntries(entries) });
  } catch (e) {
    console.error("Failed to save drafts:", e);
  }
}

// Flush on app close
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    flushDrafts();
  });
}

export function useDraftPersistence(roomId: string) {
  const initialLoaded = useRef(false);

  useEffect(() => {
    if (!initialLoaded.current) {
      invoke<string | null>("get_draft", { roomId })
        .then((draft) => {
          if (draft) drafts.set(roomId, draft);
        })
        .catch(() => {});
      initialLoaded.current = true;
    }
  }, [roomId]);

  const getDraft = useCallback((): string => {
    return drafts.get(roomId) || "";
  }, [roomId]);

  const setDraft = useCallback((text: string) => {
    if (text.trim()) {
      drafts.set(roomId, text);
    } else {
      drafts.delete(roomId);
    }

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushDrafts, 2000);
  }, [roomId]);

  const clearDraft = useCallback(() => {
    drafts.delete(roomId);
    invoke("clear_draft", { roomId }).catch(() => {});
  }, [roomId]);

  return { getDraft, setDraft, clearDraft };
}
