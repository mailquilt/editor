import { defineConfig } from "blume";

export default defineConfig({
  github: {
    dir: "apps/docs",
    owner: "yourcodebuddy-in",
    repo: "mailquilt",
  },
  navigation: {
    actions: [
      {
        href: "https://github.com/yourcodebuddy-in/mailquilt/issues",
        label: "Roadmap",
      },
    ],
    cta: { href: "/playground", label: "Try the Playground" },
  },
  title: "Mail Quilt",
});
