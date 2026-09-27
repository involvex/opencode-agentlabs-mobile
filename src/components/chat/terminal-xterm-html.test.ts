import { test } from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import {
  buildReceiveScript,
  buildTerminalHtml,
  xtermTheme,
} from "./terminal-xterm-html.ts";
import type { TerminalVendor } from "./terminal-assets.ts";

const FAKE_VENDOR: TerminalVendor = {
  css: "/* fake xterm css */",
  js: "/* fake Terminal engine */ var Terminal = {};",
  fit: "/* fake FitAddon */ var FitAddon = {};",
};

test("buildTerminalHtml inlines the bundled engine (no remote urls)", () => {
  const html = buildTerminalHtml({
    theme: xtermTheme(true),
    fontSize: 13,
    scrollback: 2000,
    vendor: FAKE_VENDOR,
  });
  assert.ok(html.includes("/* fake xterm css */"));
  assert.ok(html.includes("/* fake Terminal engine */"));
  assert.ok(html.includes("/* fake FitAddon */"));
  assert.ok(!html.includes("cdn.jsdelivr.net"));
  assert.ok(!html.includes("https://"));
  assert.ok(html.includes("term.onData"));
  assert.ok(html.includes("ReactNativeWebView.postMessage"));
  assert.ok(html.includes("window.__xtermReceive"));
  assert.ok(html.includes("#0a0a0a"));
  assert.ok(html.includes("fontSize: 13"));
  assert.ok(html.includes("scrollback: 2000"));
});

test("buildTerminalHtml honors light theme", () => {
  const html = buildTerminalHtml({
    theme: xtermTheme(false),
    fontSize: 15,
    scrollback: 2000,
    vendor: FAKE_VENDOR,
  });
  assert.ok(html.includes("#ffffff"));
  assert.ok(html.includes("fontSize: 15"));
});

test("buildTerminalHtml escapes closing script tags in vendor js", () => {
  const html = buildTerminalHtml({
    theme: xtermTheme(true),
    fontSize: 13,
    scrollback: 2000,
    vendor: { ...FAKE_VENDOR, js: `var s = "</script>";` },
  });
  assert.ok(html.includes(`var s = "<\\/script>";`));
  const opens = html.match(/<script>/g) ?? [];
  const closes = html.match(/<\/script>/g) ?? [];
  assert.equal(opens.length, closes.length);
});

test("buildReceiveScript round-trips the payload through JSON", () => {
  const script = buildReceiveScript({ type: "write", data: "héllo \t\x1b[0m" });
  const prefix = "window.__xtermReceive(";
  const suffix = ");true;";
  assert.ok(script.startsWith(prefix));
  assert.ok(script.endsWith(suffix));
  const payload = JSON.parse(
    script.slice(prefix.length, script.length - suffix.length),
  );
  assert.deepEqual(payload, { type: "write", data: "héllo \t\x1b[0m" });
});

test("buildReceiveScript safely embeds quotes and markup", () => {
  const data = `a"b\\c</script><img src=x onerror=alert(1)>`;
  const script = buildReceiveScript({ type: "write", data });
  const prefix = "window.__xtermReceive(";
  const suffix = ");true;";
  assert.ok(script.endsWith(suffix));
  const payload = JSON.parse(
    script.slice(prefix.length, script.length - suffix.length),
  );
  assert.deepEqual(payload, { type: "write", data });
});

test("buildTerminalHtml schedules ResizeObserver and resize posts", () => {
  const html = buildTerminalHtml({
    theme: xtermTheme(true),
    fontSize: 13,
    scrollback: 2000,
    vendor: FAKE_VENDOR,
  });
  assert.ok(html.includes("ResizeObserver"));
  assert.ok(html.includes('type: "resize"'));
  assert.ok(html.includes("scheduleFit"));
  assert.ok(html.includes('msg.type === "fit"'));
});

test("buildTerminalHtml shows handles and toolbar on touch hold", () => {
  const html = buildTerminalHtml({
    theme: xtermTheme(true),
    fontSize: 13,
    scrollback: 2000,
    vendor: FAKE_VENDOR,
  });
  assert.ok(html.includes('id="selbar"'));
  assert.ok(html.includes('id="hstart"'));
  assert.ok(html.includes('id="hend"'));
  assert.ok(html.includes("showSelUI"));
  assert.ok(html.includes("hideSelUI"));
  assert.ok(html.includes("getSelection"));
  assert.ok(html.includes("getSelectionPosition"));
  assert.ok(html.includes("touchstart"));
  assert.ok(html.includes("touchmove"));
  assert.ok(html.includes("touchend"));
});

