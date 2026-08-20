import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SlashCommandRegistry,
  DEFAULT_BUILTINS,
  filterCommands,
  COMMAND_CATEGORIES,
} from "./slash-commands.ts";
import type { SlashCommand } from "./slash-commands.ts";

describe("slash-commands", () => {
  const makeCmd = (overrides: Partial<SlashCommand> = {}): SlashCommand => ({
    trigger: "test",
    title: "Test Command",
    description: "A test command",
    icon: "test-outline",
    type: "builtin",
    category: "navigation",
    ...overrides,
  });

  test("registry starts empty", () => {
    const registry = new SlashCommandRegistry();
    assert.equal(registry.getAll().length, 0);
  });

  test("registerBuiltin stores and retrieves command", () => {
    const registry = new SlashCommandRegistry();
    const cmd = makeCmd({ trigger: "hello", title: "Hello" });
    registry.registerBuiltin(cmd, () => {});
    assert.deepEqual(registry.getBuiltin("hello"), cmd);
    assert.deepEqual(registry.getBuiltin("HELLO"), cmd);
  });

  test("registerBuiltin returns undefined for missing trigger", () => {
    const registry = new SlashCommandRegistry();
    assert.equal(registry.getBuiltin("missing"), undefined);
  });

  test("registerBuiltin stores handler", () => {
    const registry = new SlashCommandRegistry();
    const cmd = makeCmd({ trigger: "greet" });
    const handler = () => {};
    registry.registerBuiltin(cmd, handler);
    assert.equal(registry.getBuiltinHandler("greet"), handler);
    assert.equal(registry.getBuiltinHandler("GREET"), handler);
  });

  test("executeBuiltin calls handler for registered trigger", () => {
    const registry = new SlashCommandRegistry();
    const cmd = makeCmd({ trigger: "act" });
    let called = false;
    registry.registerBuiltin(cmd, () => {
      called = true;
    });
    registry.executeBuiltin("act", [], {
      setInput: () => {},
      clearInput: () => {},
      focusComposer: () => {},
      sendMessage: () => {},
      newSession: () => {},
      switchModel: () => {},
      switchAgent: () => {},
      exportSession: () => {},
      cycleTheme: () => {},
      cycleDensity: () => {},
      summarize: () => {},
      focusSearch: () => {},
      showHelp: () => {},
      getCurrentSession: () => null,
      showToast: () => {},
    });
    assert.equal(called, true);
  });

  test("executeBuiltin is case-insensitive", () => {
    const registry = new SlashCommandRegistry();
    const cmd = makeCmd({ trigger: "act" });
    let called = false;
    registry.registerBuiltin(cmd, () => {
      called = true;
    });
    registry.executeBuiltin("ACT", [], {
      setInput: () => {},
      clearInput: () => {},
      focusComposer: () => {},
      sendMessage: () => {},
      newSession: () => {},
      switchModel: () => {},
      switchAgent: () => {},
      exportSession: () => {},
      cycleTheme: () => {},
      cycleDensity: () => {},
      summarize: () => {},
      focusSearch: () => {},
      showHelp: () => {},
      getCurrentSession: () => null,
      showToast: () => {},
    });
    assert.equal(called, true);
  });

  test("executeBuiltin does nothing for unregistered trigger", () => {
    const registry = new SlashCommandRegistry();
    let called = false;
    registry.executeBuiltin("missing", [], {
      setInput: () => {},
      clearInput: () => {},
      focusComposer: () => {},
      sendMessage: () => {},
      newSession: () => {},
      switchModel: () => {},
      switchAgent: () => {},
      exportSession: () => {},
      cycleTheme: () => {},
      cycleDensity: () => {},
      summarize: () => {},
      focusSearch: () => {},
      showHelp: () => {},
      getCurrentSession: () => null,
      showToast: () => {},
    });
    assert.equal(called, false);
  });

  test("insertCustom inserts trigger into input and focuses composer", () => {
    const registry = new SlashCommandRegistry();
    let inputValue = "";
    let focused = false;
    registry.insertCustom("deploy", {
      setInput: (v) => {
        inputValue = v;
      },
      clearInput: () => {},
      focusComposer: () => {
        focused = true;
      },
      sendMessage: () => {},
      newSession: () => {},
      switchModel: () => {},
      switchAgent: () => {},
      exportSession: () => {},
      cycleTheme: () => {},
      cycleDensity: () => {},
      summarize: () => {},
      focusSearch: () => {},
      showHelp: () => {},
      getCurrentSession: () => null,
      showToast: () => {},
    });
    assert.equal(inputValue, "/deploy ");
    assert.equal(focused, true);
  });

  test("registerCustomCommands converts server commands", () => {
    const registry = new SlashCommandRegistry();
    const serverCommands = [
      { name: "review", description: "Review code" },
      { name: "test", description: "Run tests" },
    ];
    const custom = registry.registerCustomCommands(serverCommands);
    assert.equal(custom.length, 2);
    assert.deepEqual(custom[0], {
      trigger: "review",
      title: "review",
      description: "Review code",
      icon: "code-slash-outline",
      type: "custom",
      category: "navigation",
    });
  });

  test("getAll returns empty when no builtins or customs", () => {
    const registry = new SlashCommandRegistry();
    assert.equal(registry.getAll().length, 0);
  });

  test("getAll returns builtins + customs without query", () => {
    const registry = new SlashCommandRegistry();
    registry.registerBuiltin(makeCmd({ trigger: "a" }), () => {});
    registry.registerCustomCommands([{ name: "b", description: "B" }]);
    const all = registry.getAll();
    assert.equal(all.length, 2);
    assert.equal(all[0].trigger, "a");
    assert.equal(all[1].trigger, "b");
  });

  test("getAll filters by query against trigger, title, description, keywords", () => {
    const registry = new SlashCommandRegistry();
    registry.registerBuiltin(
      makeCmd({
        trigger: "summarize",
        title: "Summarize",
        description: "Summarize conversation",
        keywords: ["recap", "bullets"],
      }),
      () => {},
    );
    assert.equal(registry.getAll("sum").length, 1);
    assert.equal(registry.getAll("conv").length, 1);
    assert.equal(registry.getAll("bullets").length, 1);
    assert.equal(registry.getAll("missing").length, 0);
  });

  test("getAll is case-insensitive", () => {
    const registry = new SlashCommandRegistry();
    registry.registerBuiltin(makeCmd({ trigger: "hello" }), () => {});
    assert.equal(registry.getAll("HELLO").length, 1);
    assert.equal(registry.getAll("Hello").length, 1);
  });

  test("filterCommands matches all terms in multi-word query", () => {
    const commands = [
      makeCmd({
        trigger: "summarize",
        title: "Summarize",
        description: "Summarize conversation in bullets",
      }),
    ];
    assert.equal(filterCommands("summarize bullets", commands).length, 1);
    assert.equal(filterCommands("missing bullets", commands).length, 0);
  });

  test("DEFAULT_BUILTINS contains expected commands", () => {
    const triggers = Object.values(DEFAULT_BUILTINS).map((c) => c.trigger);
    assert.ok(triggers.includes("new"));
    assert.ok(triggers.includes("model"));
    assert.ok(triggers.includes("agent"));
    assert.ok(triggers.includes("prompt"));
    assert.ok(triggers.includes("clear"));
    assert.ok(triggers.includes("export"));
    assert.ok(triggers.includes("theme"));
    assert.ok(triggers.includes("density"));
    assert.ok(triggers.includes("summarize"));
    assert.ok(triggers.includes("search"));
    assert.ok(triggers.includes("help"));
  });

  test("DEFAULT_BUILTINS commands have categories", () => {
    for (const cmd of Object.values(DEFAULT_BUILTINS)) {
      assert.ok(
        COMMAND_CATEGORIES[cmd.category ?? "navigation"],
        `Missing category for ${cmd.trigger}`,
      );
    }
  });
});
