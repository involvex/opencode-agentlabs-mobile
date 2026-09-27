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
  | { type: "labels"; labels: TerminalLabels };

export type XtermOutbound =
  | { type: "ready" }
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "error"; message: string }
  | { type: "copy"; data: string }
  | { type: "paste-request" };

export interface TerminalLabels {
  copy: string;
  copyAll: string;
  paste: string;
  dismiss: string;
}

export const DEFAULT_TERMINAL_LABELS: TerminalLabels = {
  copy: "Copy",
  copyAll: "Copy all",
  paste: "Paste",
  dismiss: "Dismiss",
};

export function buildReceiveScript(msg: XtermInbound): string {
  return `window.__xtermReceive(${JSON.stringify(msg)});true;`;
}

export interface TerminalHtmlOptions {
  theme: XtermTheme;
  fontSize: number;
  scrollback: number;
  vendor: TerminalVendor;
  fontFamily: string;
  labels?: TerminalLabels;
}

function escapeInlineScript(js: string): string {
  return js.replace(/<\/script/gi, "<\\/script");
}

export function buildTerminalHtml(opts: TerminalHtmlOptions): string {
  const { theme, fontSize, scrollback, vendor, fontFamily } = opts;
  const labels = { ...DEFAULT_TERMINAL_LABELS, ...(opts.labels || {}) };
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<style>${vendor.css}</style>
<style>
html, body { height: 100%; margin: 0; padding: 0; background: ${theme.background}; overflow: hidden; }
#terminal { height: 100%; width: 100%; padding: 8px 8px 8px 12px; box-sizing: border-box; position: relative; }
#selbar { position: absolute; z-index: 20; display: none; flex-direction: row; align-items: center;
  background: rgba(28, 28, 30, 0.96); border-radius: 10px; padding: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45); max-width: 96%; }
#selbar.visible { display: flex; }
#selbar button { background: transparent; border: none; color: #fff;
  font-family: -apple-system, Roboto, sans-serif; font-size: 14px; font-weight: 600;
  padding: 8px 10px; white-space: nowrap; }
