import { defineConfig } from "tsdown";

export default defineConfig([
  {
    dts: true,
    entry: ["src/index.ts"],
    platform: "browser",
  },
  // For pages with no bundler, which can't resolve a bare import. Everything is
  // bundled, and MJML stays in a chunk of its own beside the entry.
  {
    deps: { alwaysBundle: /./u },
    dts: false,
    entry: ["src/index.ts"],
    minify: true,
    outDir: "dist/cdn",
    platform: "browser",
    sourcemap: false,
  },
]);
