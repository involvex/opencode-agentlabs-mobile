# Fix: Attachment "+" menu cannot be dismissed on Android

## Problem

Tapping the attachment "+" button in the chat composer opens an action
sheet that cannot be dismissed on Android — none of the buttons respond.

## Root cause

The action sheet was a **native `Alert.alert`** (`app/session/[id].tsx:1233`).
Every other sheet in this app (ModelPicker, VariantPicker, DirectoryBrowserSheet,
PromptLibrarySheet, SlashHelpSheet) is a `@gorhom/bottom-sheet` BottomSheet —
and every one of those dismisses fine (swipe-down, backdrop tap, buttons).

Native `Alert.alert` is the outlier and the only one that can't be dismissed.
The first hypothesis (composer focus + `KeyboardAvoidingView` padding hiding the
dialog) was tested via a full rebuild and made **zero** difference — so it was
wrong. The real issue is the control itself.

## Fix

Replace the native `Alert.alert` with a `@gorhom/bottom-sheet` bottom sheet,
matching the pattern already used by every other sheet in the app.

### New component: `src/components/chat/AttachSheet.tsx`

Modeled on `VariantPicker.tsx`:
- `BottomSheet` with `index={-1}`, `snapPoints={["50%", "75%"]}`,
  `enablePanDownToClose`, `BottomSheetBackdrop` (disappears on index -1).
- Renders a title + a list of `TouchableOpacity` rows (icon + label + desc)
  + a Cancel button that calls `sheetRef.current?.close()`.
- Keyboard-safe by construction (bottom sheets handle the keyboard; native
  alerts do not).

### `app/session/[id].tsx`

1. Add `const attachSheetRef = useRef<BottomSheet>(null);` (line ~155).
2. `showAttachSheet` now calls `attachSheetRef.current?.expand()` instead of
   `Alert.alert(...)`.
3. Render `<AttachSheet sheetRef={attachSheetRef} isDark={isDark}
   actions={[...]} />` at the end of the JSX tree, next to the other sheets.
4. Export `AttachSheet` from `src/components/chat/index.ts`.

## Files

- `src/components/chat/AttachSheet.tsx` — new (modeled on VariantPicker.tsx)
- `src/components/chat/index.ts` — export added
- `app/session/[id].tsx` — ref added, `showAttachSheet` rewired, sheet rendered

## Validation

1. Tap the "+" attach button → bottom sheet slides up; tap any option
   (Photos/Camera/Files/Paste) → action runs and sheet closes.
2. Swipe down on the sheet, or tap the backdrop → sheet closes.
3. Tap Cancel → sheet closes.
4. Confirm the sheet appears above the keyboard when the composer is open.

## Notes

- The `onLongPress={pickFromCamera}` on the attach button was removed in the
  first attempt (it conflicted with `onPress` on Android). It is not restored;
  Camera is now reachable as a row inside the sheet, which is cleaner.
- The "Reply to message" path (`handleMessageLongPress`) was investigated but
  not changed — it uses the same native `Alert.alert` pattern; if it exhibits
  the same stuck-dialog symptom it should be migrated to a bottom sheet next.