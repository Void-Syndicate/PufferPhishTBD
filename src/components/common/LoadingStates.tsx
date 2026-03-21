import React from "react";

interface LoadingProps {
  message?: string;
  size?: "small" | "medium" | "large";
}

export function HourglassSpinner({ message = "Loading...", size = "medium" }: LoadingProps) {
  const sizeMap = { small: 16, medium: 32, large: 48 };
  const fontSize = { small: 10, medium: 12, large: 14 };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 16, gap: 8,
    }}>
      <div style={{
        fontSize: sizeMap[size],
        animation: "spin 1.5s ease-in-out infinite",
      }}>
        ⏳
      </div>
      <div style={{
        fontFamily: "var(--font-system)", fontSize: fontSize[size],
        color: "#666",
      }}>
        {message}
      </div>
      <style>{`@keyframes spin { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(180deg); } }`}</style>
    </div>
  );
}

export function RunningManLoader({ message = "Please wait..." }: { message?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24, gap: 12,
    }}>
      <div style={{
        fontSize: 48,
        animation: "runBounce 0.6s ease-in-out infinite alternate",
      }}>
        🏃
      </div>
      <div style={{
        fontFamily: "var(--font-system)", fontSize: 12, color: "#004B87",
        fontWeight: "bold",
      }}>
        {message}
      </div>
      <div style={{
        width: 200, height: 4, background: "#ddd",
        border: "1px solid #999", overflow: "hidden",
      }}>
        <div style={{
          width: 60, height: "100%",
          background: "linear-gradient(90deg, #004B87, #0088ff, #004B87)",
          animation: "progressSlide 1.5s ease-in-out infinite",
        }} />
      </div>
      <style>{`
        @keyframes runBounce { from { transform: translateY(0); } to { transform: translateY(-8px); } }
        @keyframes progressSlide { 0% { transform: translateX(-60px); } 100% { transform: translateX(200px); } }
      `}</style>
    </div>
  );
}

export function DialUpLoader({ message = "Connecting..." }: { message?: string }) {
  const [dots, setDots] = React.useState("");

  React.useEffect(() => {
    const timer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 32, gap: 16,
      background: "#000", color: "#0f0",
      fontFamily: "Fixedsys, monospace",
      borderRadius: 4,
    }}>
      <div style={{ fontSize: 14, textAlign: "center" }}>
        <div>╔══════════════════════════╗</div>
        <div>║   PufferChat Modem v1.0  ║</div>
        <div>╚══════════════════════════╝</div>
      </div>
      <div style={{ fontSize: 11 }}>
        {message}{dots}
      </div>
      <div style={{
        width: 180, height: 8, background: "#001100",
        border: "1px solid #0f0", overflow: "hidden",
      }}>
        <div style={{
          width: "100%", height: "100%",
          background: "repeating-linear-gradient(90deg, #0f0 0px, #0f0 4px, transparent 4px, transparent 8px)",
          animation: "dialScroll 2s linear infinite",
        }} />
      </div>
      <style>{`@keyframes dialScroll { from { transform: translateX(-50%); } to { transform: translateX(0); } }`}</style>
    </div>
  );
}

export function InlineLoader({ text = "Loading" }: { text?: string }) {
  const [dots, setDots] = React.useState("");
  React.useEffect(() => {
    const timer = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 400);
    return () => clearInterval(timer);
  }, []);

  return (
    <span style={{ fontFamily: "var(--font-system)", fontSize: 11, color: "#888" }}>
      ⏳ {text}{dots}
    </span>
  );
}
