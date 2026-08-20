import { useRef, useCallback } from "react";
import type { SlashCommand } from "../lib/slash-commands";

export function useSlashKeyboard(
  commands: SlashCommand[],
  onSelect: (cmd: SlashCommand) => void,
  onDismiss: () => void,
) {
  const selectedIndex = useRef(0);

  const handleKey = useCallback(
    (e: { nativeEvent: { key: string } }) => {
      const key = e.nativeEvent.key.toLowerCase();
      if (key === "arrowdown") {
        selectedIndex.current = Math.min(
          selectedIndex.current + 1,
          commands.length - 1,
        );
        return;
      }
      if (key === "arrowup") {
        selectedIndex.current = Math.max(selectedIndex.current - 1, 0);
        return;
      }
      if (key === "enter") {
        const cmd = commands[selectedIndex.current];
        if (cmd) onSelect(cmd);
        return;
      }
      if (key === "escape") {
        onDismiss();
      }
    },
    [commands, onSelect, onDismiss],
  );

  const resetIndex = useCallback(() => {
    selectedIndex.current = 0;
  }, []);

  return { selectedIndex, handleKey, resetIndex };
}
