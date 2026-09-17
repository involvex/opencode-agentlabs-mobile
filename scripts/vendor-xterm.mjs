// Copies xterm.js UMD bundles from node_modules into assets/terminal/.
// Files use a `.txt` suffix so Metro treats them as static assets (raw text)
// instead of source modules. Run via `bun run vendor:xterm` after bumping
// @xterm/xterm or @xterm/addon-fit, then update XTERM_VERSION /
// XTERM_FIT_VERSION in src/components/chat/terminal-xterm-html.ts to match.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "assets", "terminal");
mkdirSync(outDir, { recursive: true });

const sources = [
  {
    pkg: "@xterm/xterm",
    file: "lib/xterm.js",
    out: "xterm.js.txt",
  },
  {
    pkg: "@xterm/xterm",
    file: "css/xterm.css",
    out: "xterm.css.txt",
  },
  {
    pkg: "@xterm/addon-fit",
    file: "lib/addon-fit.js",
    out: "addon-fit.js.txt",
  },
];

for (const { pkg, file, out } of sources) {
  const src = join(root, "node_modules", pkg, file);
  const dest = join(outDir, out);
  copyFileSync(src, dest);
  console.log(`vendored ${pkg}/${file} -> assets/terminal/${out}`);
}

const versions = Object.fromEntries(
  sources.map(({ pkg }) => {
    const manifest = JSON.parse(
      readFileSync(join(root, "node_modules", pkg, "package.json"), "utf8"),
    );
    return [pkg, manifest.version];
  }),
);
writeFileSync(
  join(outDir, "versions.json"),
  JSON.stringify(versions, null, 2) + "\n",
);
console.log("versions:", versions);
