# Slash Command Framework Implementation Plan

## Goal

Build a proper, extensible slash command framework for the session composer that:

- Registers builtin commands in a typed registry (not a hardcoded array inline in the session screen)
- Executes builtins immediately on selection; inserts custom commands into the composer for the user to edit + send
- Improves the popover UX (keyboard navigation, descriptions, categories)
- Provides a clean, discoverable API for adding new commands without touching the session screen
- Formalizes and stabilizes the existing `/prompt` flow

---

## 1. New Files

### `src/lib/slash-commands.ts`

Core framework module. Contains:

- **`SlashCommand` interface** (expanded from current popover type):

  ```ts
  export interface SlashCommand {
    trigger: string;
    title: string;
    description?: string;
    icon?: string;
    category?: "builtin" | "custom" | "prompt";
    type: "builtin" | "custom";
    keywords?: string[];
  }
  ```

- **`BuiltinCommandHandler` type**:

  ```ts
  export type BuiltinCommandHandler = (
    ctx: CommandContext,
    args: string[],
  ) => void | Promise<void>;
  ```

- **`CommandContext` interface**:

  ```ts
  export interface CommandContext {
    setInput: (text: string) => void;
    clearInput: () => void;
    focusComposer: () => void;
    // Session actions
    sendMessage: (text: string) => void;
    newSession: (template?: SessionTemplate) => void;
    switchModel: (model: Model) => void;
    switchAgent: (agent: string) => void;
    exportSession: () => void;
    // Navigation
    navigateToSettings: () => void;
    // State access
    getCurrentSession: () => Session | null;
    // UI
    showToast: (message: string) => void;
  }
  ```

- **`SlashCommandRegistry` class**:
  - `registerBuiltin(cmd: SlashCommand, handler: BuiltinCommandHandler)` — adds a builtin
  - `registerCustomCommands(commands: Command[]): SlashCommand[]` — converts server catalog commands
  - `getAll(query?: string): SlashCommand[]` — returns filtered + sorted commands
  - `getBuiltin(trigger: string): SlashCommand | undefined`
  - `getBuiltinHandler(trigger: string): BuiltinCommandHandler | undefined`
  - `executeBuiltin(trigger: string, args: string[], ctx: CommandContext)` — looks up handler and runs it
  - `insertCustom(trigger: string, ctx: CommandContext)` — inserts `/trigger ` into composer
  - Builtins are stored in a `Map<string, { command, handler }>`; custom commands are derived from the server catalog each load

- **`DEFAULT_BUILTINS` array** — the initial set of builtin commands registered at module load:
  - `/new` — new session
  - `/model` — switch model (cycles or opens picker)
  - `/agent` — switch agent
  - `/prompt` — open prompt library
  - `/clear` — clear composer
  - `/export` — export session to markdown
  - `/theme` — cycle theme (light → dark → auto)
  - `/density` — cycle density (compact → default → comfortable)
  - `/summarize` — send summarize prompt
  - `/search` — focus session search
  - `/help` — show help popover / toast with all commands

- **`COMMAND_CATEGORIES`** — logical groupings for the popover (Navigation, Edit, View, Prompts, Debug)

- **`filterCommands(query: string, commands: SlashCommand[]): SlashCommand[]`** — matches against trigger, title, description, and keywords

---

### `src/components/chat/SlashPopover.tsx` (rewrite)

Current: flat list, no keyboard nav, no categories, no descriptions visible.

New:

- Accepts `commands: SlashCommand[]`, `query: string`, `onSelect: (cmd: SlashCommand) => void`
- Groups commands by `category` with section headers
- Shows icon, `/trigger`, description, and category badge
- **Keyboard navigation**:
  - Arrow Up / Arrow Down moves a `selectedIndex` highlight
  - Enter selects the highlighted command
  - Escape closes the popover and clears the slash input
  - Tab cycles focus out of the popover
- Max height 280px scroll view, scrolls selected item into view
- Empty state: "No commands match. Try /help for a list."
- Accessible: `accessibilityRole="listbox"`, `accessibilityLabel` per item

---

### `src/components/chat/SlashHelpSheet.tsx` (new)

A bottom sheet that displays all available slash commands organized by category. Triggered by `/help`. Shows:

- Category group headers
- `/trigger — description` for each command
- Distinguishes builtins from custom server commands

---

### `src/lib/keyboard-slash.ts` (new)

Extracts keyboard handling for the slash popover into a composable hook:

