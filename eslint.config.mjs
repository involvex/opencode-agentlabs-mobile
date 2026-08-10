import expo from "eslint-config-expo/flat.js";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginPrettier from "eslint-plugin-prettier";

export default [
  ...expo,
  {
    settings: {
      react: {
        version: "19.2",
      },
    },
  },
  eslintConfigPrettier,
  {
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },
  {
    ignores: [
      "node_modules/",
      ".expo/",
      ".agents/",
      "dist/",
      "babel.config.js",
      "src/assets/terminal-shell-html.ts",
      "website/",
      "docs/",
      "docs-site/",
    ],
  },
];
