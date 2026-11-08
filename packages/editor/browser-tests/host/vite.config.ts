import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      // The editor in a React host, and the Shell in a plain one.
      input: [
        path.join(import.meta.dirname, "index.html"),
        path.join(import.meta.dirname, "shell.html"),
      ],
      output: {
        // Named so the tests can tell when MJML loads. If MJML ever joins the
        // main bundle, this chunk disappears and those tests fail.
        chunkFileNames: ({ facadeModuleId }) =>
          facadeModuleId?.includes("mjml-browser")
            ? "assets/mjml-browser-[hash].js"
            : "assets/[name]-[hash].js",
      },
    },
  },
  plugins: [tailwindcss()],
});
