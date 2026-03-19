import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from './LinkPreview.module.css';

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
}

interface LinkPreviewProps {
  messageText: string;
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;

const LinkPreview: React.FC<LinkPreviewProps> = ({ messageText }) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const urls = messageText.match(URL_REGEX);
    if (!urls || urls.length === 0) return;

    const url = urls[0];
    let cancelled = false;

    invoke<LinkPreviewData>('fetch_link_preview', { url })
      .then((data) => {
        if (!cancelled && (data.title || data.description || data.image_url)) {
          setPreview(data);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [messageText]);

  if (!preview || error) return null;

  return (
    <div className={styles.card}>
      {preview.image_url && (
        <div className={styles.imageContainer}>
          <img
            src={preview.image_url}
            alt={preview.title || 'Preview'}
            className={styles.image}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className={styles.content}>
        {preview.site_name && (
          <div className={styles.siteName}>{preview.site_name}</div>
        )}
        {preview.title && (
          <div className={styles.title}>{preview.title}</div>
        )}
        {preview.description && (
          <div className={styles.description}>
            {preview.description.length > 150
              ? preview.description.slice(0, 150) + '…'
              : preview.description}
          </div>
        )}
        <a
          href={preview.url}
          className={styles.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {new URL(preview.url).hostname}
        </a>
      </div>
    </div>
  );
};

export default LinkPreview;
