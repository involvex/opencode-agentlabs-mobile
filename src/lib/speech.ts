import { useState, useCallback, useRef, useEffect } from "react";
import { Linking } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

interface SpeechState {
  listening: boolean;
  transcript: string;
  error: string | null;
  needsSettings: boolean;
}

interface SpeechActions {
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
  openSettings: () => void;
  clearError: () => void;
}

export function useSpeech(
  onResult: (text: string) => void,
): SpeechState & SpeechActions {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsSettings, setNeedsSettings] = useState(false);
  const pending = useRef("");

  useSpeechRecognitionEvent("start", () => {
    setListening(true);
    setError(null);
    setTranscript("");
    pending.current = "";
  });

  useSpeechRecognitionEvent("end", () => {
    setListening(false);
    // Deliver final transcript
    if (pending.current.trim()) {
      onResult(pending.current.trim());
    }
    setTranscript("");
    pending.current = "";
  });

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript || "";
    pending.current = text;
    setTranscript(text);
  });

  useSpeechRecognitionEvent("error", (event) => {
    // "no-speech" is not really an error — user just didn't say anything
    if (event.error === "no-speech") {
      setListening(false);
      return;
    }
    setError(event.message || event.error);
    setListening(false);
  });

  const start = useCallback(async () => {
    setError(null);
    setNeedsSettings(false);
    const current = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    if (!current.granted) {
      const requested =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!requested.granted) {
        if (requested.canAskAgain === false) {
          setNeedsSettings(true);
        }
        setError("Microphone permission denied");
        return;
      }
    }
    const services = ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
    if (services.length === 0) {
      setError("No speech recognition service available");
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      continuous: true,
    });
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const cancel = useCallback(() => {
    pending.current = "";
    ExpoSpeechRecognitionModule.abort();
    setListening(false);
    setTranscript("");
  }, []);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setNeedsSettings(false);
  }, []);

  // Stop the native recognition session when the screen unmounts — otherwise
  // the mic stays hot in the background. abort() is a no-op when not listening.
  useEffect(() => {
    return () => {
      ExpoSpeechRecognitionModule.abort();
    };
  }, []);

  return {
    listening,
    transcript,
    error,
    needsSettings,
    start,
    stop,
    cancel,
    openSettings,
    clearError,
  };
}
