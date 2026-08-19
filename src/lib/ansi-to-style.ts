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

const NON_SGR_ANSI =
  /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[\?[0-9;]*[A-Za-ln-z]?|\x1b\[[0-9;?]*[A-Za-ln-z]|\x1b\[[0-9;]*$/g;

const ALL_CSI = /\x1b\[[0-9;]*m/g;

export function ansiToSegments(raw: string, isDark: boolean): AnsiSegment[] {
  const cleaned = raw.replace(NON_SGR_ANSI, "");
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
      for (const code of codes) {
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
