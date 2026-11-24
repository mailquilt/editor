import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The React page's editor, its Shell, and the props React 18 writes as
// attributes, each a page of its own.
export default defineConfig({
  build: {
    rolldownOptions: {
      input: ["index.html", "shell/index.html", "props/index.html"],
    },
  },
  plugins: [react()],
});
