// Pure helpers for the customizable terminal special-key rows.
// Sequences use explicit unicode escapes (ESC, Ctrl+C, Ctrl+V).

export interface TermKey {
  id: string;
  label: string;
  sequence: string;
}

export const MAX_TERM_LABEL = 8;
export const MAX_TERM_SEQUENCE = 8;
export const MAX_TERM_KEYS_PER_ROW = 8;

export const DEFAULT_TERM_NAV: TermKey[] = [
  { id: "up", label: "\u2191", sequence: "\u001b[A" },
  { id: "down", label: "\u2193", sequence: "\u001b[B" },
  { id: "left", label: "\u2190", sequence: "\u001b[D" },
  { id: "right", label: "\u2192", sequence: "\u001b[C" },
  { id: "home", label: "Home", sequence: "\u001b[H" },
  { id: "end", label: "End", sequence: "\u001b[F" },
];

export const DEFAULT_TERM_CTRL: TermKey[] = [
  { id: "tab", label: "Tab", sequence: "	" },
  { id: "esc", label: "Esc", sequence: "\u001b" },
  { id: "ctrl-c", label: "Ctrl+C", sequence: "\u0003" },
  { id: "ctrl-v", label: "Ctrl+V", sequence: "\u0016" },
];

export function validateTermKey(key: TermKey): string | null {
  if (!key.label.trim()) return "Label is required.";
  if (key.label.trim().length > MAX_TERM_LABEL) {
    return `Label must be ${MAX_TERM_LABEL} characters or fewer.`;
  }
  if (!key.sequence) return "Key sequence is required.";
  if (key.sequence.length > MAX_TERM_SEQUENCE) {
    return `Key sequence must be ${MAX_TERM_SEQUENCE} characters or fewer.`;
  }
  return null;
}

/**
 * Merge a stored key row over defaults. Keeps valid user entries,
 * caps length. Returns null when storage has no usable value
 * (first run -> use defaults).
 */
export function mergeTermKeys(
  stored: unknown,
  defaults: TermKey[],
): TermKey[] | null {
  if (stored === null || stored === undefined) return null;
  if (!Array.isArray(stored)) return null;
  const cleaned = (stored as unknown[]).filter(
    (k): k is TermKey =>
      typeof k === "object" &&
      k !== null &&
      typeof (k as TermKey).id === "string" &&
      typeof (k as TermKey).label === "string" &&
      typeof (k as TermKey).sequence === "string" &&
      (k as TermKey).label.length > 0 &&
      (k as TermKey).sequence.length > 0,
  );
  return cleaned.slice(0, MAX_TERM_KEYS_PER_ROW);
}

/**
 * Human-readable rendering of a raw sequence for Settings subtitles,
 * e.g. "\u001b[A" -> "<Esc>[A", "\t" -> "<Tab>".
 */
export function describeSequence(sequence: string): string {
  return sequence
    .replaceAll("\u001b", "<Esc>")
    .replaceAll("	", "<Tab>")
    .replaceAll("\u0003", "<Ctrl+C>")
    .replaceAll("\u0016", "<Ctrl+V>");
}

export function defaultTermKeys(): { nav: TermKey[]; ctrl: TermKey[] } {
  return {
    nav: DEFAULT_TERM_NAV.map((k) => ({ ...k })),
    ctrl: DEFAULT_TERM_CTRL.map((k) => ({ ...k })),
  };
}

const ESC_CHAR = String.fromCharCode(27);

/**
 * Render a raw sequence as editable text: ESC -> \e, TAB -> \t,
 * other control chars -> \xNN. Plain text passes through
 * (backslash is doubled).
 */
export function formatSequenceForEdit(sequence: string): string {
  let out = "";
  for (const ch of sequence) {
    const code = ch.charCodeAt(0);
    if (ch === String.fromCharCode(92)) out += String.fromCharCode(92, 92);
    else if (ch === ESC_CHAR) out += String.fromCharCode(92) + "e";
    else if (ch === String.fromCharCode(9))
      out += String.fromCharCode(92) + "t";
    else if (ch === String.fromCharCode(10))
      out += String.fromCharCode(92) + "n";
    else if (ch === String.fromCharCode(13))
      out += String.fromCharCode(92) + "r";
    else if (code < 32 || code === 127) {
      const hex = code.toString(16).padStart(2, "0");
      out += String.fromCharCode(92) + "x" + hex;
    } else out += ch;
  }
  return out;
}

/**
 * Inverse of formatSequenceForEdit: parses \e \t \n \r \\ and \xNN.
 * Unknown escapes are kept literally (backslash + char).
 */
export function parseSequenceInput(input: string): string {
  const bs = String.fromCharCode(92);
  let out = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch !== bs) {
      out += ch;
      i++;
      continue;
    }
    const next = input[i + 1];
    if (next === undefined) {
      out += bs;
      break;
    }
    if (next === "e") {
      out += ESC_CHAR;
      i += 2;
    } else if (next === "t") {
      out += String.fromCharCode(9);
      i += 2;
    } else if (next === "n") {
      out += String.fromCharCode(10);
      i += 2;
    } else if (next === "r") {
      out += String.fromCharCode(13);
      i += 2;
    } else if (next === bs) {
      out += bs;
      i += 2;
    } else if (next === "x") {
      const hex = input.slice(i + 2, i + 4);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
      } else {
        out += bs;
        i++;
      }
    } else {
      out += bs + next;
      i += 2;
    }
  }
  return out;
}
