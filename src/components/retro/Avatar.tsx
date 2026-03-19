import { useState } from "react";
import styles from "./Avatar.module.css";

export type AvatarSize = "small" | "medium" | "large";
export type PresenceStatus = "online" | "unavailable" | "offline" | null;

interface AvatarProps {
  name: string | null;
  avatarUrl: string | null;
  size?: AvatarSize;
  shape?: "square" | "circle";
  presence?: PresenceStatus;
}

const dotSizeClass: Record<AvatarSize, string> = {
  small: styles.dotSmall,
  medium: styles.dotMedium,
  large: styles.dotLarge,
};

const presenceClass: Record<string, string> = {
  online: styles.online,
  unavailable: styles.unavailable,
  offline: styles.offline,
};

export default function Avatar({
  name,
  avatarUrl,
  size = "small",
  shape = "square",
  presence = null,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || "?")[0];

  return (
    <div className={styles.avatarWrapper}>
      <div className={`${styles.avatar} ${styles[size]} ${styles[shape]}`}>
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt={name || "avatar"}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      {presence && (
        <span
          className={`${styles.presenceDot} ${dotSizeClass[size]} ${presenceClass[presence] || styles.offline}`}
        />
      )}
    </div>
  );
}
