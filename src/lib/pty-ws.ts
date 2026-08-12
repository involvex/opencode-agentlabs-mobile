function encodeAuthToken(username: string, password: string): string {
  const value = `${username}:${password}`;
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.btoa === "function"
  ) {
    return globalThis.btoa(value);
  }
  throw new Error("Base64 encoding is unavailable in this environment.");
}

export interface PtyWsUrlOptions {
  baseUrl: string;
  ptyId: string;
  directory: string;
  cursor?: number;
  username?: string;
  password?: string;
  ticket?: string;
}

export function buildPtyWsUrl(opts: PtyWsUrlOptions): string {
  console.log("[PtyWS] buildPtyWsUrl", {
    baseUrl: opts.baseUrl,
    ptyId: opts.ptyId,
    directory: opts.directory,
    hasAuth: !!(opts.username && opts.password),
    hasTicket: !!opts.ticket,
  });
  if (typeof URL === "undefined") {
    throw new Error("URL is not available in this environment.");
  }
  const httpUrl = new URL(
    `/api/pty/${opts.ptyId}/connect`,
    opts.baseUrl.endsWith("/") ? opts.baseUrl : `${opts.baseUrl}/`,
  );
  // opencode v2 serves the pty connect route at /api/pty/:id/connect and
  // resolves the working directory from the `location[directory]` query param
  // (the legacy v1 route used `/pty/:id/connect?directory=...`).
  httpUrl.searchParams.set("location[directory]", opts.directory);
  httpUrl.searchParams.set("cursor", String(opts.cursor ?? 0));

  if (opts.ticket) {
    httpUrl.searchParams.set("ticket", opts.ticket);
  } else if (opts.username && opts.password) {
    httpUrl.searchParams.set(
      "auth_token",
      encodeAuthToken(opts.username, opts.password),
    );
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

    this.ws = new WebSocket(url);
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
