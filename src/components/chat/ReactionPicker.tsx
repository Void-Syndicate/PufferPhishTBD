import styles from "./ReactionPicker.module.css";

const EMOJIS = ["👍", "👎", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👀", "✅", "❌", "💯"];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  return (
    <div className={styles.reactionPicker} onMouseLeave={onClose}>
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          className={styles.emojiBtn}
          onClick={() => { onSelect(emoji); onClose(); }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
