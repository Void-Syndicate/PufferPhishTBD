import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpacesStore, SpaceSummary, SpaceChild } from "../stores/spaces";

export function useSpaces() {
  const {
    spaces,
    childrenBySpace,
    childRoomIdsBySpace,
    isLoadingChildren,
    selectedSpaceId,
    expandedSpaces,
    isLoading,
    setSpaces,
    setChildren,
    selectSpace,
    toggleExpanded,
    setLoading,
    setLoadingChildren,
    buildFlatChildMap,
  } = useSpacesStore();

  const fetchChildren = useCallback(
    async (spaceId: string) => {
      setLoadingChildren(spaceId, true);
      try {
        const result = await invoke<SpaceChild[]>("get_space_children", { spaceId });
        setChildren(spaceId, result);
      } catch (e) {
        console.error("Failed to fetch space children:", e);
      } finally {
        setLoadingChildren(spaceId, false);
      }
    },
    [setChildren, setLoadingChildren]
  );

  const fetchSpaces = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<SpaceSummary[]>("get_spaces");
      setSpaces(result);
      // Auto-fetch children for ALL spaces in parallel
      await Promise.all(result.map((space) => fetchChildren(space.roomId)));
    } catch (e) {
      console.error("Failed to fetch spaces:", e);
      setLoading(false);
    }
  }, [setSpaces, setLoading, fetchChildren]);

  const refreshSpaceChildren = useCallback(async () => {
    const currentSpaces = useSpacesStore.getState().spaces;
    await Promise.all(currentSpaces.map((space) => fetchChildren(space.roomId)));
  }, [fetchChildren]);

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

  const getFilteredRoomIds = useCallback(
    (spaceId: string): Set<string> => {
      return childRoomIdsBySpace[spaceId] || new Set();
    },
    [childRoomIdsBySpace]
  );

  return {
    spaces,
    childrenBySpace,
    childRoomIdsBySpace,
    isLoadingChildren,
    selectedSpaceId,
    expandedSpaces,
    isLoading,
    fetchSpaces,
    fetchChildren,
    refreshSpaceChildren,
    createSpace,
    addChild,
    removeChild,
    selectSpace,
    toggleExpanded,
    getFilteredRoomIds,
    buildFlatChildMap,
  };
}