#selbar button:active { opacity: 0.5; }
.sel-handle { position: absolute; z-index: 21; display: none; width: 22px; height: 22px;
  border-radius: 11px; background: #22c55e; border: 2px solid #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5); touch-action: none; }
.sel-handle.visible { display: block; }
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
<div id="terminal"><div id="selbar"></div><div id="hstart" class="sel-handle"></div><div id="hend" class="sel-handle"></div></div>
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
  var selShownAt = 0;
  host.addEventListener("click", function () {
    if (selVisible) {
      if (Date.now() - selShownAt < 500) return;
      hideSelUI(true);
      return;
    }
    term.focus();
  });
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
  var selLabels = ${JSON.stringify(labels)};
  var selbar = document.getElementById("selbar");
  var hstart = document.getElementById("hstart");
  var hend = document.getElementById("hend");
  var selVisible = false;
  var dragging = null;
  function setSelLabels(l) {
    if (!l) return;
    if (typeof l.copy === "string") selLabels.copy = l.copy;
    if (typeof l.copyAll === "string") selLabels.copyAll = l.copyAll;
    if (typeof l.paste === "string") selLabels.paste = l.paste;
    if (typeof l.dismiss === "string") selLabels.dismiss = l.dismiss;
    renderSelbar();
  }
  function selAction(act) {
    if (act === "copy") {
      var sel = selectionText();
      if (sel) post({ type: "copy", data: sel });
    } else if (act === "copyall") {
      var all = bufferText();
      if (all) post({ type: "copy", data: all });
    } else if (act === "paste") {
      post({ type: "paste-request" });
    }
    hideSelUI(true);
  }
  function renderSelbar() {
    selbar.textContent = "";
    var hasSel = !!selectionText();
    var actions = hasSel
      ? [["copy", selLabels.copy], ["copyall", selLabels.copyAll], ["paste", selLabels.paste], ["dismiss", selLabels.dismiss]]
      : [["copyall", selLabels.copyAll], ["paste", selLabels.paste], ["dismiss", selLabels.dismiss]];
    actions.forEach(function (a) {
      var b = document.createElement("button");
      b.textContent = a[1];
      b.setAttribute("data-act", a[0]);
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        selAction(a[0]);
      });
      selbar.appendChild(b);
    });
  }
  function selEndpoints() {
    try {
      if (typeof term.getSelectionPosition !== "function") return null;
      var pos = term.getSelectionPosition();
      if (!pos || !pos.start || !pos.end) return null;
      return pos;
    } catch (e) { return null; }
  }
  function cellMetrics() {
    try {
      var screen = host.querySelector(".xterm-screen");
      if (!screen) return null;
      var rect = screen.getBoundingClientRect();
      var hrect = host.getBoundingClientRect();
      if (!rect.width || !rect.height || !term.cols || !term.rows) return null;
      return {
        left: rect.left - hrect.left,
        top: rect.top - hrect.top,
        cellW: rect.width / term.cols,
        cellH: rect.height / term.rows,
        width: hrect.width,
        height: hrect.height
      };
    } catch (e) { return null; }
  }
  function clampSel(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }
  function viewportShift() {
    try { return term.buffer.active.viewportY; } catch (e) { return 0; }
  }
  function showSelUI() {
    renderSelbar();
    var pos = selEndpoints();
    var m = cellMetrics();
    if (!m) { hideSelUI(false); return; }
    var ydisp = viewportShift();
    if (pos) {
      var ax = m.left + pos.start.x * m.cellW;
      var ay = m.top + (pos.start.y - ydisp) * m.cellH;
      var bx = m.left + pos.end.x * m.cellW;
      var by = m.top + (pos.end.y - ydisp) * m.cellH;
      ax = clampSel(ax, 11, m.width - 11);
      ay = clampSel(ay, 11, m.height - 11);
      bx = clampSel(bx, 11, m.width - 11);
      by = clampSel(by, 11, m.height - 11);
      hstart.style.left = Math.round(ax - 11) + "px";
      hstart.style.top = Math.round(ay - 11) + "px";
      hend.style.left = Math.round(bx - 11) + "px";
      hend.style.top = Math.round(by - 11) + "px";
      hstart.className = "sel-handle visible";
      hend.className = "sel-handle visible";
    } else {
      hstart.className = "sel-handle";
      hend.className = "sel-handle";
    }
    selbar.className = "visible";
    var barH = selbar.offsetHeight || 44;
    var barW = selbar.offsetWidth || 220;
    var anchorY = pos ? m.top + (pos.start.y - ydisp) * m.cellH : m.height / 2;
    var ty = anchorY - barH - 34;
    if (ty < 0) ty = anchorY + 34;
    if (ty + barH > m.height - 4) ty = m.height - barH - 4;
    if (ty < 0) ty = 0;
    var tx = pos ? m.left + pos.start.x * m.cellW - 20 : (m.width - barW) / 2;
    if (tx < 4) tx = 4;
    if (tx + barW > m.width - 4) tx = m.width - barW - 4;
    if (tx < 0) tx = 0;
    selbar.style.left = Math.round(tx) + "px";
    selbar.style.top = Math.round(ty) + "px";
    selVisible = true;
    selShownAt = Date.now();
  }
  function hideSelUI(clear) {
    selVisible = false;
    dragging = null;
    selbar.className = "";
    hstart.className = "sel-handle";
    hend.className = "sel-handle";
    if (clear) { try { term.clearSelection(); } catch (e) {} }
  }
  function endTouchSelect() {
    cancelLongpress();
    if (!selecting) return;
    selecting = false;
    selAnchor = null;
    if (selVisible) showSelUI();
  }
  function inSelbar(el) {
    try { return !!el.closest("#selbar"); } catch (e) { return false; }
  }
  host.addEventListener("touchstart", function (e) {
    var t = e.touches[0];
    if (!t) return;
    if (e.target && inSelbar(e.target)) return;
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
      showSelUI();
    }, 600);
  }, { passive: true });
  host.addEventListener("touchmove", function (e) {
    var t = e.touches[0];
    if (!t) return;
    if (selecting) {
      var cell = touchCell(t.clientX, t.clientY);
      if (cell && selAnchor) {
        extendSelection(selAnchor, cell);
        showSelUI();
      }
      return;
    }
    var dx = t.clientX - lpX;
    var dy = t.clientY - lpY;
    if (dx * dx + dy * dy > 100) cancelLongpress();
  }, { passive: true });
  host.addEventListener("touchend", endTouchSelect, { passive: true });
  host.addEventListener("touchcancel", function () {
    cancelLongpress();
    if (selecting && selectionText()) showSelUI();
    selecting = false;
    selAnchor = null;
  }, { passive: true });
  function handleDragStart(which) {
    return function (e) {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      var pos = selEndpoints();
      if (!pos) return;
      var anchor = which === "start" ? pos.end : pos.start;
      dragging = { anchor: { col: anchor.x, row: anchor.y } };
    };
  }
  hstart.addEventListener("touchstart", handleDragStart("start"), { passive: false });
  hend.addEventListener("touchstart", handleDragStart("end"), { passive: false });
  document.addEventListener("touchmove", function (e) {
    if (!dragging) return;
    var t = e.touches[0];
    if (!t) return;
    if (e.cancelable) e.preventDefault();
    var cell = touchCell(t.clientX, t.clientY);
    if (cell) {
      extendSelection(dragging.anchor, cell);
      showSelUI();
    }
  }, { passive: false });
  document.addEventListener("touchend", function () {
    if (dragging) { dragging = null; showSelUI(); }
  }, { passive: true });
  document.addEventListener("touchcancel", function () {
    dragging = null;
  }, { passive: true });
  renderSelbar();
  function handle(msg) {
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "write" && typeof msg.data === "string") {
      term.write(msg.data);
      if (selVisible) showSelUI();
    }
    else if (msg.type === "clear") {
      term.clear();
      hideSelUI(false);
    }
    else if (msg.type === "focus") term.focus();
    else if (msg.type === "fit") scheduleFit();
    else if (msg.type === "labels" && msg.labels) setSelLabels(msg.labels);
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
