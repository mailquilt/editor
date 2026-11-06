import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
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
