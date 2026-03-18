import { ReactNode } from "react";
import styles from "./Window.module.css";

interface WindowProps {
  title: string;
  children: ReactNode;
  width?: number | string;
  height?: number | string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
  className?: string;
  icon?: string;
}

export default function Window({
  title,
  children,
  width,
  height,
  onClose,
  onMinimize,
  onMaximize,
  showMinimize = true,
  showMaximize = true,
  showClose = true,
  className = "",
  icon,
}: WindowProps) {
  return (
    <div
      className={`${styles.window} ${className}`}
      style={{ width, height }}
    >
      {/* Title Bar */}
      <div className={styles.titlebar} data-tauri-drag-region>
        <div className={styles.titleLeft}>
          {icon && <img src={icon} className={styles.titleIcon} alt="" />}
          <span className={styles.titleText}>{title}</span>
        </div>
        <div className={styles.titleButtons}>
          {showMinimize && (
            <button className={styles.titleBtn} onClick={onMinimize} aria-label="Minimize">
              <span className={styles.btnMinimize}>_</span>
            </button>
          )}
          {showMaximize && (
            <button className={styles.titleBtn} onClick={onMaximize} aria-label="Maximize">
              <span className={styles.btnMaximize}>□</span>
            </button>
          )}
          {showClose && (
            <button className={`${styles.titleBtn} ${styles.titleBtnClose}`} onClick={onClose} aria-label="Close">
              <span className={styles.btnClose}>✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
