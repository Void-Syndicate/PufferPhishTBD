// WidgetAPI — Matrix widget API implementation (postMessage interface per MSC1960/MSC2762)
//
// Implements the fromWidget/toWidget postMessage protocol that allows Matrix widgets
// (embedded web apps) to communicate with the client.

export interface WidgetApiRequest {
  api: 'fromWidget' | 'toWidget';
  requestId: string;
  action: string;
  widgetId: string;
  data?: Record<string, unknown>;
}

export interface WidgetApiResponse {
  api: 'fromWidget' | 'toWidget';
  requestId: string;
  action: string;
  widgetId: string;
  response: Record<string, unknown>;
}

export type WidgetCapability =
  | 'm.send.event:m.room.message'
  | 'm.receive.event:m.room.message'
  | 'm.send.event:m.reaction'
  | 'm.receive.event:m.reaction'
  | 'm.send.state_event:*'
  | 'm.receive.state_event:*'
  | 'm.navigate'
  | 'm.sticker';

export class WidgetApi {
  private widgetId: string;
  private iframe: HTMLIFrameElement | null = null;
  private origin: string = '*';
  private requestHandlers: Map<string, (data: Record<string, unknown>) => Promise<Record<string, unknown>>> = new Map();
  private pendingRequests: Map<string, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }> = new Map();
  private requestCounter = 0;
  private approvedCapabilities = new Set<WidgetCapability>();
  private _messageListener: ((event: MessageEvent) => void) | null = null;

  constructor(widgetId: string) {
    this.widgetId = widgetId;

    // Register default action handlers
    this.requestHandlers.set('capabilities', async (_data) => {
      return {
        capabilities: {
          send_event: ['m.room.message', 'm.reaction'],
          receive_event: ['m.room.message', 'm.reaction'],
        },
      };
    });

    this.requestHandlers.set('content_loaded', async (_data) => {
      return {};
    });

    this.requestHandlers.set('supported_api_versions', async (_data) => {
      return { supported_versions: ['0.0.1', '0.0.2'] };
    });
  }

  /** Attach to an iframe */
  attach(iframe: HTMLIFrameElement, origin?: string): void {
    this.iframe = iframe;
    if (origin) this.origin = origin;
    this._messageListener = this.handleMessage.bind(this);
    window.addEventListener('message', this._messageListener);
  }

  /** Detach and clean up */
  detach(): void {
    if (this._messageListener) {
      window.removeEventListener('message', this._messageListener);
      this._messageListener = null;
    }
    this.iframe = null;
  }

  /** Set approved capabilities */
  setCapabilities(caps: WidgetCapability[]): void {
    this.approvedCapabilities = new Set(caps);
  }

  /** Check if a capability is approved */
  hasCapability(cap: WidgetCapability): boolean {
    return this.approvedCapabilities.has(cap);
  }

  /** Register a handler for widget requests */
  onAction(action: string, handler: (data: Record<string, unknown>) => Promise<Record<string, unknown>>): void {
    this.requestHandlers.set(action, handler);
  }

  /** Send a toWidget request */
  async sendToWidget(action: string, data: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    if (!this.iframe?.contentWindow) {
      throw new Error('Widget iframe not attached');
    }

    const requestId = `req_${++this.requestCounter}_${Date.now()}`;
    const request: WidgetApiRequest = {
      api: 'toWidget',
      requestId,
      action,
      widgetId: this.widgetId,
      data,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      this.iframe!.contentWindow!.postMessage(request, this.origin);

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Widget request timed out: ${action}`));
        }
      }, 15000);
    });
  }

  /** Send widget visibility update */
  async notifyVisibility(visible: boolean): Promise<void> {
    try {
      await this.sendToWidget('visibility', { visible });
    } catch {
      // Widget may not handle visibility
    }
  }

  /** Send a Matrix event to the widget */
  async sendEvent(event: Record<string, unknown>): Promise<void> {
    try {
      await this.sendToWidget('send_event', event);
    } catch {
      // Widget may not handle events
    }
  }

  /** Navigate the widget to a URI */
  async navigate(uri: string): Promise<void> {
    await this.sendToWidget('navigate', { uri });
  }

  private handleMessage(event: MessageEvent): void {
    // Verify source is our iframe
    if (this.iframe && event.source !== this.iframe.contentWindow) return;

    const data = event.data;
    if (!data || typeof data !== 'object') return;

    // Handle fromWidget requests
    if (data.api === 'fromWidget' && data.widgetId === this.widgetId) {
      this.handleFromWidgetRequest(data as WidgetApiRequest);
      return;
    }

    // Handle toWidget responses
    if (data.api === 'toWidget' && data.requestId) {
      const pending = this.pendingRequests.get(data.requestId);
      if (pending) {
        this.pendingRequests.delete(data.requestId);
        pending.resolve(data.response || {});
      }
      return;
    }
  }

  private async handleFromWidgetRequest(request: WidgetApiRequest): Promise<void> {
    const handler = this.requestHandlers.get(request.action);
    let response: Record<string, unknown>;

    if (handler) {
      try {
        response = await handler(request.data || {});
      } catch (e) {
        response = { error: { message: String(e) } };
      }
    } else {
      response = { error: { message: `Unknown action: ${request.action}` } };
    }

    // Send response back to widget
    const responseMsg: WidgetApiResponse = {
      api: 'fromWidget',
      requestId: request.requestId,
      action: request.action,
      widgetId: this.widgetId,
      response,
    };

    if (this.iframe?.contentWindow) {
      this.iframe.contentWindow.postMessage(responseMsg, this.origin);
    }
  }
}
