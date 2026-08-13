# Fix: catalog not loading, breaking model picker / agent toggle / folder browser

## Root cause

`app/(tabs)/index.tsx` removed `loadCatalog()` from its `useFocusEffect` callback.  
The catalog store (`src/stores/catalog.ts`) holds `agents`, `providers`, `models`, and `commands` — all loaded via `client.agent.list()`, `client.provider.list()`, `client.command.list()`.  
Without `loadCatalog()`, these arrays stay at their initial empty state, so:

- **Model picker** (`ModelPicker` bottom sheet) renders zero providers → empty list.
- **Agent toggle** (`cycleAgent` in chat toolbar) has no agents to cycle → no visible change.
- **Variant picker** (`VariantPicker` bottom sheet) has no variants → empty list.

Upstream calls `loadCatalog()` inside the same `useFocusEffect` that reloads sessions and project info.

## Changes

### 1. Restore `loadCatalog()` in tabs screen focus

**File:** `app/(tabs)/index.tsx`

Add `loadCatalog()` back to the `useFocusEffect` body and dependency array:

```tsx
useFocusEffect(
  useCallback(() => {
    if (client) {
      loadSessions();
      refreshProject();
      loadCatalog(); // ← restore
    }
  }, [client, loadSessions, refreshProject, loadCatalog]), // ← add dep
);
```

### 2. Ensure session screen also loads catalog

**File:** `app/session/[id].tsx`

The session screen directly reads `catalog.agents`, `catalog.providers`, `catalog.model`, etc.  
If a user navigates to a session without first focusing the tabs screen (deep link, notification, cold start), the catalog may still be empty. Add a defensive `loadCatalog()` call in the session screen’s `useFocusEffect`:

```tsx
const loadCatalog = useCatalog((s) => s.load);

useFocusEffect(
  useCallback(() => {
    if (!id) return;
    loadCatalog(); // ← add
    selectSession(id, directory).then(() => {
      const connState = useConnections.getState();
      const c = directory
        ? (connState.clientForDirectory(directory) ?? connState.client)
        : connState.client;
      if (c) refreshPending(c, id);
    });
  }, [id, directory, selectSession, loadCatalog]), // ← add dep
);
```

## Folder browser behavior

**Current:** Tapping the connection bar (top server name) opens `DirectorySwitcher`.  
The actual browsable folder tree (`DirectoryBrowserSheet`) is one level deeper — inside `DirectorySwitcher` via the **Browse** chip, or from the **Browse folders** button in the new-session modal.

**Question for you:** Do you want the connection-bar tap to open the `DirectoryBrowserSheet` directly (bypassing `DirectorySwitcher`), or is the current two-step flow (connection bar → DirectorySwitcher → Browse chip) acceptable once the catalog/bottom-sheet issues are fixed?

If direct open is desired, the change is minimal: swap the connection bar `onPress` from `dirSheetRef.current?.expand()` to `openBrowser(activeConnection?.directory || currentProject?.path?.absolute || null, "switch")`.

## Validation

1. Open app → sessions list loads.
2. Pull to refresh → sessions + project + catalog all reload.
3. Tap a session → chat screen shows agent chip and model chip with real data.
4. Tap model chip → `ModelPicker` opens with providers/models.
5. Tap agent chip → cycles through agents (build, plan, etc.).
6. Tap variant chip → `VariantPicker` opens with reasoning-effort options.
7. Tap connection bar → `DirectorySwitcher` opens; tap Browse → `DirectoryBrowserSheet` opens and lists directories.
