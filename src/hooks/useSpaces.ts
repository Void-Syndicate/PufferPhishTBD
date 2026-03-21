import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpacesStore, SpaceSummary, SpaceChild } from "../stores/spaces";

export function useSpaces() {
  const {
    spaces,
    childrenBySpace,
    selectedSpaceId,
    expandedSpaces,
    isLoading,
    setSpaces,
    setChildren,
    selectSpace,
    toggleExpanded,
    setLoading,
  } = useSpacesStore();

  const fetchSpaces = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<SpaceSummary[]>("get_spaces");
      setSpaces(result);
    } catch (e) {
      console.error("Failed to fetch spaces:", e);
      setLoading(false);
    }
  }, [setSpaces, setLoading]);

  const fetchChildren = useCallback(
    async (spaceId: string) => {
      try {
        const result = await invoke<SpaceChild[]>("get_space_children", { spaceId });
        setChildren(spaceId, result);
      } catch (e) {
        console.error("Failed to fetch space children:", e);
      }
    },
    [setChildren]
  );

  const createSpace = useCallback(
    async (name: string, topic?: string, avatarUrl?: string): Promise<string> => {
      const roomId = await invoke<string>("create_space", { name, topic, avatarUrl });
      await fetchSpaces();
      return roomId;
    },
    [fetchSpaces]
  );

  const addChild = useCallback(
    async (spaceId: string, childRoomId: string, order?: string, suggested?: boolean) => {
      await invoke("add_space_child", { spaceId, childRoomId, order, suggested });
      await fetchChildren(spaceId);
    },
    [fetchChildren]
  );

  const removeChild = useCallback(
    async (spaceId: string, childRoomId: string) => {
      await invoke("remove_space_child", { spaceId, childRoomId });
      await fetchChildren(spaceId);
    },
    [fetchChildren]
  );

  const getChildRoomIds = useCallback(
    (spaceId: string): Set<string> => {
      const children = childrenBySpace[spaceId] || [];
      return new Set(children.map((c) => c.roomId));
    },
    [childrenBySpace]
  );

  return {
    spaces,
    childrenBySpace,
    selectedSpaceId,
    expandedSpaces,
    isLoading,
    fetchSpaces,
    fetchChildren,
    createSpace,
    addChild,
    removeChild,
    selectSpace,
    toggleExpanded,
    getChildRoomIds,
  };
}
