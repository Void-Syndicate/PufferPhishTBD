import { useEffect, useRef } from "react";

interface MemoryInfo {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

/**
 * Memory usage monitoring hook (dev mode only).
 * Logs memory stats periodically to help identify leaks.
 */
export function useMemoryMonitor(intervalMs: number = 30000) {
  const lastUsedRef = useRef(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const perf = performance as unknown as { memory?: MemoryInfo };
    if (!perf.memory) {
      console.log("[Memory Monitor] performance.memory not available in this browser");
      return;
    }

    const check = () => {
      const mem = perf.memory;
      if (!mem) return;

      const usedMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      const totalMB = Math.round(mem.totalJSHeapSize / (1024 * 1024));
      const limitMB = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
      const delta = usedMB - lastUsedRef.current;
      const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;

      console.log(
        `[Memory] Used: ${usedMB}MB (${deltaStr}MB) / Total: ${totalMB}MB / Limit: ${limitMB}MB`
      );

      if (usedMB > totalMB * 0.85) {
        console.warn("[Memory] High memory usage detected!");
      }

      lastUsedRef.current = usedMB;
    };

    check();
    const interval = setInterval(check, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
}

/**
 * LRU Cache with configurable max size.
 * Used for media thumbnail caching and user profile caching.
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Debounce utility for search inputs and other frequent operations.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

export default useMemoryMonitor;
