import { create } from "zustand";

/** Lets CodeBlock "Run" push code into the active PTY writer. */
interface TerminalRunState {
  write: ((data: string) => void) | null;
  setWriter: (write: ((data: string) => void) | null) => void;
  run: (code: string) => boolean;
}

export const useTerminalRun = create<TerminalRunState>((set, get) => ({
  write: null,
  setWriter: (write) => set({ write }),
  run: (code) => {
    const write = get().write;
    if (!write) return false;
    write(code.endsWith("\n") ? code : `${code}\n`);
    return true;
  },
}));
