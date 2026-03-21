import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("PufferChat Error Boundary caught:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const text = `Error: ${error?.message}\n\nStack: ${error?.stack}\n\nComponent: ${errorInfo?.componentStack}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          position: "fixed", inset: 0,
          background: "#C0C0C0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-system, 'MS Sans Serif', Arial, sans-serif)",
          zIndex: 10000,
        }}>
          <div style={{
            width: 450, background: "#C0C0C0",
            border: "2px solid", borderColor: "#fff #404040 #404040 #fff",
            boxShadow: "2px 2px 0 #000",
          }}>
            <div style={{
              background: "linear-gradient(90deg, #000080, #1084d0)",
              color: "#fff", padding: "3px 6px",
              fontWeight: "bold", fontSize: 12,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              ⚠️ PufferChat Error
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 32 }}>💥</div>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: 12, marginBottom: 4 }}>
                    Something went wrong!
                  </div>
                  <div style={{ fontSize: 11, color: "#333" }}>
                    PufferChat encountered an unexpected error. You can try reloading the component or copy the error details for troubleshooting.
                  </div>
                </div>
              </div>

              <div style={{
                background: "#fff",
                border: "2px solid", borderColor: "#404040 #fff #fff #404040",
                padding: 6, maxHeight: 120, overflowY: "auto",
                fontSize: 10, fontFamily: "Fixedsys, monospace",
                marginBottom: 12, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {this.state.error?.message || "Unknown error"}
                {this.state.error?.stack && (
                  <div style={{ color: "#666", marginTop: 4 }}>
                    {this.state.error.stack.split("\n").slice(1, 6).join("\n")}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                <button
                  onClick={this.handleReload}
                  style={{
                    padding: "4px 20px", background: "#C0C0C0",
                    border: "2px solid", borderColor: "#fff #404040 #404040 #fff",
                    cursor: "pointer", fontSize: 11, fontWeight: "bold",
                  }}
                >
                  🔄 Try Again
                </button>
                <button
                  onClick={this.handleCopyError}
                  style={{
                    padding: "4px 20px", background: "#C0C0C0",
                    border: "2px solid", borderColor: "#fff #404040 #404040 #fff",
                    cursor: "pointer", fontSize: 11,
                  }}
                >
                  📋 Copy Error
                </button>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: "4px 20px", background: "#C0C0C0",
                    border: "2px solid", borderColor: "#fff #404040 #404040 #fff",
                    cursor: "pointer", fontSize: 11,
                  }}
                >
                  🔃 Restart App
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
