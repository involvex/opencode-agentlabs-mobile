import { test } from "node:test";
import assert from "node:assert/strict";
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
