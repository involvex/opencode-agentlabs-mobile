# Fix: Bottom sheet taps silently fail after Expo SDK 57 upgrade

## Problem

Two user-facing interactions silently stopped working after the app was upgraded to Expo SDK 57:

1. **Sessions list** — tapping the connection bar (server name + directory) at the top of `app/(tabs)/index.tsx` does not open the `DirectorySwitcher` bottom sheet.
2. **Chat screen** — tapping the model chip in the header or toolbar of `app/session/[id].tsx` does not open the `ModelPicker` bottom sheet.

Both interactions use the same pattern: `TouchableOpacity` → `onPress={() => sheetRef.current?.expand()}`.

## Root Cause

`@gorhom/bottom-sheet` is pinned at **v5.2.8** in `package.json`. That version was released in **Dec 2025**, before React Native 0.86 and the new Architecture (Fabric) shipped.

Expo SDK 57 upgraded the app to:
- `react-native` **0.86.2**
- `react` **19.2.3**
- `react-native-reanimated` **4.5.1**
- `react-native-gesture-handler` **2.32.0**
- `react-native-screens` **4.26.0**

`@gorhom/bottom-sheet` v5.2.8 has a known crash on Fabric: it calls `ref.current.unstable_getBoundingClientRect()` during `expand()`/`present()`, but Fabric no longer exposes that method. The result is a `TypeError` thrown **inside the `onPress` event handler**.

React event-handler errors are **not** caught by `ErrorBoundary` (boundaries only catch render/lifecycle errors), so the user sees no UI feedback — just a silent no-op. This matches the reported symptom exactly.

Additional v5.2.8 issues that compound the problem on newer RN:
- Screen/window layout constants were removed in `react-native-screens` v4.26, breaking bottom-sheet's initial position calculation (fixed in v5.2.11).
- `BottomSheetModal` status machine could get out of sync, silently swallowing subsequent `present()` calls (fixed in v5.2.11).
- React 19 mount/unmount cycle could leave a detached portal behind (fixed in v5.2.13).

## Fix

Bump `@gorhom/bottom-sheet` from **5.2.8** to **5.2.14** (latest stable at time of investigation).

### Why 5.2.14
- **5.2.10** — added `typeof` guards for `getBoundingClientRect`, eliminating the Fabric crash.
- **5.2.11** — rewrote modal status logic; removed screen/window layout constants; switched to window-height-based initial position.
- **5.2.13** — restored React mount reset after unmount, preventing detached portals.
- **5.2.14** — read window height from a shared value on the UI thread; allow mount animation alongside keyboard.

No app-side code changes are required; the API surface (`BottomSheet`, `BottomSheetBackdrop`, `BottomSheetView`, `BottomSheetFlatList`, etc.) is unchanged.

## Steps

1. Update `package.json`:
   ```json
   "@gorhom/bottom-sheet": "5.2.14"
   ```
2. Run `bun install` to update the lockfile.
3. Rebuild the Android app (`bun run android` or `bun run android:install`).
4. Verify:
   - Tapping the connection bar on the sessions list opens the directory switcher.
   - Tapping the model chip on the chat screen opens the model picker.
   - Tapping the variant chip opens the reasoning-effort picker.
   - Long-pressing the FAB → "Browse folders" opens the directory browser.

## Risks

- v5.2.14 is a patch-level bump from 5.2.8; no breaking changes are listed in the changelog.
- `BottomSheetFlatList` is still exported and used by `DirectorySwitcher`; no migration needed.
- The app already bundles `react-native-reanimated` 4.5.1 and `react-native-gesture-handler` 2.32.0, which v5.2.14 supports.
