import { useRef, useCallback } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const ctrlPressed = useRef(false);
  const metaPressed = useRef(false);
  const shiftPressed = useRef(false);
  const altPressed = useRef(false);

  const handleKeyPress = useCallback(
    (event: { nativeEvent: { key: string } }) => {
      const key = event.nativeEvent.key.toLowerCase();

      if (key === "control" || key === "ctrl") {
        ctrlPressed.current = true;
        return;
      }
      if (key === "meta" || key === "command" || key === "cmd") {
        metaPressed.current = true;
        return;
      }
      if (key === "shift") {
        shiftPressed.current = true;
        return;
      }
      if (key === "alt" || key === "option") {
        altPressed.current = true;
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl
          ? ctrlPressed.current || metaPressed.current
          : !shortcut.ctrl;
        const metaMatch = shortcut.meta
          ? metaPressed.current || ctrlPressed.current
          : !shortcut.meta;
        const shiftMatch = shortcut.shift
          ? shiftPressed.current
          : !shortcut.shift;
        const altMatch = shortcut.alt ? altPressed.current : !shortcut.alt;

        if (
          key === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          metaMatch &&
          shiftMatch &&
          altMatch
        ) {
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts],
  );

  const textInputProps = {
    onKeyPress: handleKeyPress,
  };

  return {
    textInputProps,
    resetModifiers: useCallback(() => {
      ctrlPressed.current = false;
      metaPressed.current = false;
      shiftPressed.current = false;
      altPressed.current = false;
    }, []),
  };
}
