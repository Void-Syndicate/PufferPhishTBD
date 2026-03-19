import { useSettingsStore } from "../../stores/settings";
import { soundEngine, SoundEvent } from "../../audio/SoundEngine";
import styles from "./SoundSettings.module.css";

const SOUND_EVENTS: { key: SoundEvent; label: string }[] = [
  { key: "message-received", label: "Message Received" },
  { key: "message-sent", label: "Message Sent" },
  { key: "door-open", label: "Buddy Sign On" },
  { key: "door-close", label: "Buddy Sign Off" },
  { key: "welcome", label: "Welcome" },
  { key: "notification", label: "Notification" },
];

export default function SoundSettings({ onClose }: { onClose: () => void }) {
  const { soundEnabled, soundVolume, setSoundEnabled, setSoundVolume } = useSettingsStore();

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setSoundVolume(vol);
    soundEngine.setGlobalVolume(vol);
    soundEngine.saveSettings();
  };

  const handleMuteToggle = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    soundEngine.setGlobalMute(!newVal);
    soundEngine.saveSettings();
  };

  const testSound = (event: SoundEvent) => {
    soundEngine.play(event);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>{"\uD83D\uDD0A"} Sound Settings</span>
        <button className={styles.closeBtn} onClick={onClose}>{"\u2715"}</button>
      </div>
      <div className={styles.content}>
        <label className={styles.row}>
          <input type="checkbox" checked={soundEnabled} onChange={handleMuteToggle} />
          <span>Enable Sound Effects</span>
        </label>

        <div className={styles.row}>
          <label>Volume:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={soundVolume}
            onChange={handleVolumeChange}
            disabled={!soundEnabled}
          />
          <span>{Math.round(soundVolume * 100)}%</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.soundList}>
          {SOUND_EVENTS.map(({ key, label }) => (
            <div key={key} className={styles.soundItem}>
              <span>{label}</span>
              <button
                className={styles.testBtn}
                onClick={() => testSound(key)}
                disabled={!soundEnabled}
              >
                {"\u25B6"} Test
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