```ts
export function useSlashKeyboard(
  commands: SlashCommand[],
  onSelect: (cmd: SlashCommand) => void,
  onDismiss: () => void,
): { selectedIndex: number; handleKey: (e: KeyEvent) => void };
```

- Manages `selectedIndex` state
- Handles ArrowUp/ArrowDown/Enter/Escape
- Called from the session screen's keyboard event listener when `slashActive` is true

---

### `src/stores/slash-commands.ts` (new)

Zustand store for slash command preferences:

- `recentCommands: string[]` — last 10 used slash triggers (persisted in SecureStore)
- `addRecent(trigger: string)` — prepend, deduplicate, cap at 10
- `clearRecent()` — reset
- `favoriteCommands: string[]` — pinned commands shown at top of popover (persisted in SecureStore)
- `toggleFavorite(trigger: string)` — add/remove
- `isFavorite(trigger: string): boolean`

This enables the popover to show favorites first, then recents, then alphabetically sorted matches.

---

## 2. Modified Files

### `app/session/[id].tsx`

**Before:** `BUILTIN_COMMANDS` array (lines 60-89), `slashActive` logic (lines 313-314), `allCommands` merge (lines 316-325), `handleSlashSelect` switch (lines 572-596), inline `SlashPopover` usage (lines 1224-1231).

**After:**

- Import `SlashCommandRegistry`, `DEFAULT_BUILTINS`, `filterCommands`, `SlashHelpSheet`
- On mount, create a `registry` instance and register builtins with handlers:
  ```ts
  const registry = useMemo(() => {
    const r = new SlashCommandRegistry();
    r.registerBuiltin(DEFAULT_BUILTINS.new, () => { ... });
    r.registerBuiltin(DEFAULT_BUILTINS.prompt, () => { promptSheetRef.current?.expand(); });
    // etc.
    return r;
  }, []);
  ```
- Replace `slashActive` / `slashQuery` derivation (same logic, but feed `slashQuery` into `registry.getAll(slashQuery)`)
- Replace `allCommands` with `registry.getAll(slashQuery)` (builtins + custom merged inside registry)
- Replace `handleSlashSelect` with `registry.executeBuiltin(cmd.trigger, args, ctx)` for builtins; `registry.insertCustom(cmd.trigger, ctx)` for custom
- Replace inline `SlashPopover` with new component, passing `commands={filteredCommands}`, `selectedIndex`, `onSelect={handleSlashSelect}`
- Wire `useSlashKeyboard` when `slashActive` is true
- Remove the old `BUILTIN_COMMANDS` array
- Add `/help` binding: when selected, show `SlashHelpSheet` instead of executing

### `src/components/chat/SlashPopover.tsx`

Rewrite as described in Section 1.

### `src/components/chat/index.ts`

Add exports for new components:

- `SlashHelpSheet`
- `useSlashKeyboard` (if re-exporting hooks)

### `src/stores/catalog.ts`

No structural changes, but ensure `commands` are returned in a stable order so the popover is deterministic. Add `category` field if the server provides it, otherwise derive from command name/path.

---

## 3. New Builtin Commands to Add

| Trigger      | Title           | Description                                            | Handler                            |
| ------------ | --------------- | ------------------------------------------------------ | ---------------------------------- |
| `/clear`     | Clear Input     | Clear the composer text                                | `ctx.clearInput()`                 |
| `/export`    | Export Session  | Export current session to Markdown                     | `ctx.exportSession()`              |
| `/theme`     | Cycle Theme     | Switch between light → dark → auto                     | toggle `theme` setting             |
| `/density`   | Cycle Density   | Switch between compact → default → comfortable         | cycle `density` setting            |
| `/summarize` | Summarize       | Send "Summarize this conversation in 3 bullet points." | `ctx.sendMessage(summarizePrompt)` |
| `/search`    | Search Sessions | Focus the session list search bar                      | navigate or focus search input     |
| `/help`      | Help            | Show all available commands                            | open `SlashHelpSheet`              |

---

## 4. Popover UX Improvements

### Keyboard Navigation

- Arrow Up/Down moves highlight
- Enter selects
- Escape closes popover and clears `/` prefix from input
- Tab exits popover, keeps focus in composer

### Visual Improvements

- Category section headers (e.g., "NAVIGATION", "EDIT", "VIEW")
- Favorites pinned to top with a ★ indicator
- Recent commands section (last 5 used) if no query is active
- Description text shown in a lighter color below each command
- "CUSTOM" badge retained for server commands
- Max height 280px, scrollable

