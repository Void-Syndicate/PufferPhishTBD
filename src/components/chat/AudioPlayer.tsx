import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./AudioPlayer.module.css";

interface AudioPlayerProps {
  src: string;
  duration?: number;
}

const SPEEDS = [1, 1.5, 2];
const BAR_COUNT = 24;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ src, duration: propDuration }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(propDuration || 0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [waveHeights] = useState(() =>
    Array.from({ length: BAR_COUNT }, () => Math.random() * 16 + 4)
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration);
    };
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onended = () => { setIsPlaying(false); setCurrentTime(0); };

    return () => { audio.pause(); audio.src = ""; };
  }, [src]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const cycleSpeed = useCallback(() => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  }, [speedIndex]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }, [duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const playedBars = duration > 0 ? Math.floor((currentTime / duration) * BAR_COUNT) : 0;

  return (
    <div className={styles.audioPlayer}>
      <button className={styles.playPauseBtn} onClick={togglePlayPause}>
        {isPlaying ? "⏸" : "▶"}
      </button>
      <div className={styles.progressContainer}>
        <div className={styles.waveformContainer} onClick={seek}>
          {waveHeights.map((h, i) => (
            <div
              key={i}
              className={`${styles.waveBar} ${i < playedBars ? styles.waveBarPlayed : ""}`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        <div className={styles.progressBar} onClick={seek}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className={styles.timeDisplay}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
      <button className={styles.speedBtn} onClick={cycleSpeed} title="Playback speed">
        {SPEEDS[speedIndex]}x
      </button>
    </div>
  );
}
