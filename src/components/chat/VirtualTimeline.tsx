import React, { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  type: string;
  [key: string]: unknown;
}

interface VirtualTimelineProps {
  messages: Message[];
  renderMessage: (message: Message, index: number) => React.ReactNode;
  onLoadMore?: () => Promise<void>;
  estimatedItemHeight?: number;
  overscan?: number;
}

interface VisibleRange {
  start: number;
  end: number;
}

export default function VirtualTimeline({
  messages,
  renderMessage,
  onLoadMore,
  estimatedItemHeight = 60,
  overscan = 5,
}: VirtualTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({ start: 0, end: 20 });
  const [itemHeights, setItemHeights] = useState<Map<string, number>>(new Map());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const observerRef = useRef<ResizeObserver | null>(null);
  const prevMessageCount = useRef(messages.length);

  const getItemHeight = useCallback((id: string) => {
    return itemHeights.get(id) || estimatedItemHeight;
  }, [itemHeights, estimatedItemHeight]);

  const getTotalHeight = useCallback(() => {
    let total = 0;
    for (const msg of messages) {
      total += getItemHeight(msg.id);
    }
    return total;
  }, [messages, getItemHeight]);

  const getOffsetForIndex = useCallback((index: number) => {
    let offset = 0;
    for (let i = 0; i < index && i < messages.length; i++) {
      offset += getItemHeight(messages[i].id);
    }
    return offset;
  }, [messages, getItemHeight]);

  const calculateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    let start = 0;
    let accum = 0;
    for (let i = 0; i < messages.length; i++) {
      const h = getItemHeight(messages[i].id);
      if (accum + h > scrollTop) {
        start = i;
        break;
      }
      accum += h;
    }

    let end = start;
    let visible = 0;
    for (let i = start; i < messages.length; i++) {
      visible += getItemHeight(messages[i].id);
      end = i;
      if (visible > viewportHeight) break;
    }

    setVisibleRange({
      start: Math.max(0, start - overscan),
      end: Math.min(messages.length - 1, end + overscan),
    });
  }, [messages, getItemHeight, overscan]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setStickToBottom(atBottom);

    if (scrollTop < 100 && onLoadMore && !isLoadingMore) {
      setIsLoadingMore(true);
      onLoadMore().finally(() => setIsLoadingMore(false));
    }

    calculateVisibleRange();
  }, [calculateVisibleRange, onLoadMore, isLoadingMore]);

  useEffect(() => {
    calculateVisibleRange();
  }, [messages.length, calculateVisibleRange]);

  useEffect(() => {
    if (stickToBottom && messages.length > prevMessageCount.current) {
      const container = containerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, stickToBottom]);

  useEffect(() => {
    observerRef.current = new ResizeObserver((entries) => {
            setItemHeights((prev) => {
          const newHeights = new Map(prev);
          let changed = false;
          for (const entry of entries) {
            const id = entry.target.getAttribute("data-message-id");
            if (id) {
              const height = entry.contentRect.height;
              if (newHeights.get(id) !== height) {
                newHeights.set(id, height);
                changed = true;
              }
            }
          }
          return changed ? newHeights : prev;
        });
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

  const totalHeight = getTotalHeight();
  const startOffset = getOffsetForIndex(visibleRange.start);
  const visibleMessages = messages.slice(visibleRange.start, visibleRange.end + 1);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        flex: 1, overflowY: "auto", position: "relative",
      }}
      role="log"
      aria-label="Message timeline"
      aria-live="polite"
    >
      {isLoadingMore && (
        <div style={{
          textAlign: "center", padding: 8,
          fontFamily: "var(--font-system)", fontSize: 10, color: "#888",
        }}>
          â³ Loading earlier messages...
        </div>
      )}

      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{
          position: "absolute", top: startOffset, left: 0, right: 0,
        }}>
          {visibleMessages.map((msg, i) => (
            <div
              key={msg.id}
              ref={measureRef}
              data-message-id={msg.id}
            >
              {renderMessage(msg, visibleRange.start + i)}
            </div>
          ))}
        </div>
      </div>

      {!stickToBottom && messages.length > 0 && (
        <button
          onClick={() => {
            const container = containerRef.current;
            if (container) {
              container.scrollTop = container.scrollHeight;
              setStickToBottom(true);
            }
          }}
          aria-label="Scroll to latest messages"
          style={{
            position: "sticky", bottom: 8,
            left: "50%", transform: "translateX(-50%)",
            display: "block", margin: "0 auto",
            padding: "4px 16px", background: "#004B87", color: "#fff",
            border: "2px solid", borderColor: "#0066cc #003366 #003366 #0066cc",
            cursor: "pointer", fontSize: 10, fontFamily: "var(--font-system)",
            borderRadius: 12, zIndex: 10,
          }}
        >
          â†“ New messages
        </button>
      )}
    </div>
  );
}

