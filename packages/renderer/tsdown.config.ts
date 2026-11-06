import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  entry: ["src/node.ts", "src/browser.ts"],
  platform: "neutral",
});
