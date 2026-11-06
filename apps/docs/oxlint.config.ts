import { defineConfig } from "oxlint";
import react from "ultracite/oxlint/react";

import root from "../../oxlint.config.mts";

// Oxlint lints each file with its nearest config alone, so this extends the
// root config and repeats the properties that extends doesn't carry over.
export default defineConfig({
  env: root.env,
  extends: [root, react],
  ignorePatterns: root.ignorePatterns,
  overrides: [
    {
      // Blume names an island's MDX tag after its file, which must be PascalCase.
      files: ["islands/**"],
      rules: { "unicorn/filename-case": "off" },
    },
  ],
  settings: root.settings,
});
