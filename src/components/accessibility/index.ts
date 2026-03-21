import { useEffect, useRef } from "react";

/**
 * Focus trap hook for modal dialogs.
 * Traps Tab/Shift+Tab within a container, supports Escape to close.
 */
export function useFocusTrap(isActive: boolean, onEscape?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;
    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    // Auto-focus first focusable element
    const firstFocusable = container.querySelector<HTMLElement>(focusableSelector);
    if (firstFocusable) {
      requestAnimationFrame(() => firstFocusable.focus());
    }

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive, onEscape]);

  return containerRef;
}

/**
 * Live region announcer for screen readers.
 */
let announceElement: HTMLDivElement | null = null;

function getAnnounceElement(): HTMLDivElement {
  if (announceElement) return announceElement;
  const el = document.createElement("div");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  el.setAttribute("role", "status");
  el.style.position = "absolute";
  el.style.width = "1px";
  el.style.height = "1px";
  el.style.padding = "0";
  el.style.margin = "-1px";
  el.style.overflow = "hidden";
  el.style.clip = "rect(0,0,0,0)";
  el.style.whiteSpace = "nowrap";
  el.style.border = "0";
  document.body.appendChild(el);
  announceElement = el;
  return el;
}

export function announce(message: string, priority: "polite" | "assertive" = "polite") {
  const el = getAnnounceElement();
  el.setAttribute("aria-live", priority);
  el.textContent = "";
  requestAnimationFrame(() => {
    el.textContent = message;
  });
}

/**
 * Skip navigation link component props
 */
export interface SkipNavProps {
  targetId: string;
  label?: string;
}

/**
 * Hook for keyboard shortcut registration
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrlMatch = modifiers.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
      const shiftMatch = modifiers.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = modifiers.alt ? e.altKey : !e.altKey;

      if (e.key.toLowerCase() === key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
        // Don't trigger in input fields unless it's a global shortcut with modifier
        const target = e.target as HTMLElement;
        const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
        if (isInput && !modifiers.ctrl && !modifiers.alt) return;

        e.preventDefault();
        callback();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback, modifiers.ctrl, modifiers.shift, modifiers.alt]);
}

