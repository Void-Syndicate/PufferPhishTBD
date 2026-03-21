/**
 * useCall — WebRTC lifecycle hook for PufferChat
 * Manages RTCPeerConnection, media streams, and Matrix VoIP signaling
 */
import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallsStore, CallInfo, CallHistoryEntry, IceCandidate } from "../stores/calls";
import { useAuthStore } from "../stores/auth";
import { soundEngine } from "../audio/SoundEngine";

interface TurnServerResponse {
  username: string | null;
  password: string | null;
  uris: string[];
  ttl: number;
}

interface CallInvitePayload {
  roomId: string;
  callId: string;
  sender: string;
  senderDisplayName: string | null;
  sdp: string;
  isVideo: boolean;
  lifetimeMs: number;
  partyId: string;
}

interface CallAnswerPayload {
  roomId: string;
  callId: string;
  sender: string;
  sdp: string;
  partyId: string;
}

interface CallCandidatesPayload {
  roomId: string;
  callId: string;
  sender: string;
  candidates: IceCandidate[];
}

interface CallHangupPayload {
  roomId: string;
  callId: string;
  sender: string;
  reason: string | null;
}

export function useCall() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidateBuffer = useRef<RTCIceCandidate[]>([]);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOfferRef = useRef<{ sdp: string; callId: string; roomId: string; partyId: string; sender: string; senderDisplayName: string | null; isVideo: boolean } | null>(null);

  const store = useCallsStore;
  const userId = useAuthStore((s) => s.userId);

  // ---------- ICE server config ----------
  const getIceServers = useCallback(async (): Promise<RTCIceServer[]> => {
    try {
      const turn = await invoke<TurnServerResponse>("get_turn_servers");
      const servers: RTCIceServer[] = [];
      if (turn.uris && turn.uris.length > 0) {
        if (turn.username && turn.password) {
          servers.push({
            urls: turn.uris,
            username: turn.username,
            credential: turn.password,
          });
        } else {
          servers.push({ urls: turn.uris });
        }
      }
      // Always add fallback STUN
      if (!servers.some((s) => s.urls.toString().includes("stun:"))) {
        servers.push({ urls: "stun:stun.l.google.com:19302" });
      }
      return servers;
    } catch {
      return [{ urls: "stun:stun.l.google.com:19302" }];
    }
  }, []);

  // ---------- Media acquisition ----------
  const acquireMedia = useCallback(async (video: boolean): Promise<MediaStream> => {
    const state = store.getState();
    const constraints: MediaStreamConstraints = {
      audio: state.selectedAudioInput
        ? { deviceId: { exact: state.selectedAudioInput } }
        : true,
      video: video
        ? state.selectedVideoInput
          ? { deviceId: { exact: state.selectedVideoInput }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 } }
        : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    store.getState().setLocalStream(stream);
    return stream;
  }, []);

  // ---------- Create peer connection ----------
  const createPeerConnection = useCallback(async (): Promise<RTCPeerConnection> => {
    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const call = store.getState().activeCall;
        if (call) {
          invoke("call_candidates", {
            roomId: call.roomId,
            callId: call.callId,
            partyId: call.partyId,
            candidates: [
              {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
              },
            ],
          }).catch((e) => console.error("Failed to send ICE candidate:", e));
        }
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        store.getState().setRemoteStream(remoteStream);
      } else {
        // Create a new stream from the track
        const newStream = new MediaStream([event.track]);
        const existing = store.getState().remoteStream;
        if (existing) {
          existing.addTrack(event.track);
        } else {
          store.getState().setRemoteStream(newStream);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      const state2 = pc.connectionState;
      if (state2 === "connected") {
        store.getState().updateCallState("connected");
        soundEngine.play("door-open" as any);
        startCallTimer();
        startStatsMonitor(pc);
      } else if (state2 === "disconnected" || state2 === "failed" || state2 === "closed") {
        const call = store.getState().activeCall;
        if (call && call.state !== "ended") {
          endCall("connection_lost");
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      if (iceState === "connected" || iceState === "completed") {
        store.getState().updateCallState("connected");
      }
      // Update connection quality based on ICE state
      if (iceState === "connected" || iceState === "completed") {
        store.getState().setConnectionQuality("good");
      } else if (iceState === "checking") {
        store.getState().setConnectionQuality("fair");
      } else if (iceState === "disconnected") {
        store.getState().setConnectionQuality("poor");
      }
    };

    pcRef.current = pc;
    return pc;
  }, [getIceServers]);

  // ---------- Start call timer ----------
  const startCallTimer = useCallback(() => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    const start = Date.now();
    callTimerRef.current = setInterval(() => {
      store.getState().setCallDuration(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }, []);

  // ---------- Stats monitor ----------
  const startStatsMonitor = useCallback((pc: RTCPeerConnection) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    let lastBytesReceived = 0;
    let lastTimestamp = 0;
    statsIntervalRef.current = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            const now = report.timestamp;
            const bytes = report.bytesReceived || 0;
            if (lastTimestamp > 0) {
              const elapsed = (now - lastTimestamp) / 1000;
              const bitrate = Math.round(((bytes - lastBytesReceived) * 8) / elapsed);
              store.getState().setBitrate(bitrate);
              if (bitrate > 500000) store.getState().setConnectionQuality("excellent");
              else if (bitrate > 200000) store.getState().setConnectionQuality("good");
              else if (bitrate > 50000) store.getState().setConnectionQuality("fair");
              else store.getState().setConnectionQuality("poor");
            }
            lastBytesReceived = bytes;
            lastTimestamp = now;
          }
        });
      } catch { /* ignore */ }
    }, 3000);
  }, []);

  // ---------- Cleanup ----------
  const cleanup = useCallback(() => {
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    if (ringingTimerRef.current) { clearTimeout(ringingTimerRef.current); ringingTimerRef.current = null; }
    if (statsIntervalRef.current) { clearInterval(statsIntervalRef.current); statsIntervalRef.current = null; }
    const localStream = store.getState().localStream;
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      store.getState().setLocalStream(null);
    }
    const screenStream = store.getState().screenShareStream;
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      store.getState().setScreenShareStream(null);
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    store.getState().setRemoteStream(null);
    iceCandidateBuffer.current = [];
    pendingOfferRef.current = null;
  }, []);

  // ---------- Start outgoing call ----------
  const startCall = useCallback(async (roomId: string, isVideo: boolean) => {
    try {
      const pc = await createPeerConnection();
      const stream = await acquireMedia(isVideo);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const result = await invoke<{ callId: string; partyId: string; callInfo: CallInfo }>("call_invite", {
        roomId,
        sdpOffer: offer.sdp!,
        isVideo,
      });

      store.getState().setActiveCall(result.callInfo);
      soundEngine.play("notification" as any); // outgoing ring sound

      // Set a 60-second timeout for ringing
      ringingTimerRef.current = setTimeout(() => {
        const call = store.getState().activeCall;
        if (call && call.state === "ringing") {
          endCall("timeout");
        }
      }, 60000);
    } catch (e) {
      console.error("Failed to start call:", e);
      cleanup();
      soundEngine.play("error" as any);
    }
  }, [createPeerConnection, acquireMedia, cleanup]);

  // ---------- Answer incoming call ----------
  const answerCall = useCallback(async () => {
    const pending = pendingOfferRef.current;
    if (!pending) {
      console.error("No pending offer to answer");
      return;
    }
    try {
      const pc = await createPeerConnection();
      const stream = await acquireMedia(pending.isVideo);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: pending.sdp }));

      // Apply buffered ICE candidates
      for (const candidate of iceCandidateBuffer.current) {
        await pc.addIceCandidate(candidate).catch(() => {});
      }
      iceCandidateBuffer.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await invoke("call_answer", {
        roomId: pending.roomId,
        callId: pending.callId,
        partyId: pending.partyId,
        sdpAnswer: answer.sdp!,
      });

      store.getState().updateCallState("connecting");
    } catch (e) {
      console.error("Failed to answer call:", e);
      cleanup();
      soundEngine.play("error" as any);
    }
  }, [createPeerConnection, acquireMedia, cleanup]);

  // ---------- Decline / End call ----------
  const endCall = useCallback(async (reason?: string) => {
    const call = store.getState().activeCall;
    if (call) {
      try {
        await invoke("call_hangup", {
          roomId: call.roomId,
          callId: call.callId,
          partyId: call.partyId,
          reason: reason || null,
        });
      } catch (e) {
        console.error("Failed to send hangup:", e);
      }
    }
    soundEngine.play("door-close" as any);
    store.getState().updateCallState("ended");
    setTimeout(() => {
      cleanup();
      store.getState().resetCallState();
    }, 2000); // Show ended screen briefly
  }, [cleanup]);

  // ---------- Decline incoming (without answering) ----------
  const declineCall = useCallback(async () => {
    const call = store.getState().activeCall;
    if (call) {
      try {
        await invoke("call_hangup", {
          roomId: call.roomId,
          callId: call.callId,
          partyId: call.partyId,
          reason: "user_declined",
        });
      } catch (e) {
        console.error("Failed to send decline:", e);
      }
    }
    cleanup();
    store.getState().resetCallState();
  }, [cleanup]);

  // ---------- Toggle mute ----------
  const toggleMute = useCallback(() => {
    const localStream = store.getState().localStream;
    if (localStream) {
      const muted = !store.getState().isMuted;
      localStream.getAudioTracks().forEach((t) => { t.enabled = !muted; });
      store.getState().setMuted(muted);
    }
  }, []);

  // ---------- Toggle video ----------
  const toggleVideo = useCallback(() => {
    const localStream = store.getState().localStream;
    if (localStream) {
      const enabled = !store.getState().isVideoEnabled;
      localStream.getVideoTracks().forEach((t) => { t.enabled = enabled; });
      store.getState().setVideoEnabled(enabled);
    }
  }, []);

  // ---------- Screen sharing ----------
  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: false,
      });
      store.getState().setScreenShareStream(screenStream);
      store.getState().setScreenSharing(true);

      const pc = pcRef.current;
      if (pc) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }
    } catch (e) {
      console.error("Screen share failed:", e);
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    const screenStream = store.getState().screenShareStream;
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      store.getState().setScreenShareStream(null);
    }
    store.getState().setScreenSharing(false);

    // Restore camera track
    const localStream = store.getState().localStream;
    const pc = pcRef.current;
    if (pc && localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }
    }
  }, []);

  // ---------- Device management ----------
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mapped = devices
        .filter((d) => d.kind === "audioinput" || d.kind === "audiooutput" || d.kind === "videoinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `${d.kind} (${d.deviceId.slice(0, 8)})`,
          kind: d.kind as "audioinput" | "audiooutput" | "videoinput",
        }));
      store.getState().setAvailableDevices(mapped);
      return mapped;
    } catch {
      return [];
    }
  }, []);

  const switchAudioInput = useCallback(async (deviceId: string) => {
    store.getState().setSelectedAudioInput(deviceId);
    const localStream = store.getState().localStream;
    const pc = pcRef.current;
    if (localStream && pc) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
        const newTrack = newStream.getAudioTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
        if (sender && newTrack) {
          localStream.getAudioTracks().forEach((t) => { localStream.removeTrack(t); t.stop(); });
          localStream.addTrack(newTrack);
          await sender.replaceTrack(newTrack);
        }
      } catch (e) { console.error("Failed to switch audio input:", e); }
    }
  }, []);

  const switchVideoInput = useCallback(async (deviceId: string) => {
    store.getState().setSelectedVideoInput(deviceId);
    const localStream = store.getState().localStream;
    const pc = pcRef.current;
    if (localStream && pc) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
        const newTrack = newStream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender && newTrack) {
          localStream.getVideoTracks().forEach((t) => { localStream.removeTrack(t); t.stop(); });
          localStream.addTrack(newTrack);
          await sender.replaceTrack(newTrack);
        }
      } catch (e) { console.error("Failed to switch video input:", e); }
    }
  }, []);

  // ---------- Push-to-talk ----------
  const enablePushToTalk = useCallback((enabled: boolean) => {
    store.getState().setPushToTalkEnabled(enabled);
    if (enabled) {
      // Mute by default when PTT is enabled
      const localStream = store.getState().localStream;
      if (localStream) {
        localStream.getAudioTracks().forEach((t) => { t.enabled = false; });
        store.getState().setMuted(true);
      }
    }
  }, []);

  // ---------- Load call history ----------
  const loadCallHistory = useCallback(async () => {
    try {
      const history = await invoke<CallHistoryEntry[]>("get_call_history", { limit: 100 });
      store.getState().setCallHistory(history);
    } catch (e) {
      console.error("Failed to load call history:", e);
    }
  }, []);

  const clearCallHistory = useCallback(async () => {
    try {
      await invoke("clear_call_history");
      store.getState().setCallHistory([]);
    } catch (e) {
      console.error("Failed to clear call history:", e);
    }
  }, []);

  // ---------- Matrix call event listeners ----------
  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    // Incoming call invite
    listen<CallInvitePayload>("matrix://call-invite", (event) => {
      const payload = event.payload;
      // Ignore our own invites
      if (payload.sender === userId) return;
      // Ignore if we already have an active call
      if (store.getState().activeCall) return;

      const callInfo: CallInfo = {
        callId: payload.callId,
        roomId: payload.roomId,
        state: "ringing",
        direction: "incoming",
        peerUserId: payload.sender,
        peerDisplayName: payload.senderDisplayName,
        startedAt: Date.now(),
        endedAt: null,
        isVideo: payload.isVideo,
        partyId: payload.partyId,
      };

      store.getState().setActiveCall(callInfo);
      pendingOfferRef.current = {
        sdp: payload.sdp,
        callId: payload.callId,
        roomId: payload.roomId,
        partyId: payload.partyId,
        sender: payload.sender,
        senderDisplayName: payload.senderDisplayName,
        isVideo: payload.isVideo,
      };

      soundEngine.play("notification" as any); // ringing sound

      // Auto-decline after lifetime
      ringingTimerRef.current = setTimeout(() => {
        const call = store.getState().activeCall;
        if (call && call.state === "ringing" && call.direction === "incoming") {
          cleanup();
          store.getState().resetCallState();
        }
      }, payload.lifetimeMs);
    }).then((u) => unlisteners.push(u));

    // Call answered (remote side sent answer)
    listen<CallAnswerPayload>("matrix://call-answer", async (event) => {
      const payload = event.payload;
      if (payload.sender === userId) return;
      const call = store.getState().activeCall;
      if (!call || call.callId !== payload.callId) return;

      const pc = pcRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: payload.sdp }));
          // Apply buffered ICE candidates
          for (const candidate of iceCandidateBuffer.current) {
            await pc.addIceCandidate(candidate).catch(() => {});
          }
          iceCandidateBuffer.current = [];
          store.getState().updateCallState("connecting");
        } catch (e) {
          console.error("Failed to set remote answer:", e);
        }
      }
    }).then((u) => unlisteners.push(u));

    // ICE candidates from remote
    listen<CallCandidatesPayload>("matrix://call-candidates", async (event) => {
      const payload = event.payload;
      if (payload.sender === userId) return;
      const call = store.getState().activeCall;
      if (!call || call.callId !== payload.callId) return;

      const pc = pcRef.current;
      for (const c of payload.candidates) {
        const candidate = new RTCIceCandidate({
          candidate: c.candidate,
          sdpMid: c.sdpMid ?? undefined,
          sdpMLineIndex: c.sdpMLineIndex ?? undefined,
        });
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(candidate).catch(() => {});
        } else {
          iceCandidateBuffer.current.push(candidate);
        }
      }
    }).then((u) => unlisteners.push(u));

    // Remote hangup
    listen<CallHangupPayload>("matrix://call-hangup", (event) => {
      const payload = event.payload;
      if (payload.sender === userId) return;
      const call = store.getState().activeCall;
      if (!call || call.callId !== payload.callId) return;

      if (call.state === "ringing" && call.direction === "incoming") {
        soundEngine.play("error" as any); // missed call sound
      } else {
        soundEngine.play("door-close" as any);
      }

      store.getState().updateCallState("ended");
      setTimeout(() => {
        cleanup();
        store.getState().resetCallState();
      }, 2000);
    }).then((u) => unlisteners.push(u));

    // Device change listener
    const handleDeviceChange = () => { enumerateDevices(); };
    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);

    // Push-to-talk keyboard handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && store.getState().isPushToTalkEnabled && !store.getState().isPushToTalkActive) {
        e.preventDefault();
        store.getState().setPushToTalkActive(true);
        const localStream = store.getState().localStream;
        if (localStream) {
          localStream.getAudioTracks().forEach((t) => { t.enabled = true; });
          store.getState().setMuted(false);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && store.getState().isPushToTalkEnabled) {
        e.preventDefault();
        store.getState().setPushToTalkActive(false);
        const localStream = store.getState().localStream;
        if (localStream) {
          localStream.getAudioTracks().forEach((t) => { t.enabled = false; });
          store.getState().setMuted(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Initial device enumeration
    enumerateDevices();

    return () => {
      unlisteners.forEach((u) => u());
      navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [userId, cleanup, enumerateDevices]);

  return {
    startCall,
    answerCall,
    endCall,
    declineCall,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    enumerateDevices,
    switchAudioInput,
    switchVideoInput,
    enablePushToTalk,
    loadCallHistory,
    clearCallHistory,
  };
}