test("buildTerminalHtml toolbar copies, pastes and dismisses", () => {
  const html = buildTerminalHtml({
    theme: xtermTheme(true),
    fontSize: 13,
    scrollback: 2000,
    vendor: FAKE_VENDOR,
  });
  assert.ok(html.includes('type: "copy"'));
  assert.ok(html.includes('type: "paste-request"'));
  assert.ok(html.includes("clearSelection"));
  assert.ok(html.includes('msg.type === "labels"'));
  assert.ok(html.includes("translateToString"));
});

test("buildTerminalHtml honors custom toolbar labels", () => {
  const html = buildTerminalHtml({
    theme: xtermTheme(true),
    fontSize: 13,
    scrollback: 2000,
    vendor: FAKE_VENDOR,
    labels: {
      copy: "Kopieren",
      copyAll: "Alles",
      paste: "Einfügen",
      dismiss: "X",
    },
  });
  assert.ok(html.includes("Kopieren"));
  assert.ok(html.includes("Alles"));
});

test("buildTerminalHtml selects the word at the long-press point", () => {
  const html = buildTerminalHtml({
    theme: xtermTheme(true),
    fontSize: 13,
    scrollback: 2000,
    vendor: FAKE_VENDOR,
  });
  assert.ok(html.includes(".xterm-screen"));
  assert.ok(html.includes("viewportY"));
  assert.ok(html.includes("term.select("));
  assert.ok(html.includes("selectWordAt"));
  assert.ok(html.includes("extendSelection"));
  assert.ok(html.includes("findWordAt"));
});

test("buildTerminalHtml defers the menu until touchend for drag-select", () => {
  const html = buildTerminalHtml({
    theme: xtermTheme(true),
    fontSize: 13,
    scrollback: 2000,
    vendor: FAKE_VENDOR,
  });
  assert.ok(html.includes("endTouchSelect"));
  assert.ok(html.includes("selecting = true"));
});

interface WordHit {
  start: number;
  length: number;
}

function extractFindWordAt(
  html: string,
): (line: string, col: number) => WordHit | null {
  const fromMarker = "/*__FIND_WORD_AT_START__*/";
  const toMarker = "/*__FIND_WORD_AT_END__*/";
  const from = html.indexOf(fromMarker);
  const to = html.indexOf(toMarker);
  assert.ok(from !== -1 && to > from, "word finder markers missing");
  const snippet = html.slice(from + fromMarker.length, to);
  const factory = new Function(`${snippet}; return findWordAt;`) as () => (
    line: string,
    col: number,
  ) => WordHit | null;
  return factory();
}

test("embedded word finder selects paths and words like a terminal", () => {
  const html = buildTerminalHtml({
    theme: xtermTheme(true),
    fontSize: 13,
    scrollback: 2000,
    vendor: FAKE_VENDOR,
  });
  const findWordAt = extractFindWordAt(html);
  assert.deepEqual(findWordAt("$ ls src/lib/time-format.ts", 8), {
    start: 5,
    length: 22,
  });
  assert.deepEqual(findWordAt("foo, bar", 1), { start: 0, length: 3 });
  assert.deepEqual(findWordAt("(unchanged)", 2), { start: 1, length: 9 });
  assert.deepEqual(findWordAt("17ms (36ms)", 7), { start: 6, length: 4 });
  assert.equal(findWordAt("foo bar", 3), null);
  assert.equal(findWordAt("", 0), null);
  assert.equal(findWordAt("foo", -1), null);
  assert.equal(findWordAt("foo", 3), null);
});

test("buildTerminalHtml inline script is syntactically valid JS", () => {
  const html = buildTerminalHtml({
    theme: xtermTheme(true),
    fontSize: 13,
    scrollback: 2000,
    vendor: FAKE_VENDOR,
  });
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (m) => m[1],
  );
  assert.ok(blocks.length > 0);
  for (const code of blocks) {
    new Script(code);
  }
});
