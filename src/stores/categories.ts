import { create } from "zustand";

const STORAGE_KEY = "pufferchat-categories";
const COLLAPSE_KEY = "pufferchat-categories-collapsed";

export const DEFAULT_CATEGORIES = [
  "Favorites",
  "Direct Messages",
  "Groups",
  "Low Priority",
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

export interface CategoriesState {
  /** ordered list of all category names (defaults + custom) */
  categories: string[];
  /** roomId -> category name */
  roomCategoryMap: Record<string, string>;
  /** collapsed state per category */
  collapsed: Record<string, boolean>;

  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
  renameCategory: (oldName: string, newName: string) => void;
  moveRoom: (roomId: string, category: string) => void;
  getCategory: (roomId: string, isDirect: boolean) => string;
  toggleCollapsed: (category: string) => void;
  isCollapsed: (category: string) => boolean;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function persist(state: Pick<CategoriesState, "categories" | "roomCategoryMap">) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ categories: state.categories, roomCategoryMap: state.roomCategoryMap })
  );
}

function persistCollapsed(collapsed: Record<string, boolean>) {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
}

const saved = loadFromStorage<{ categories: string[]; roomCategoryMap: Record<string, string> }>(
  STORAGE_KEY,
  { categories: [...DEFAULT_CATEGORIES], roomCategoryMap: {} }
);

const savedCollapsed = loadFromStorage<Record<string, boolean>>(COLLAPSE_KEY, {});

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  categories: saved.categories,
  roomCategoryMap: saved.roomCategoryMap,
  collapsed: savedCollapsed,

  addCategory: (name: string) => {
    set((s) => {
      if (s.categories.includes(name)) return s;
      const next = { ...s, categories: [...s.categories, name] };
      persist(next);
      return next;
    });
  },

  removeCategory: (name: string) => {
    if ((DEFAULT_CATEGORIES as readonly string[]).includes(name)) return;
    set((s) => {
      const categories = s.categories.filter((c) => c !== name);
      const roomCategoryMap = { ...s.roomCategoryMap };
      for (const [rid, cat] of Object.entries(roomCategoryMap)) {
        if (cat === name) delete roomCategoryMap[rid];
      }
      const next = { ...s, categories, roomCategoryMap };
      persist(next);
      return next;
    });
  },

  renameCategory: (oldName: string, newName: string) => {
    if ((DEFAULT_CATEGORIES as readonly string[]).includes(oldName)) return;
    set((s) => {
      const categories = s.categories.map((c) => (c === oldName ? newName : c));
      const roomCategoryMap = { ...s.roomCategoryMap };
      for (const [rid, cat] of Object.entries(roomCategoryMap)) {
        if (cat === oldName) roomCategoryMap[rid] = newName;
      }
      const next = { ...s, categories, roomCategoryMap };
      persist(next);
      return next;
    });
  },

  moveRoom: (roomId: string, category: string) => {
    set((s) => {
      const roomCategoryMap = { ...s.roomCategoryMap, [roomId]: category };
      const next = { ...s, roomCategoryMap };
      persist(next);
      return next;
    });
  },

  getCategory: (roomId: string, isDirect: boolean): string => {
    const mapped = get().roomCategoryMap[roomId];
    if (mapped) return mapped;
    return isDirect ? "Direct Messages" : "Groups";
  },

  toggleCollapsed: (category: string) => {
    set((s) => {
      const collapsed = { ...s.collapsed, [category]: !s.collapsed[category] };
      persistCollapsed(collapsed);
      return { collapsed };
    });
  },

  isCollapsed: (category: string): boolean => {
    return get().collapsed[category] ?? false;
  },
}));
