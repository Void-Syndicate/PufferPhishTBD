import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './GifPicker.module.css';

interface GifResult {
  id: string;
  title: string;
  media_formats: {
    tinygif?: { url: string; dims: number[] };
    gif?: { url: string; dims: number[] };
  };
}

interface GifPickerProps {
  onSelect: (url: string, width: number, height: number) => void;
  onClose: () => void;
  apiKey?: string;
}

const GifPicker: React.FC<GifPickerProps> = ({ onSelect, onClose, apiKey }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const fetchGifs = useCallback(async (searchQuery: string) => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const endpoint = searchQuery.trim()
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(searchQuery)}&key=${apiKey}&limit=20&media_filter=tinygif,gif`
        : `https://tenor.googleapis.com/v2/featured?key=${apiKey}&limit=20&media_filter=tinygif,gif`;
      const resp = await fetch(endpoint);
      const data = await resp.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('GIF fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) fetchGifs('');
  }, [apiKey, fetchGifs]);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchGifs(value), 400);
  };

  const handleSelect = (gif: GifResult) => {
    const media = gif.media_formats.gif || gif.media_formats.tinygif;
    if (media) {
      onSelect(media.url, media.dims[0], media.dims[1]);
    }
  };

  if (!apiKey) {
    return (
      <div className={styles.picker}>
        <div className={styles.titleBar}>
          <span>GIF Search</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.noKey}>
          <p>🎞️ GIF search requires a Tenor API key.</p>
          <p>Add one in Settings to enable GIF search.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      <div className={styles.titleBar}>
        <span>🎞️ GIF Search</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Search Tenor..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className={styles.searchInput}
          autoFocus
        />
      </div>
      <div className={styles.grid}>
        {loading && <div className={styles.loading}>Loading...</div>}
        {!loading && results.map((gif) => {
          const preview = gif.media_formats.tinygif || gif.media_formats.gif;
          return (
            <div
              key={gif.id}
              className={styles.gifItem}
              onClick={() => handleSelect(gif)}
              title={gif.title}
            >
              {preview && <img src={preview.url} alt={gif.title} loading="lazy" />}
            </div>
          );
        })}
        {!loading && results.length === 0 && query && (
          <div className={styles.empty}>No GIFs found</div>
        )}
      </div>
      <div className={styles.attribution}>Powered by Tenor</div>
    </div>
  );
};

export default GifPicker;
