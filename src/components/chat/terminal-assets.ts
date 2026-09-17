import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import addonFitModule from "../../../assets/terminal/addon-fit.js.txt";
import xtermCssModule from "../../../assets/terminal/xterm.css.txt";
import xtermJsModule from "../../../assets/terminal/xterm.js.txt";

export interface TerminalVendor {
  css: string;
  js: string;
  fit: string;
}

function decode(buffer: ArrayBuffer): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(buffer);
  }
  const bytes = new Uint8Array(buffer);
  let text = "";
  for (let i = 0; i < bytes.length; i++) {
    text += String.fromCharCode(bytes[i]);
  }
  return text;
}

async function readBundledText(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  return decode(await new File(uri).arrayBuffer());
}

let cached: Promise<TerminalVendor> | null = null;

export function loadTerminalVendor(): Promise<TerminalVendor> {
  if (!cached) {
    cached = (async () => {
      const [css, js, fit] = await Promise.all([
        readBundledText(xtermCssModule),
        readBundledText(xtermJsModule),
        readBundledText(addonFitModule),
      ]);
      if (!js.includes("Terminal") || !fit.includes("FitAddon")) {
        throw new Error("Terminal engine assets are invalid.");
      }
      return { css, js, fit };
    })();
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
