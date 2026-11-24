import { defineConfig } from "tsdown";

import { writeJsonSchema } from "./json-schema.ts";

export default defineConfig({
  dts: true,
  entry: ["src/index.ts", "src/internal.ts"],
  hooks: {
    "build:done": () => writeJsonSchema(new URL("dist/", import.meta.url)),
  },
  platform: "neutral",
  // The target @repo/typescript-config states.
  target: "es2023",
});
