import { useEffect } from "react";

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
}

const globalShortcuts: ShortcutHandler[] = [];

export function registerShortcut(shortcut: ShortcutHandler) {
  globalShortcuts.push(shortcut);
  return () => {
    const idx = globalShortcuts.indexOf(shortcut);
    if (idx >= 0) globalShortcuts.splice(idx, 1);
  };
}

export function getRegisteredShortcuts(): ShortcutHandler[] {
  return [...globalShortcuts];
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        // Allow Escape in inputs
        if (e.key !== "Escape") return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          e.stopPropagation();
          shortcut.handler();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}

export function useGlobalShortcuts(actions: {
  search?: () => void;
  newRoom?: () => void;
  settings?: () => void;
  nextRoom?: () => void;
  prevRoom?: () => void;
  toggleMute?: () => void;
  toggleVideo?: () => void;
  closePanel?: () => void;
  focusComposer?: () => void;
  showShortcuts?: () => void;
}) {
  const shortcuts: ShortcutHandler[] = [];

  if (actions.search) {
    shortcuts.push({ key: "k", ctrl: true, handler: actions.search, description: "Search rooms & messages" });
  }
  if (actions.newRoom) {
    shortcuts.push({ key: "n", ctrl: true, handler: actions.newRoom, description: "Create new room" });
  }
  if (actions.settings) {
    shortcuts.push({ key: ",", ctrl: true, handler: actions.settings, description: "Open settings" });
  }
  if (actions.nextRoom) {
    shortcuts.push({ key: "ArrowDown", alt: true, handler: actions.nextRoom, description: "Next room" });
  }
  if (actions.prevRoom) {
    shortcuts.push({ key: "ArrowUp", alt: true, handler: actions.prevRoom, description: "Previous room" });
  }
  if (actions.toggleMute) {
    shortcuts.push({ key: "m", ctrl: true, shift: true, handler: actions.toggleMute, description: "Toggle mute" });
  }
  if (actions.toggleVideo) {
    shortcuts.push({ key: "e", ctrl: true, shift: true, handler: actions.toggleVideo, description: "Toggle video" });
  }
  if (actions.closePanel) {
    shortcuts.push({ key: "Escape", handler: actions.closePanel, description: "Close panel / dialog" });
  }
  if (actions.focusComposer) {
    shortcuts.push({ key: "t", ctrl: true, handler: actions.focusComposer, description: "Focus message composer" });
  }
  if (actions.showShortcuts) {
    shortcuts.push({ key: "/", ctrl: true, handler: actions.showShortcuts, description: "Show keyboard shortcuts" });
  }

  useKeyboardShortcuts(shortcuts);
}
