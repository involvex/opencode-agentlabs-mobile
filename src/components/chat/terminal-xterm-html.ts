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
  | { type: "fit" }
  | { type: "theme"; theme: XtermTheme }
  | { type: "fontSize"; size: number }
  | { type: "get-buffer" }
  | { type: "get-selection" };

export type XtermOutbound =
  | { type: "ready" }
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "error"; message: string }
  | { type: "longpress"; data: string; hasSelection: boolean }
  | { type: "buffer"; data: string }
  | { type: "selection"; data: string; hasSelection: boolean };

export function buildReceiveScript(msg: XtermInbound): string {
  return `window.__xtermReceive(${JSON.stringify(msg)});true;`;
}

export interface TerminalHtmlOptions {
  theme: XtermTheme;
  fontSize: number;
  scrollback: number;
  vendor: TerminalVendor;
  fontFamily: string;
}

function escapeInlineScript(js: string): string {
  return js.replace(/<\/script/gi, "<\\/script");
}

export function buildTerminalHtml(opts: TerminalHtmlOptions): string {
  const { theme, fontSize, scrollback, vendor, fontFamily } = opts;
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
    fontFamily: ${JSON.stringify(fontFamily)},
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
  var host = document.getElementById("terminal");
  term.open(host);
  var lastCols = 0;
  var lastRows = 0;
  var fitRaf = 0;
  function fitAndNotify() {
    if (!fitAddon) return;
    fitAddon.fit();
    var cols = term.cols;
    var rows = term.rows;
    if (!cols || !rows) return;
    if (cols === lastCols && rows === lastRows) return;
    lastCols = cols;
    lastRows = rows;
    post({ type: "resize", cols: cols, rows: rows });
  }
  function scheduleFit() {
    if (fitRaf) cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(function () {
      fitRaf = requestAnimationFrame(fitAndNotify);
    });
  }
  term.onData(function (data) { post({ type: "input", data: data }); });
  window.addEventListener("resize", scheduleFit);
  if (typeof ResizeObserver !== "undefined") {
    var ro = new ResizeObserver(scheduleFit);
    ro.observe(host);
    ro.observe(document.documentElement);
  }
  host.addEventListener("click", function () { term.focus(); });
  function selectionText() {
    try { return term.getSelection() || ""; } catch (e) { return ""; }
  }
  function bufferText() {
    try {
      var buf = term.buffer.active;
      var out = [];
      for (var i = 0; i < buf.length; i++) {
        var line = buf.getLine(i);
        if (!line) continue;
        out.push(line.translateToString(true));
      }
      return out.join("\\n").replace(/\\n+$/, "");
    } catch (e) { return ""; }
  }
  var lpTimer = 0;
  var lpX = 0;
  var lpY = 0;
  var selAnchor = null;
  var selecting = false;
  /*__FIND_WORD_AT_START__*/
  var findWordAt = function (line, col) {
    function isWord(ch) { return /[A-Za-z0-9_./~-]/.test(ch); }
    if (!line || col < 0 || col >= line.length) return null;
    if (!isWord(line[col])) return null;
    var start = col;
    while (start > 0 && isWord(line[start - 1])) start--;
    var end = col;
    while (end < line.length && isWord(line[end])) end++;
    return { start: start, length: end - start };
  };
  /*__FIND_WORD_AT_END__*/
  function cancelLongpress() {
    if (lpTimer) { clearTimeout(lpTimer); lpTimer = 0; }
  }
  function touchCell(clientX, clientY) {
    try {
      var screen = host.querySelector(".xterm-screen");
      if (!screen) return null;
      var rect = screen.getBoundingClientRect();
      if (!rect.width || !rect.height || !term.cols || !term.rows) return null;
      var col = Math.floor((clientX - rect.left) / (rect.width / term.cols));
      var rowView = Math.floor((clientY - rect.top) / (rect.height / term.rows));
      if (col < 0) col = 0;
      if (col > term.cols - 1) col = term.cols - 1;
      if (rowView < 0) rowView = 0;
      if (rowView > term.rows - 1) rowView = term.rows - 1;
      return { col: col, row: rowView + term.buffer.active.viewportY };
    } catch (e) { return null; }
  }
  function lineTextAt(rowAbs) {
    try {
      var line = term.buffer.active.getLine(rowAbs);
      return line ? line.translateToString(true) : "";
    } catch (e) { return ""; }
  }
  function selectWordAt(cell) {
    if (!cell) return false;
    var bounds = findWordAt(lineTextAt(cell.row), cell.col);
    if (!bounds) return false;
    try {
      term.select(bounds.start, cell.row, bounds.length);
      return true;
    } catch (e) { return false; }
  }
  function extendSelection(anchor, cur) {
    try {
      var cols = term.cols;
      var a = anchor.row * cols + anchor.col;
      var b = cur.row * cols + cur.col;
      if (a === b) return;
      var s = a < b ? anchor : cur;
      term.select(s.col, s.row, Math.abs(b - a));
    } catch (e) {}
  }
  function endTouchSelect() {
    cancelLongpress();
    if (!selecting) return;
    selecting = false;
    selAnchor = null;
    var sel = selectionText();
    post({ type: "longpress", data: sel, hasSelection: !!sel });
  }
  host.addEventListener("touchstart", function (e) {
    var t = e.touches[0];
    if (!t) return;
    lpX = t.clientX;
    lpY = t.clientY;
    cancelLongpress();
    selecting = false;
    selAnchor = null;
    lpTimer = setTimeout(function () {
      lpTimer = 0;
      var cell = touchCell(lpX, lpY);
      if (cell) {
        selectWordAt(cell);
        selAnchor = cell;
      }
      selecting = true;
    }, 600);
  }, { passive: true });
  host.addEventListener("touchmove", function (e) {
    var t = e.touches[0];
    if (!t) return;
    if (selecting) {
      var cell = touchCell(t.clientX, t.clientY);
      if (cell && selAnchor) extendSelection(selAnchor, cell);
      return;
    }
    var dx = t.clientX - lpX;
    var dy = t.clientY - lpY;
    if (dx * dx + dy * dy > 100) cancelLongpress();
  }, { passive: true });
  host.addEventListener("touchend", endTouchSelect, { passive: true });
  host.addEventListener("touchcancel", function () {
    cancelLongpress();
    selecting = false;
    selAnchor = null;
  }, { passive: true });
  function handle(msg) {
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "write" && typeof msg.data === "string") term.write(msg.data);
    else if (msg.type === "clear") term.clear();
    else if (msg.type === "focus") term.focus();
    else if (msg.type === "fit") scheduleFit();
    else if (msg.type === "get-buffer") post({ type: "buffer", data: bufferText() });
    else if (msg.type === "get-selection") {
      var sel = selectionText();
      post({ type: "selection", data: sel, hasSelection: !!sel });
    }
    else if (msg.type === "theme" && msg.theme) term.options.theme = msg.theme;
    else if (msg.type === "fontSize" && typeof msg.size === "number") {
      term.options.fontSize = msg.size;
      scheduleFit();
    }
  }
  var queued = window.__xtermQueue;
  window.__xtermQueue = [];
  window.__xtermReceive = handle;
  queued.forEach(handle);
  var boot = document.getElementById("boot");
  if (boot) boot.className = "hidden";
  post({ type: "ready" });
  scheduleFit();
})();
</script>
</body>
</html>`;
}
