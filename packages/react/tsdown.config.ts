import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  entry: ["src/index.ts"],
  platform: "neutral",
  // The target @repo/typescript-config states.
  target: "es2023",
});
