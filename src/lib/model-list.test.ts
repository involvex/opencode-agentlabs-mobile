import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildModelSections,
  modelFavKey,
  type ModelListProvider,
} from "./model-list";

const providers: ModelListProvider[] = [
  {
    id: "opencode-go",
    name: "OpenCode Go",
    models: [
      { id: "hy3", name: "Hy3" },
      { id: "glm-5.1", name: "GLM-5.1" },
      { id: "gpt-6-luna", name: "GPT-6 Luna" },
    ],
  },
  {
    id: "other",
    name: "Other",
    models: [{ id: "qwen-plus", name: "Qwen Plus" }],
  },
];

describe("modelFavKey", () => {
  test("normalizes case", () => {
    assert.equal(modelFavKey("OpenCode-Go", "Hy3"), "opencode-go/hy3");
  });
});

describe("buildModelSections", () => {
  test("pins favorites on top and excludes them from provider sections", () => {
    const sections = buildModelSections(providers, {
      search: "",
      selected: null,
      favorites: ["opencode-go/hy3"],
      favoritesTitle: "Favorites",
    });
    assert.equal(sections[0].title, "Favorites");
    assert.equal(sections[0].isFavorites, true);
    assert.deepEqual(
      sections[0].data.map((m) => m.modelID),
      ["hy3"],
    );
    const rest = sections.slice(1).flatMap((s) => s.data.map((m) => m.modelID));
    assert.ok(!rest.includes("hy3"));
  });

  test("favorites stay pinned even when search does not match them", () => {
    const sections = buildModelSections(providers, {
      search: "qwen",
      selected: null,
      favorites: ["opencode-go/hy3"],
      favoritesTitle: "Favorites",
    });
    assert.equal(sections[0].title, "Favorites");
    assert.deepEqual(
      sections[0].data.map((m) => m.modelID),
      ["hy3"],
    );
  });

  test("stale favorite keys are ignored", () => {
    const sections = buildModelSections(providers, {
      search: "",
      selected: null,
      favorites: ["nope/gone"],
      favoritesTitle: "Favorites",
    });
    assert.ok(sections.every((s) => !s.isFavorites));
  });

  test("selected model sorts to top within its section", () => {
    const sections = buildModelSections(providers, {
      search: "",
      selected: { providerID: "opencode-go", modelID: "gpt-6-luna" },
      favorites: [],
      favoritesTitle: "Favorites",
    });
    const go = sections.find((s) => s.title === "OpenCode Go");
    assert.equal(go?.data[0].modelID, "gpt-6-luna");
  });
});
