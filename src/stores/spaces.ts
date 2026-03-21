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
  childRoomIdsBySpace: Record<string, Set<string>>;
  isLoadingChildren: Record<string, boolean>;
  selectedSpaceId: string | null;
  expandedSpaces: Set<string>;
  isLoading: boolean;

  setSpaces: (spaces: SpaceSummary[]) => void;
  setChildren: (spaceId: string, children: SpaceChild[]) => void;
  selectSpace: (spaceId: string | null) => void;
  toggleExpanded: (spaceId: string) => void;
  setLoading: (loading: boolean) => void;
  setLoadingChildren: (spaceId: string, loading: boolean) => void;
  buildFlatChildMap: (spaceId: string) => void;
}

export const useSpacesStore = create<SpacesState>((set, get) => ({
  spaces: [],
  childrenBySpace: {},
  childRoomIdsBySpace: {},
  isLoadingChildren: {},
  selectedSpaceId: null,
  expandedSpaces: new Set(),
  isLoading: false,

  setSpaces: (spaces) => set({ spaces, isLoading: false }),

  setChildren: (spaceId, children) => {
    set((state) => ({
      childrenBySpace: { ...state.childrenBySpace, [spaceId]: children },
    }));
    // Auto-build flat map after setting children
    get().buildFlatChildMap(spaceId);
  },

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

  setLoadingChildren: (spaceId, loading) =>
    set((state) => ({
      isLoadingChildren: { ...state.isLoadingChildren, [spaceId]: loading },
    })),

  buildFlatChildMap: (spaceId) => {
    const state = get();
    const visited = new Set<string>();
    const result = new Set<string>();

    const resolve = (sid: string) => {
      if (visited.has(sid)) return;
      visited.add(sid);
      const children = state.childrenBySpace[sid];
      if (!children) return;
      for (const child of children) {
        result.add(child.roomId);
        if (child.isSpace) {
          resolve(child.roomId);
        }
      }
    };

    resolve(spaceId);
    set((s) => ({
      childRoomIdsBySpace: { ...s.childRoomIdsBySpace, [spaceId]: result },
    }));
  },
}));
