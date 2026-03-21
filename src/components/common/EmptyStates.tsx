

interface EmptyProps {
  icon?: string;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = "ðŸ“­", title, message, action }: EmptyProps) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 32, gap: 8, textAlign: "center",
      fontFamily: "var(--font-system)",
    }}>
      <div style={{ fontSize: 48, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: "bold", color: "#004B87" }}>{title}</div>
      <div style={{ fontSize: 11, color: "#666", maxWidth: 280 }}>{message}</div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 8, padding: "4px 16px",
            background: "#C0C0C0",
            border: "2px solid", borderColor: "#fff #404040 #404040 #fff",
            cursor: "pointer", fontSize: 11,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function EmptyRoomList({ onCreateRoom }: { onCreateRoom: () => void }) {
  return (
    <EmptyState
      icon="ðŸ "
      title="No Rooms Yet"
      message="Join a room or create one to start chatting!"
      action={{ label: "âž• Create Room", onClick: onCreateRoom }}
    />
  );
}

export function EmptyChat() {
  return (
    <EmptyState
      icon="ðŸ’¬"
      title="Select a Buddy or Room"
      message="Choose someone from your Buddy List or a room to start a conversation."
    />
  );
}

export function EmptyMessages() {
  return (
    <EmptyState
      icon="ðŸ“"
      title="No Messages Yet"
      message="Be the first to say something! Type a message below."
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      icon="ðŸ”"
      title="No Results"
      message={`No results found for "${query}". Try a different search term.`}
    />
  );
}

export function EmptyCallHistory() {
  return (
    <EmptyState
      icon="ðŸ“ž"
      title="No Call History"
      message="Your voice and video call history will appear here."
    />
  );
}

export function EmptyPlugins({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      icon="ðŸ§©"
      title="No Plugins Installed"
      message="Extend PufferChat with plugins for extra features."
      action={{ label: "Browse Plugins", onClick: onBrowse }}
    />
  );
}

export function EmptyMembers() {
  return (
    <EmptyState
      icon="ðŸ‘¥"
      title="No Members"
      message="This room doesn't have any other members yet. Send an invite!"
    />
  );
}

