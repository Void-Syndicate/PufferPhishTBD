import { create } from "zustand";

export type UploadStatus = "pending" | "uploading" | "complete" | "failed" | "cancelled";

export interface Upload {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: UploadStatus;
  roomId: string;
  startedAt: number;
  error?: string;
}

interface UploadsState {
  uploads: Record<string, Upload>;
  addUpload: (upload: Omit<Upload, "progress" | "status" | "startedAt">) => void;
  updateProgress: (id: string, progress: number) => void;
  completeUpload: (id: string) => void;
  failUpload: (id: string, error?: string) => void;
  cancelUpload: (id: string) => void;
  removeUpload: (id: string) => void;
}

export const useUploadsStore = create<UploadsState>((set) => ({
  uploads: {},

  addUpload: (upload) =>
    set((state) => ({
      uploads: {
        ...state.uploads,
        [upload.id]: { ...upload, progress: 0, status: "uploading", startedAt: Date.now() },
      },
    })),

  updateProgress: (id, progress) =>
    set((state) => {
      const u = state.uploads[id];
      if (!u) return state;
      return { uploads: { ...state.uploads, [id]: { ...u, progress } } };
    }),

  completeUpload: (id) =>
    set((state) => {
      const u = state.uploads[id];
      if (!u) return state;
      return { uploads: { ...state.uploads, [id]: { ...u, progress: 100, status: "complete" } } };
    }),

  failUpload: (id, error) =>
    set((state) => {
      const u = state.uploads[id];
      if (!u) return state;
      return { uploads: { ...state.uploads, [id]: { ...u, status: "failed", error } } };
    }),

  cancelUpload: (id) =>
    set((state) => {
      const u = state.uploads[id];
      if (!u) return state;
      return { uploads: { ...state.uploads, [id]: { ...u, status: "cancelled" } } };
    }),

  removeUpload: (id) =>
    set((state) => {
      const { [id]: removed, ...rest } = state.uploads;
      void removed;
      return { uploads: rest };
    }),
}));
