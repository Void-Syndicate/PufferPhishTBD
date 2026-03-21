import { create } from "zustand";

export interface SpaceChild {
  roomId: string;
  name: string | null;
  topic: string | null;
  numMembers: number;
  isSpace: boolean;
  order: string | null;
  suggested: boolean;
}

export interface SpaceSummary {
  roomId: string;
  name: string | null;
  topic: string | null;
  avatarUrl: string | null;
  childCount: number;
}

export interface SpacesState {
  spaces: SpaceSummary[];
  childrenBySpace: Record<string, SpaceChild[]>;
  selectedSpaceId: string | null; // null = "All Rooms"
  expandedSpaces: Set<string>;
  isLoading: boolean;

  // Actions
  setSpaces: (spaces: SpaceSummary[]) => void;
  setChildren: (spaceId: string, children: SpaceChild[]) => void;
  selectSpace: (spaceId: string | null) => void;
  toggleExpanded: (spaceId: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useSpacesStore = create<SpacesState>((set) => ({
  spaces: [],
  childrenBySpace: {},
  selectedSpaceId: null,
  expandedSpaces: new Set(),
  isLoading: false,

  setSpaces: (spaces) => set({ spaces, isLoading: false }),

  setChildren: (spaceId, children) =>
    set((state) => ({
      childrenBySpace: { ...state.childrenBySpace, [spaceId]: children },
    })),

  selectSpace: (spaceId) => set({ selectedSpaceId: spaceId }),

  toggleExpanded: (spaceId) =>
    set((state) => {
      const next = new Set(state.expandedSpaces);
      if (next.has(spaceId)) {
        next.delete(spaceId);
      } else {
        next.add(spaceId);
      }
      return { expandedSpaces: next };
    }),

  setLoading: (loading) => set({ isLoading: loading }),
}));
