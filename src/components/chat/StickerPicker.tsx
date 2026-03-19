import React, { useState } from 'react';
import styles from './StickerPicker.module.css';

interface Sticker {
  url: string;
  body: string;
  info: {
    w?: number;
    h?: number;
    mimetype?: string;
  };
}

interface StickerPack {
  name: string;
  stickers: Sticker[];
}

interface StickerPickerProps {
  onSelect: (sticker: Sticker) => void;
  onClose: () => void;
  packs?: StickerPack[];
}

const StickerPicker: React.FC<StickerPickerProps> = ({ onSelect, onClose, packs = [] }) => {
  const [activeTab, setActiveTab] = useState(0);

  if (packs.length === 0) {
    return (
      <div className={styles.picker}>
        <div className={styles.titleBar}>
          <span>😀 Stickers</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.empty}>
          <p>No sticker packs available.</p>
          <p>Add sticker packs to your Matrix account to use them here.</p>
        </div>
      </div>
    );
  }

  const currentPack = packs[activeTab];

  return (
    <div className={styles.picker}>
      <div className={styles.titleBar}>
        <span>😀 Stickers</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>
      <div className={styles.tabs}>
        {packs.map((pack, i) => (
          <button
            key={i}
            className={`${styles.tab} ${i === activeTab ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(i)}
            title={pack.name}
          >
            {pack.name.length > 8 ? pack.name.slice(0, 8) + '…' : pack.name}
          </button>
        ))}
      </div>
      <div className={styles.grid}>
        {currentPack.stickers.map((sticker, i) => (
          <div
            key={i}
            className={styles.stickerItem}
            onClick={() => onSelect(sticker)}
            title={sticker.body}
          >
            <img src={sticker.url} alt={sticker.body} loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default StickerPicker;
