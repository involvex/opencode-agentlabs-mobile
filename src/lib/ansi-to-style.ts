export interface AnsiSegment {
  text: string;
  style: {
    color?: string;
    backgroundColor?: string;
    fontWeight?: "400" | "700";
    fontStyle?: "normal" | "italic";
    textDecorationLine?: "none" | "underline";
    fontFamily?: string;
  };
}

const ANSI_COLORS: Record<number, string> = {
  30: "#000000",
  31: "#cd3131",
  32: "#0dbc79",
  33: "#e5e510",
  34: "#2472c8",
  35: "#bc3fbc",
  36: "#11a8cd",
  37: "#e5e5e5",
  90: "#666666",
  91: "#f14c4c",
  92: "#23d18b",
  93: "#f5f543",
  94: "#3b8eea",
  95: "#d670d6",
  96: "#29b8db",
  97: "#e5e5e5",
};

const DEFAULT_FG_LIGHT = "#1a1a1a";
const DEFAULT_FG_DARK = "#e5e5e5";
const DEFAULT_BG_LIGHT = "#ffffff";
const DEFAULT_BG_DARK = "#0a0a0a";

function color256ToRgb(index: number): string | null {
  if (index < 0 || index > 255) return null;
  if (index < 8) return ANSI_COLORS[index + 30];
  if (index < 16) return ANSI_COLORS[index - 8 + 90];
  if (index < 232) {
    const r = Math.floor((index - 16) / 36);
    const g = Math.floor((index - 16 - r * 36) / 6);
    const b = index - 16 - r * 36 - g * 6;
    const toHex = (v: number) =>
      Math.round((v * 255) / 5)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  // grayscale ramp 232-255
  const hex = Math.round(8 + (index - 232) * 10)
    .toString(16)
    .padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function buildStyle(
  fg: string,
  bg: string,
  bold: boolean,
  dim: boolean,
  italic: boolean,
  underline: boolean,
  isDark: boolean,
): AnsiSegment["style"] {
  return {
    color: dim ? (isDark ? "#666666" : "#999999") : fg,
    backgroundColor: bg,
    fontWeight: bold ? "700" : "400",
    fontStyle: italic ? "italic" : "normal",
    textDecorationLine: underline ? "underline" : "none",
    fontFamily: "Menlo, monospace",
  };
}

// Non-SGR ANSI escapes that should be stripped from terminal output:
// 1. OSC sequences (e.g., \x1b]0;title\x07)
// 2. DEC private mode (\x1b?...)
// 3. CSI sequences with non-SGR final bytes (e.g., \x1b[2J, \x1b[H, cursor movement)
// 4. Incomplete CSI at end of a chunk — no final byte yet (digits/semicolons only),
//    e.g. \x1b[38;5;14 without the closing 'm'. This is the root cause of visible
//    artifacts like "[38;5;14" in terminal output.
// 5. Incomplete CSI mid-line — escaped CSI with digits/semicolons but no final byte,
//    followed by a non-letter (e.g. \x1b[38;5;14\x1b[0m). Without this pattern,
//    the incomplete prefix leaks as visible text before the next valid escape.
const NON_SGR_ANSI =
  /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[\?[0-9;]*[A-Za-ln-z]?|\x1b\[[0-9;?]*[A-Za-ln-z]|\x1b\[[0-9;]*$|\x1b\[[0-9;]+(?=[^\d;A-Za-z])/g;

const ALL_CSI = /\x1b\[[0-9;]*m/g;

// Strip stray escape artifacts that result from escape sequences being split
// across SSE chunks at newline boundaries:
// - Lone ESC characters not followed by valid SGR
// - Fragment SGR without ESC prefix: [38;5;14m or [m (ESC arrived in previous chunk)
// - Fragment incomplete CSI without ESC prefix: [38;5;14 (no 'm')
//
// Pattern 2 uses [0-9;]* (not [0-9]+) to also catch bare [m fragments (zero digits).
// Pattern 3 uses a lookahead instead of $ to catch fragments in the middle of text,
// not just at end-of-string.
function stripStrayEscapes(cleaned: string): string {
  return cleaned
    .replace(/\x1b(?!\[[0-9;]*m)/g, "")
    .replace(/(?<!\x1b)\[[0-9;]*m/g, "")
    .replace(/(?<!\x1b)\[[0-9;]+(?=[^\d;]|$)/g, "");
}

export function ansiToSegments(raw: string, isDark: boolean): AnsiSegment[] {
  const cleaned = stripStrayEscapes(raw.replace(NON_SGR_ANSI, ""));
  const defaultFg = isDark ? DEFAULT_FG_DARK : DEFAULT_FG_LIGHT;
  const defaultBg = isDark ? DEFAULT_BG_DARK : DEFAULT_BG_LIGHT;

  const segments: AnsiSegment[] = [];
  let currentText = "";
  let currentFg = defaultFg;
  let currentBg = defaultBg;
  let bold = false;
  let dim = false;
  let italic = false;
  let underline = false;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ALL_CSI.exec(cleaned)) !== null) {
    const textBefore = cleaned.slice(lastIndex, match.index);
    if (textBefore) currentText += textBefore;

    const csi = match[0];
    if (csi.endsWith("m")) {
      if (currentText) {
        segments.push({
          text: currentText,
          style: buildStyle(
            currentFg,
            currentBg,
            bold,
            dim,
            italic,
            underline,
            isDark,
          ),
        });
        currentText = "";
      }
      const paramStr = csi.slice(csi.indexOf("[") + 1, -1);
      const codes = paramStr
        .split(";")
        .filter((s) => s.length > 0)
        .map(Number);
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i];
        switch (code) {
          case 0:
            currentFg = defaultFg;
            currentBg = defaultBg;
            bold = false;
            dim = false;
            italic = false;
            underline = false;
            break;
          case 1:
            bold = true;
            break;
          case 2:
            dim = true;
            break;
          case 3:
            italic = true;
            break;
          case 4:
            underline = true;
            break;
          case 22:
            bold = false;
            dim = false;
            break;
          case 23:
            italic = false;
            break;
          case 24:
            underline = false;
            break;
          case 38: {
            const mode = codes[i + 1];
            if (mode === 5) {
              const colorIndex = codes[i + 2];
              const rgb = color256ToRgb(colorIndex);
              if (rgb) {
                currentFg = rgb;
                i += 2;
              }
            } else if (mode === 2) {
              const r = codes[i + 2],
                g = codes[i + 3],
                b = codes[i + 4];
              currentFg = rgbToHex(r, g, b);
              i += 4;
            }
            break;
          }
          case 48: {
            const mode = codes[i + 1];
            if (mode === 5) {
              const colorIndex = codes[i + 2];
              const rgb = color256ToRgb(colorIndex);
              if (rgb) {
                currentBg = rgb;
                i += 2;
              }
            } else if (mode === 2) {
              const r = codes[i + 2],
                g = codes[i + 3],
                b = codes[i + 4];
              currentBg = rgbToHex(r, g, b);
              i += 4;
            }
            break;
          }
          default:
            if (code >= 30 && code <= 37) currentFg = ANSI_COLORS[code];
            else if (code >= 40 && code <= 47)
              currentBg = ANSI_COLORS[code - 10];
            else if (code >= 90 && code <= 97) currentFg = ANSI_COLORS[code];
            else if (code >= 100 && code <= 107)
              currentBg = ANSI_COLORS[code - 10];
            break;
        }
      }
    }
    lastIndex = match.index + match[0].length;
  }

  const remaining = cleaned.slice(lastIndex);
  if (remaining) currentText += remaining;
  if (currentText) {
    segments.push({
      text: currentText,
      style: buildStyle(
        currentFg,
        currentBg,
        bold,
        dim,
        italic,
        underline,
        isDark,
      ),
    });
  }

  return segments.length > 0
    ? segments
    : [{ text: cleaned, style: { color: defaultFg } }];
}
