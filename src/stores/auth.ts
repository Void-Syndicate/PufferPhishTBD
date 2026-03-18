import { create } from "zustand";

export interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;
  homeserver: string;
  displayName: string | null;
  accessToken: string | null;
  deviceId: string | null;
  isConnecting: boolean;
  error: string | null;

  // Actions
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  login: (params: {
    userId: string;
    homeserver: string;
    displayName: string | null;
    accessToken: string;
    deviceId: string;
  }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  userId: null,
  homeserver: "https://matrix.org",
  displayName: null,
  accessToken: null,
  deviceId: null,
  isConnecting: false,
  error: null,

  setConnecting: (connecting) => set({ isConnecting: connecting, error: null }),
  setError: (error) => set({ error, isConnecting: false }),

  login: ({ userId, homeserver, displayName, accessToken, deviceId }) =>
    set({
      isLoggedIn: true,
      userId,
      homeserver,
      displayName,
      accessToken,
      deviceId,
      isConnecting: false,
      error: null,
    }),

  logout: () =>
    set({
      isLoggedIn: false,
      userId: null,
      displayName: null,
      accessToken: null,
      deviceId: null,
      isConnecting: false,
      error: null,
    }),
}));
