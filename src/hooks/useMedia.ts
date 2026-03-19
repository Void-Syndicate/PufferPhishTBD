import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";

export function useMedia() {
  const sendImage = useCallback(async (roomId: string, filePath: string, caption?: string) => {
    return invoke<string>("send_image", { roomId, filePath, caption: caption || null });
  }, []);

  const sendVideo = useCallback(async (roomId: string, filePath: string, caption?: string) => {
    return invoke<string>("send_video", { roomId, filePath, caption: caption || null });
  }, []);

  const sendAudio = useCallback(async (roomId: string, filePath: string, caption?: string) => {
    return invoke<string>("send_audio", { roomId, filePath, caption: caption || null });
  }, []);

  const sendFile = useCallback(async (roomId: string, filePath: string) => {
    return invoke<string>("send_file", { roomId, filePath });
  }, []);

  const downloadMedia = useCallback(async (mxcUrl: string, savePath: string) => {
    return invoke<void>("download_media", { mxcUrl, savePath });
  }, []);

  const resolveMxcUrl = useCallback(async (mxcUrl: string, width?: number, height?: number) => {
    return invoke<string>("resolve_mxc_url", { mxcUrl, width: width || 320, height: height || 240 });
  }, []);

  const resolveMxcFullUrl = useCallback(async (mxcUrl: string) => {
    return invoke<string>("resolve_mxc_full_url", { mxcUrl });
  }, []);

  return { sendImage, sendVideo, sendAudio, sendFile, downloadMedia, resolveMxcUrl, resolveMxcFullUrl };
}
