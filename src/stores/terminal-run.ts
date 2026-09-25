import { create } from "zustand";

/** Lets CodeBlock "Run" / Diff stage push into the active PTY writer. */
interface TerminalRunState {
  write: ((data: string) => void) | null;
  pending: string | null;
  setWriter: (write: ((data: string) => void) | null) => void;
  run: (code: string) => boolean;
}

function withNewline(code: string): string {
  return code.endsWith("\n") ? code : `${code}\n`;
}

export const useTerminalRun = create<TerminalRunState>((set, get) => ({
  write: null,
  pending: null,
  setWriter: (write) => {
    const pending = get().pending;
    set({ write });
    if (write && pending) {
      write(withNewline(pending));
      set({ pending: null });
    }
  },
  run: (code) => {
    const write = get().write;
    if (write) {
      write(withNewline(code));
      return true;
    }
    set({ pending: code });
    return false;
  },
}));
