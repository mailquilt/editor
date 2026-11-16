import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The React page's editor, and its Shell as a page of its own.
export default defineConfig({
  build: { rolldownOptions: { input: ["index.html", "shell/index.html"] } },
  plugins: [react()],
});
