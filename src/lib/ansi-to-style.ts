import { type TextStyle } from "react-native";

export interface AnsiSegment {
  text: string;
  style: TextStyle;
}

const ESC = String.fromCharCode(27);

const ANSI_ESCAPE = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

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

function buildStyle(
  fg: string,
  bg: string,
  bold: boolean,
  dim: boolean,
  italic: boolean,
  underline: boolean,
  isDark: boolean,
): TextStyle {
  return {
    color: dim ? (isDark ? "#666666" : "#999999") : fg,
    backgroundColor: bg,
    fontWeight: bold ? "700" : "400",
    fontStyle: italic ? "italic" : "normal",
    textDecorationLine: underline ? "underline" : "none",
    fontFamily: "Menlo, monospace",
  };
}

export function ansiToSegments(raw: string, isDark: boolean): AnsiSegment[] {
  const fg = isDark ? DEFAULT_FG_DARK : DEFAULT_FG_LIGHT;
  const bg = isDark ? DEFAULT_BG_DARK : DEFAULT_BG_LIGHT;

  const segments: AnsiSegment[] = [];
  let currentText = "";
  let currentFg = fg;
  let currentBg = bg;
  let bold = false;
  let dim = false;
  let italic = false;
  let underline = false;

  const parts = raw.split(ANSI_ESCAPE);

  for (const part of parts) {
    if (part.length === 0) continue;

    const trimmed = part.trim();
    const isSgrCodes = /^[0-9;]+$/.test(trimmed) && trimmed.length <= 20;

    if (isSgrCodes) {
      const codes = trimmed.split(";").map(Number);
      for (const code of codes) {
        switch (code) {
          case 0:
            currentFg = fg;
            currentBg = bg;
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
    } else {
      currentText += part;
    }
  }

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

  return segments.length > 0 ? segments : [{ text: raw, style: { color: fg } }];
}
