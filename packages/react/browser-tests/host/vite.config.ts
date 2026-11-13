import { defineConfig } from "vite";

export default defineConfig({
  build: { chunkSizeWarningLimit: 2000 },
  // React's development build, as a host's own dev server has. Only it runs
  // StrictMode's checks, such as mounting each effect twice.
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
});
