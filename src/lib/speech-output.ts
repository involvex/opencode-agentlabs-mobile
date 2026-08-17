import { useEffect, useState, useCallback } from "react";
import * as Speech from "expo-speech";

export interface SpeechOutputState {
  speaking: boolean;
  stop: () => void;
}

export function useSpeechOutput(): SpeechOutputState {
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    try {
      Speech.stop();
    } catch {
      // noop
    }
    setSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      try {
        Speech.stop();
      } catch {
        // noop
      }
    };
  }, []);

  return { speaking, stop };
}

export function speakText(text: string): void {
  if (!text || !text.trim()) return;
  try {
    Speech.speak(text.trim(), {
      rate: 0.95,
      pitch: 1.0,
      voice: undefined,
    });
  } catch {
    // noop
  }
}