### Filtering

- Match against trigger, title, description, and keywords
- If no query, show favorites + recents + all builtins
- If query matches nothing, show "No commands match. Type /help for full list."

---

## 5. Data Model Changes

### `SlashCommand` type additions

- `category?: SlashCommandCategory` — enum: `"navigation" | "edit" | "view" | "prompts" | "debug"`
- `keywords?: string[]` — extra search terms (e.g., `["rename", "title"]` for `/name`)

### Persistent preferences (`src/stores/slash-commands.ts`)

```ts
interface SlashCommandPrefs {
  recent: string[];
  favorites: string[];
}
```

Stored in `expo-secure-store` under key `opencode_slash_prefs_v1`.

---

## 6. Implementation Order

### Phase 1: Core Registry (no UI changes)

1. Create `src/lib/slash-commands.ts` with `SlashCommand` interface, `SlashCommandRegistry`, `DEFAULT_BUILTINS`, `filterCommands`
2. Create `src/stores/slash-commands.ts` with recent/favorites persistence
3. Write unit tests for registry (register, filter, execute, insert)

### Phase 2: Popover Rewrite

4. Rewrite `SlashPopover.tsx` with categories, keyboard nav, descriptions
5. Create `SlashHelpSheet.tsx`
6. Create `useSlashKeyboard` hook
7. Wire keyboard handling into session screen

### Phase 3: Session Screen Integration

8. Replace inline `BUILTIN_COMMANDS` + `handleSlashSelect` with registry in `app/session/[id].tsx`
9. Add new builtin handlers (`/clear`, `/export`, `/theme`, `/density`, `/summarize`, `/search`, `/help`)
10. Wire recent/favorites into popover rendering

### Phase 4: Polish

11. Add `COMMAND_CATEGORIES` and category grouping to popover
12. Add keywords to builtins for better search
13. Update suggestions.md to mark slash commands as fully formalized
14. Run lint + typecheck

---

## 7. Testing Strategy

- **Unit tests** (`src/lib/slash-commands.test.ts`):
  - Register builtin, retrieve by trigger
  - Filter commands by query (trigger, title, description, keywords)
  - Execute builtin handler with mock context
  - Insert custom command into mock context
  - Custom command conversion from server `Command[]`

- **Component tests** (`SlashPopover.test.tsx`):
  - Render with command list, verify items
  - Keyboard navigation: arrow keys move highlight, Enter selects, Escape dismisses
  - Filter: typing narrows list
  - Empty state: no matches shows fallback text

- **Integration**: Manual test on device/emulator:
  - Type `/` → popover appears
  - Arrow keys navigate
  - Enter executes builtin
  - `/prompt` opens sheet
  - `/help` shows help sheet
  - Custom server command inserts `/name `
  - Favorites/recent persistence across app restarts

---

## 8. Risks & Mitigations

| Risk                                                  | Mitigation                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| Registry introduces circular deps                     | Keep `slash-commands.ts` pure (no React imports); session screen wires handlers |
| Keyboard nav conflicts with existing shortcuts        | Scope keyboard handling to when `slashActive` is true only                      |
| SecureStore read/write on every keystroke for recents | Debounce `addRecent` to once per command execution, not per popover render      |
| Popover positioning breaks on small screens           | Max height 280px, `keyboardShouldPersistTaps="always"`, test on 320dp width     |
| Server commands change format                         | `registerCustomCommands` maps defensively; missing fields fall back to defaults |

---

## 9. Files Changed Summary

| File                                     | Action                                                   |
| ---------------------------------------- | -------------------------------------------------------- |
| `src/lib/slash-commands.ts`              | **NEW** — registry, types, default builtins, filter      |
| `src/stores/slash-commands.ts`           | **NEW** — recent/favorites persistence                   |
| `src/components/chat/SlashPopover.tsx`   | **REWRITE** — categories, keyboard nav, descriptions     |
| `src/components/chat/SlashHelpSheet.tsx` | **NEW** — help bottom sheet                              |
| `src/lib/keyboard-slash.ts`              | **NEW** — keyboard nav hook                              |
| `app/session/[id].tsx`                   | **MODIFY** — integrate registry, replace inline commands |
| `src/components/chat/index.ts`           | **MODIFY** — export new components                       |
| `suggestions.md`                         | **MODIFY** — mark slash commands as fully implemented    |
