import { useCallback, useEffect, useRef, useState } from "react";

export function useMediaLazyLoad(threshold = 200) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      { rootMargin: `${threshold}px` }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

// LRU cache for media thumbnails
export class MediaCache {
  private cache = new Map<string, string>();
  private maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  get(key: string): string | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: string): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        const url = this.cache.get(oldest);
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    for (const url of this.cache.values()) {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export const mediaCache = new MediaCache(200);

export function useCachedMedia(mxcUrl: string | null, fetchFn: (url: string) => Promise<string>) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!mxcUrl) return;

    const cached = mediaCache.get(mxcUrl);
    if (cached) {
      setSrc(cached);
      return;
    }

    setLoading(true);
    try {
      const url = await fetchFn(mxcUrl);
      mediaCache.set(mxcUrl, url);
      setSrc(url);
    } catch (e) {
      console.error("Failed to load media:", e);
    } finally {
      setLoading(false);
    }
  }, [mxcUrl, fetchFn]);

  return { src, loading, load };
}
