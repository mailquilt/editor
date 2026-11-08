import { defineConfig } from "blume";

export default defineConfig({
  // With no analytics to send them to, readers' answers would go nowhere.
  feedback: false,
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
