/// Web Worker for heavy operations: search indexing and markdown parsing.
/// Runs off the main thread to prevent UI jank.

interface SearchIndex {
  [roomId: string]: {
    eventId: string;
    body: string;
    sender: string;
    timestamp: number;
  }[];
}

let searchIndex: SearchIndex = {};

function indexMessages(roomId: string, messages: { eventId: string; body: string; sender: string; timestamp: number }[]) {
  searchIndex[roomId] = messages;
}

function searchMessages(query: string, roomId?: string): { eventId: string; body: string; sender: string; timestamp: number; roomId: string }[] {
  const lowerQuery = query.toLowerCase();
  const results: { eventId: string; body: string; sender: string; timestamp: number; roomId: string }[] = [];
  const roomIds = roomId ? [roomId] : Object.keys(searchIndex);

  for (const rid of roomIds) {
    const messages = searchIndex[rid] || [];
    for (const msg of messages) {
      if (msg.body.toLowerCase().includes(lowerQuery)) {
        results.push({ ...msg, roomId: rid });
      }
    }
  }

  results.sort((a, b) => b.timestamp - a.timestamp);
  return results.slice(0, 200);
}

function parseMarkdown(text: string): string {
  let html = text;
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  // Code blocks
  html = html.replace(/```([\s\S]+?)```/g, "<pre><code>$1</code></pre>");
  // Inline code
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Line breaks
  html = html.replace(/\n/g, "<br>");
  return html;
}

self.onmessage = (event: MessageEvent) => {
  const { type, payload, id } = event.data;

  switch (type) {
    case "index": {
      indexMessages(payload.roomId, payload.messages);
      self.postMessage({ type: "indexed", id, payload: { roomId: payload.roomId, count: payload.messages.length } });
      break;
    }
    case "search": {
      const results = searchMessages(payload.query, payload.roomId);
      self.postMessage({ type: "search-results", id, payload: results });
      break;
    }
    case "parse-markdown": {
      const html = parseMarkdown(payload.text);
      self.postMessage({ type: "parsed-markdown", id, payload: html });
      break;
    }
    case "clear": {
      searchIndex = {};
      self.postMessage({ type: "cleared", id });
      break;
    }
    default:
      self.postMessage({ type: "error", id, payload: `Unknown message type: ${type}` });
  }
};

export {};
