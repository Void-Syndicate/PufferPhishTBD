import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface A11yContextType {
  announcePolite: (message: string) => void;
  announceAssertive: (message: string) => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
  focusVisible: boolean;
}

const A11yContext = createContext<A11yContextType>({
  announcePolite: () => {},
  announceAssertive: () => {},
  highContrast: false,
  setHighContrast: () => {},
  reducedMotion: false,
  setReducedMotion: () => {},
  focusVisible: false,
});

export function useA11y() {
  return useContext(A11yContext);
}

export function A11yProvider({ children }: { children: React.ReactNode }) {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem("puffer-high-contrast") === "true");
  const [reducedMotion, setReducedMotion] = useState(() => {
    const saved = localStorage.getItem("puffer-reduced-motion");
    if (saved !== null) return saved === "true";
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [focusVisible, setFocusVisible] = useState(false);

  const announcePolite = useCallback((message: string) => {
    if (politeRef.current) {
      politeRef.current.textContent = "";
      requestAnimationFrame(() => {
        if (politeRef.current) politeRef.current.textContent = message;
      });
    }
  }, []);

  const announceAssertive = useCallback((message: string) => {
    if (assertiveRef.current) {
      assertiveRef.current.textContent = "";
      requestAnimationFrame(() => {
        if (assertiveRef.current) assertiveRef.current.textContent = message;
      });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("puffer-high-contrast", String(highContrast));
    document.documentElement.classList.toggle("high-contrast", highContrast);
  }, [highContrast]);

  useEffect(() => {
    localStorage.setItem("puffer-reduced-motion", String(reducedMotion));
    document.documentElement.classList.toggle("reduced-motion", reducedMotion);
  }, [reducedMotion]);

  // Detect keyboard vs mouse navigation for focus rings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") setFocusVisible(true);
    };
    const handleMouseDown = () => setFocusVisible(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("focus-visible-mode", focusVisible);
  }, [focusVisible]);

  const srOnlyStyle: React.CSSProperties = {
    position: "absolute", width: 1, height: 1,
    padding: 0, margin: -1, overflow: "hidden",
    clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
  };

  return (
    <A11yContext.Provider value={{
      announcePolite, announceAssertive,
      highContrast, setHighContrast,
      reducedMotion, setReducedMotion,
      focusVisible,
    }}>
      {/* Skip navigation */}
      <a
        href="#main-content"
        style={{
          ...srOnlyStyle,
          position: "absolute", top: 0, left: 0, zIndex: 99999,
        }}
        onFocus={(e) => {
          const el = e.target as HTMLElement;
          el.style.position = "fixed";
          el.style.width = "auto";
          el.style.height = "auto";
          el.style.clip = "auto";
          el.style.padding = "8px 16px";
          el.style.background = "#004B87";
          el.style.color = "#fff";
          el.style.fontSize = "14px";
          el.style.zIndex = "99999";
        }}
        onBlur={(e) => {
          const el = e.target as HTMLElement;
          Object.assign(el.style, srOnlyStyle);
        }}
      >
        Skip to main content
      </a>

      {children}

      {/* Screen reader live regions */}
      <div ref={politeRef} role="status" aria-live="polite" aria-atomic="true" style={srOnlyStyle} />
      <div ref={assertiveRef} role="alert" aria-live="assertive" aria-atomic="true" style={srOnlyStyle} />
    </A11yContext.Provider>
  );
}

// Focus trap hook for modal dialogs
export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const closeBtn = container.querySelector<HTMLElement>('[aria-label*="close" i], [aria-label*="cancel" i]');
        closeBtn?.click();
        return;
      }

      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    first?.focus();
    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  return containerRef;
}
