import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useModerationStore } from "../stores/moderation";

export function useModeration() {
  const setIgnoredUsers = useModerationStore((state) => state.setIgnoredUsers);

  const refreshIgnoredUsers = useCallback(async () => {
    const ignoredUsers = await invoke<string[]>("get_ignored_users");
    setIgnoredUsers(ignoredUsers);
    return ignoredUsers;
  }, [setIgnoredUsers]);

  const ignoreUser = useCallback(
    async (userId: string) => {
      const ignoredUsers = await invoke<string[]>("ignore_user", { userId });
      setIgnoredUsers(ignoredUsers);
      return ignoredUsers;
    },
    [setIgnoredUsers],
  );

  const unignoreUser = useCallback(
    async (userId: string) => {
      const ignoredUsers = await invoke<string[]>("unignore_user", { userId });
      setIgnoredUsers(ignoredUsers);
      return ignoredUsers;
    },
    [setIgnoredUsers],
  );

  const reportRoom = useCallback(async (roomId: string, reason: string) => {
    await invoke("report_room", {
      roomId,
      reason: reason.trim() || null,
    });
  }, []);

  const reportMessage = useCallback(async (roomId: string, eventId: string, reason: string) => {
    await invoke("report_message", {
      roomId,
      eventId,
      reason: reason.trim() || null,
      score: -100,
    });
  }, []);

  const reportUser = useCallback(async (userId: string, reason: string) => {
    await invoke("report_user", {
      userId,
      reason: reason.trim() || null,
    });
  }, []);

  return {
    refreshIgnoredUsers,
    ignoreUser,
    unignoreUser,
    reportRoom,
    reportMessage,
    reportUser,
  };
}
