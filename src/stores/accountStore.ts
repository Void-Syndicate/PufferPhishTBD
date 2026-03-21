import { create } from "zustand";

export interface AccountEntry {
  userId: string;
  homeserver: string;
  displayName: string | null;
  deviceId: string;
  isActive: boolean;
  avatarUrl: string | null;
}

export interface AccountStoreState {
  accounts: AccountEntry[];
  activeAccountId: string | null;
  isLoading: boolean;

  setAccounts: (accounts: AccountEntry[]) => void;
  setActiveAccount: (userId: string) => void;
  addAccount: (account: AccountEntry) => void;
  removeAccount: (userId: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useAccountStore = create<AccountStoreState>((set) => ({
  accounts: [],
  activeAccountId: null,
  isLoading: false,

  setAccounts: (accounts) =>
    set({
      accounts,
      activeAccountId: accounts.find((a) => a.isActive)?.userId ?? null,
    }),

  setActiveAccount: (userId) =>
    set((s) => ({
      activeAccountId: userId,
      accounts: s.accounts.map((a) => ({
        ...a,
        isActive: a.userId === userId,
      })),
    })),

  addAccount: (account) =>
    set((s) => ({
      accounts: [...s.accounts, account],
    })),

  removeAccount: (userId) =>
    set((s) => ({
      accounts: s.accounts.filter((a) => a.userId !== userId),
      activeAccountId:
        s.activeAccountId === userId ? null : s.activeAccountId,
    })),

  setLoading: (loading) => set({ isLoading: loading }),
}));
