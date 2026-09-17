import type { TerminalVendor } from "./terminal-assets";

export const XTERM_VERSION = "5.5.0";
export const XTERM_FIT_VERSION = "0.10.0";

export interface XtermTheme {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
}

export function xtermTheme(isDark: boolean): XtermTheme {
  if (isDark) {
    return {
      background: "#0a0a0a",
      foreground: "#e5e5e5",
      cursor: "#22c55e",
      selectionBackground: "#264f78",
    };
  }
  return {
    background: "#ffffff",
    foreground: "#1a1a1a",
    cursor: "#16a34a",
    selectionBackground: "#add6ff",
  };
}

export type XtermInbound =
  | { type: "write"; data: string }
  | { type: "clear" }
  | { type: "focus" }
  | { type: "theme"; theme: XtermTheme }
  | { type: "fontSize"; size: number };

export type XtermOutbound =
  | { type: "ready" }
  | { type: "input"; data: string }
  | { type: "error"; message: string };

export function buildReceiveScript(msg: XtermInbound): string {
  return `window.__xtermReceive(${JSON.stringify(msg)});true;`;
}

export interface TerminalHtmlOptions {
  theme: XtermTheme;
  fontSize: number;
  scrollback: number;
  vendor: TerminalVendor;
}

function escapeInlineScript(js: string): string {
  return js.replace(/<\/script/gi, "<\\/script");
}

export function buildTerminalHtml(opts: TerminalHtmlOptions): string {
  const { theme, fontSize, scrollback, vendor } = opts;
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<style>${vendor.css}</style>
<style>
html, body { height: 100%; margin: 0; padding: 0; background: ${theme.background}; overflow: hidden; }
#terminal { height: 100%; width: 100%; padding: 8px 8px 8px 12px; box-sizing: border-box; }
#boot { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: ${theme.foreground}; background: ${theme.background};
  font-family: monospace; font-size: 13px; opacity: 0.7; }
#boot.hidden { display: none; }
#load-error { position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
  color: #ef4444; background: ${theme.background}; font-family: monospace;
  font-size: 13px; text-align: center; padding: 24px; }
#load-error.visible { display: flex; }
.xterm { height: 100%; }
</style>
</head>
<body>
<div id="terminal"></div>
<div id="boot">Loading terminal…</div>
<div id="load-error"></div>
<script>${escapeInlineScript(vendor.js)}</script>
<script>${escapeInlineScript(vendor.fit)}</script>
<script>
(function () {
  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }
  function fail(message) {
    var boot = document.getElementById("boot");
    if (boot) boot.className = "hidden";
    var err = document.getElementById("load-error");
    if (err) { err.textContent = message; err.className = "visible"; }
    post({ type: "error", message: message });
  }
  window.__xtermQueue = [];
  window.__xtermReceive = function (msg) { window.__xtermQueue.push(msg); };
  if (typeof Terminal === "undefined") {
    fail("Terminal engine failed to load. Check your connection and retry.");
    return;
  }
  var term = new Terminal({
    fontSize: ${fontSize},
    fontFamily: "Menlo, monospace",
    cursorBlink: true,
    cursorStyle: "bar",
    scrollback: ${scrollback},
    allowTransparency: false,
    theme: {
      background: ${JSON.stringify(theme.background)},
      foreground: ${JSON.stringify(theme.foreground)},
      cursor: ${JSON.stringify(theme.cursor)},
      selectionBackground: ${JSON.stringify(theme.selectionBackground)}
    }
  });
  var fitAddon = null;
  if (typeof FitAddon !== "undefined") {
    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
  }
  term.open(document.getElementById("terminal"));
  if (fitAddon) fitAddon.fit();
  term.onData(function (data) { post({ type: "input", data: data }); });
  window.addEventListener("resize", function () { if (fitAddon) fitAddon.fit(); });
  document.getElementById("terminal").addEventListener("click", function () { term.focus(); });
  function handle(msg) {
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "write" && typeof msg.data === "string") term.write(msg.data);
    else if (msg.type === "clear") term.clear();
    else if (msg.type === "focus") term.focus();
    else if (msg.type === "theme" && msg.theme) term.options.theme = msg.theme;
    else if (msg.type === "fontSize" && typeof msg.size === "number") term.options.fontSize = msg.size;
  }
  var queued = window.__xtermQueue;
  window.__xtermQueue = [];
  window.__xtermReceive = handle;
  queued.forEach(handle);
  var boot = document.getElementById("boot");
  if (boot) boot.className = "hidden";
  post({ type: "ready" });
})();
</script>
</body>
</html>`;
}
