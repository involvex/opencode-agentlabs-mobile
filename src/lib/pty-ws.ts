export interface PtyWsUrlOptions {
  baseUrl: string;
  ptyId: string;
  directory: string;
  cursor?: number;
  ticket?: string;
}

export function buildPtyWsUrl(opts: PtyWsUrlOptions): string {
  console.log("[PtyWS] buildPtyWsUrl", {
    baseUrl: opts.baseUrl,
    ptyId: opts.ptyId,
    directory: opts.directory,
    hasTicket: !!opts.ticket,
  });
  if (typeof URL === "undefined") {
    throw new Error("URL is not available in this environment.");
  }
  const httpUrl = new URL(
    `/api/pty/${opts.ptyId}/connect`,
    opts.baseUrl.endsWith("/") ? opts.baseUrl : `${opts.baseUrl}/`,
  );
  httpUrl.searchParams.set("location[directory]", opts.directory);
  httpUrl.searchParams.set("cursor", String(opts.cursor ?? 0));

  if (opts.ticket) {
    httpUrl.searchParams.set("ticket", opts.ticket);
  }

  httpUrl.protocol = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  return httpUrl.toString();
}

export type PtyOutputHandler = (chunk: string) => void;
export type PtyCloseHandler = () => void;
export type PtyOpenHandler = () => void;

export class PtyWebSocket {
  private ws: WebSocket | null = null;
  private outputHandler: PtyOutputHandler = () => {};
  private closeHandler: PtyCloseHandler = () => {};
  private openHandler: PtyOpenHandler = () => {};

  connect(
    url: string,
    onOutput: PtyOutputHandler,
    onClose: PtyCloseHandler,
    onOpen?: PtyOpenHandler,
    headers?: Record<string, string>,
  ): void {
    console.log("[PtyWS] connect", {
      url,
      hasWebSocket: typeof WebSocket !== "undefined",
    });
    this.outputHandler = onOutput;
    this.closeHandler = onClose;
    this.openHandler = onOpen || (() => {});

    if (typeof WebSocket === "undefined") {
      console.error("[PtyWS] WebSocket is not available in this environment.");
      this.closeHandler();
      return;
    }

    const WS = WebSocket as unknown as {
      new (
        url: string,
        protocols?: string | string[],
        options?: { headers?: Record<string, string> },
      ): WebSocket;
    };
    this.ws = new WS(url, undefined, { headers });
    this.ws.binaryType = "arraybuffer";

    // Log readyState changes
    const logReadyState = () => {
      if (!this.ws) return;
      const states = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
      console.log(
        "[PtyWS] readyState",
        states[this.ws.readyState] ?? this.ws.readyState,
      );
    };

    // Initial state
    logReadyState();

    // Guard so the close path fires exactly once even if both the timeout
    // and the underlying socket's onclose/onerror run.
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimeout);
      this.closeHandler();
    };

    // Connection timeout (10s). React Native may not deliver onclose for a
    // socket that is still CONNECTING when we close it, so invoke the close
    // handler directly here as well.
    const connectTimeout = setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        console.log("[PtyWS] connection timeout, closing");
        this.ws.close(1000, "connection timeout");
        settle();
      }
    }, 10000);

    this.ws.onopen = () => {
      clearTimeout(connectTimeout);
      logReadyState();
      console.log("[PtyWS] onopen");
      this.openHandler();
    };

    this.ws.onmessage = (event) => {
      const data = event.data;
      if (typeof data === "string") {
        if (data.length > 0 && data.charCodeAt(0) === 0) {
          return;
        }
        this.outputHandler(data);
      } else if (data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(data);
        if (bytes.length > 0 && bytes[0] === 0) {
          return;
        }
        const text =
          typeof TextDecoder !== "undefined"
            ? new TextDecoder().decode(bytes)
            : bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), "");
        this.outputHandler(text);
      }
    };

    this.ws.onclose = (event) => {
      logReadyState();
      console.log("[PtyWS] onclose", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      settle();
    };
    this.ws.onerror = (err) => {
      console.error("[PtyWS] error", err);
      settle();
    };
  }

  send(text: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(text);
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close(1000, "client closing");
      this.ws = null;
    }
    this.outputHandler = () => {};
    this.closeHandler = () => {};
  }
}
