/**
 * DeviceSelector — Audio/Video device selection popup
 */
import { useEffect } from "react";
import { useCallsStore } from "../../stores/calls";
import { useCall } from "../../hooks/useCall";
import styles from "./Calls.module.css";

interface DeviceSelectorProps {
  onClose: () => void;
}

export default function DeviceSelector({ onClose }: DeviceSelectorProps) {
  const availableDevices = useCallsStore((s) => s.availableDevices);
  const selectedAudioInput = useCallsStore((s) => s.selectedAudioInput);
  const selectedAudioOutput = useCallsStore((s) => s.selectedAudioOutput);
  const selectedVideoInput = useCallsStore((s) => s.selectedVideoInput);
  const { enumerateDevices, switchAudioInput, switchVideoInput } = useCall();

  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  const audioInputs = availableDevices.filter((d) => d.kind === "audioinput");
  const audioOutputs = availableDevices.filter((d) => d.kind === "audiooutput");
  const videoInputs = availableDevices.filter((d) => d.kind === "videoinput");

  return (
    <div className={styles.deviceSelector}>
      <div className={styles.deviceSelectorTitle}>
        {"\u2699\uFE0F"} Audio/Video Devices
      </div>

      {audioInputs.length > 0 && (
        <div className={styles.deviceGroup}>
          <div className={styles.deviceGroupLabel}>{"\uD83C\uDF99\uFE0F"} Microphone</div>
          <select
            className={styles.deviceSelect}
            value={selectedAudioInput || ""}
            onChange={(e) => switchAudioInput(e.target.value)}
          >
            {audioInputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {audioOutputs.length > 0 && (
        <div className={styles.deviceGroup}>
          <div className={styles.deviceGroupLabel}>{"\uD83D\uDD0A"} Speakers</div>
          <select
            className={styles.deviceSelect}
            value={selectedAudioOutput || ""}
            onChange={(e) => useCallsStore.getState().setSelectedAudioOutput(e.target.value)}
          >
            {audioOutputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {videoInputs.length > 0 && (
        <div className={styles.deviceGroup}>
          <div className={styles.deviceGroupLabel}>{"\uD83C\uDFA5"} Camera</div>
          <select
            className={styles.deviceSelect}
            value={selectedVideoInput || ""}
            onChange={(e) => switchVideoInput(e.target.value)}
          >
            {videoInputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ textAlign: "right", marginTop: "6px" }}>
        <button className={styles.clearHistoryBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
