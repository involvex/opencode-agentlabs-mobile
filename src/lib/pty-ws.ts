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
}

export function buildPtyWsUrl(opts: PtyWsUrlOptions): string {
  console.log("[PtyWS] buildPtyWsUrl", {
    baseUrl: opts.baseUrl,
    ptyId: opts.ptyId,
    directory: opts.directory,
    hasAuth: !!(opts.username && opts.password),
  });
  if (typeof URL === "undefined") {
    throw new Error("URL is not available in this environment.");
  }
  const httpUrl = new URL(
    `/pty/${opts.ptyId}/connect`,
    opts.baseUrl.endsWith("/") ? opts.baseUrl : `${opts.baseUrl}/`,
  );
  httpUrl.searchParams.set("directory", opts.directory);
  httpUrl.searchParams.set("cursor", String(opts.cursor ?? 0));

  if (opts.username && opts.password) {
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

export class PtyWebSocket {
  private ws: WebSocket | null = null;
  private outputHandler: PtyOutputHandler = () => {};
  private closeHandler: PtyCloseHandler = () => {};

  connect(
    url: string,
    onOutput: PtyOutputHandler,
    onClose: PtyCloseHandler,
  ): void {
    console.log("[PtyWS] connect", {
      url,
      hasWebSocket: typeof WebSocket !== "undefined",
    });
    this.outputHandler = onOutput;
    this.closeHandler = onClose;

    if (typeof WebSocket === "undefined") {
      console.error("[PtyWS] WebSocket is not available in this environment.");
      this.closeHandler();
      return;
    }

    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      console.log("[PtyWS] onopen");
      // Ready for input; state is driven by caller via onOutput/onClose.
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

    this.ws.onclose = () => {
      console.log("[PtyWS] onclose");
      this.closeHandler();
    };
    this.ws.onerror = (err) => {
      console.error("[PtyWS] error", err);
      this.closeHandler();
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
