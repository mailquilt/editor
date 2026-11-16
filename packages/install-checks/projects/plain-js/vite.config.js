import { defineConfig } from "vite";

// The quick start, the Shell's example and saving to a server, each a page.
export default defineConfig({
  build: {
    rolldownOptions: {
      input: ["index.html", "shell/index.html", "save/index.html"],
    },
  },
});
