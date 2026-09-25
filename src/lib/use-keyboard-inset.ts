import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/** Soft-keyboard visibility + Android bottom inset for layout padding.
 *  iOS should keep using KeyboardAvoidingView; Android adjustResize is
 *  unreliable on modern RN/Expo, so pad by `androidBottom` instead. */
export function useKeyboardInset() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return {
    visible: height > 0,
    height,
    androidBottom: Platform.OS === "android" ? height : 0,
  };
}
