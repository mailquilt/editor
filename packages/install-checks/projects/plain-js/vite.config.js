import { defineConfig } from "vite";

// The quick start, and the Shell's example as a page of its own.
export default defineConfig({
  build: { rolldownOptions: { input: ["index.html", "shell/index.html"] } },
});
