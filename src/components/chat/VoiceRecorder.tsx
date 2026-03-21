import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { writeFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import styles from "./VoiceRecorder.module.css";

interface VoiceRecorderProps {
  roomId: string;
  onClose: () => void;
}

type RecordingState = "recording" | "preview" | "sending";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceRecorder({ roomId, onClose }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("recording");
  const [elapsed, setElapsed] = useState(0);
  const [waveData, setWaveData] = useState<number[]>(Array(32).fill(2));
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const audioBlobRef = useRef<Blob | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Start recording on mount
  useEffect(() => {
    let cancelled = false;

    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // Set up analyser for waveform
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Prefer OGG/Opus, fallback to webm
        const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
          ? "audio/ogg;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          audioBlobRef.current = blob;
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
          setState("preview");
          stream.getTracks().forEach(t => t.stop());
        };

        recorder.start(100);

        // Timer
        const start = Date.now();
        timerRef.current = setInterval(() => {
          setElapsed((Date.now() - start) / 1000);
        }, 100);

        // Waveform animation
        function drawWave() {
          if (!analyserRef.current) return;
          const data = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(data);
          const bars = Array.from(data).slice(0, 32).map(v => Math.max(2, (v / 255) * 26));
          setWaveData(bars);
          animFrameRef.current = requestAnimationFrame(drawWave);
        }
        drawWave();
      } catch (err) {
        console.error("Microphone access denied:", err);
        onClose();
      }
    }

    startRecording();

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (previewAudioRef.current) { previewAudioRef.current.pause(); }
    onClose();
  }, [audioUrl, onClose]);

  const handleSend = useCallback(async () => {
    if (!audioBlobRef.current) return;
    setState("sending");
    try {
      const arrayBuf = await audioBlobRef.current.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      const ext = audioBlobRef.current.type.includes("ogg") ? "ogg" : "webm";
      const filename = `voice_${Date.now()}.${ext}`;

      // Save to app data temp dir
      try { await mkdir("voice_temp", { baseDir: BaseDirectory.AppData, recursive: true }); } catch {}
      await writeFile(`voice_temp/${filename}`, bytes, { baseDir: BaseDirectory.AppData });

      const appData = await appDataDir();
      const filePath = `${appData}voice_temp/${filename}`;

      await invoke("send_audio", { roomId, filePath, caption: null });
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      onClose();
    } catch (err) {
      console.error("Failed to send audio:", err);
      setState("preview");
    }
  }, [roomId, audioUrl, onClose]);

  const togglePreviewPlayback = useCallback(() => {
    if (!previewAudioRef.current || !audioUrl) return;
    if (isPlaying) {
      previewAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      previewAudioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, audioUrl]);

  useEffect(() => {
    if (audioUrl && state === "preview") {
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      return () => { audio.pause(); audio.src = ""; };
    }
  }, [audioUrl, state]);

  if (state === "recording") {
    return (
      <div className={styles.recorderContainer}>
        <div className={styles.recordingDot} />
        <span className={styles.elapsed}>{formatTime(elapsed)}</span>
        <div className={styles.waveformContainer}>
          {waveData.map((h, i) => (
            <div key={i} className={styles.waveBar} style={{ height: `${h}px` }} />
          ))}
        </div>
        <button className={styles.controlBtn} onClick={stopRecording} title="Stop recording">⏹</button>
        <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
      </div>
    );
  }

  if (state === "preview") {
    return (
      <div className={styles.recorderContainer}>
        <button className={styles.playPauseBtn} onClick={togglePreviewPlayback}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <div className={styles.waveformContainer}>
          {waveData.map((h, i) => (
            <div key={i} className={styles.waveBar} style={{ height: `${h}px` }} />
          ))}
        </div>
        <span className={styles.duration}>{formatTime(elapsed)}</span>
        <button className={styles.sendRecordingBtn} onClick={handleSend}>Send</button>
        <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
      </div>
    );
  }

  // sending state
  return (
    <div className={styles.recorderContainer}>
      <span className={styles.duration}>Sending...</span>
    </div>
  );
}
