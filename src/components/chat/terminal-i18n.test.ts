// Guards against untranslated terminal menu keys: every chat.terminal.*
// key used by TerminalWebView/TerminalView must resolve to a non-empty
// string in both locales. (A previous revision called session.terminal.*,
// which does not exist — i18next rendered the raw key path in the dialog.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import en from "../../lib/i18n/en.json" with { type: "json" };
import zhHans from "../../lib/i18n/zh-Hans.json" with { type: "json" };

const here = dirname(fileURLToPath(import.meta.url));

function usedKeys(source: string): string[] {
  const keys = new Set<string>();
  const re = /(?:\bt|translate)\(\s*"([^"]+)"/g;
  let m: RegExpExecArray | null = re.exec(source);
  while (m !== null) {
    keys.add(m[1]);
    m = re.exec(source);
  }
  return [...keys].sort();
}

function resolve(catalog: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, part) => (acc as Record<string, unknown>)?.[part],
      catalog,
    );
}

for (const file of ["TerminalWebView.tsx", "TerminalView.tsx"]) {
  test(`${file}: every t("...") key resolves in both locales`, () => {
    const source = readFileSync(join(here, file), "utf8");
    const keys = usedKeys(source).filter(
      (k) => k.startsWith("chat.") || k.startsWith("session."),
    );
    assert.ok(keys.length > 0, `no i18n keys found in ${file}`);
    for (const key of keys) {
      for (const [name, catalog] of [
        ["en", en],
        ["zh-Hans", zhHans],
      ] as const) {
        const value = resolve(catalog, key);
        assert.equal(
          typeof value,
          "string",
          `${name}.json: "${key}" (used in ${file}) does not resolve`,
        );
        assert.notEqual(
          value,
          "",
          `${name}.json: "${key}" (used in ${file}) is an empty string`,
        );
      }
    }
  });
}
