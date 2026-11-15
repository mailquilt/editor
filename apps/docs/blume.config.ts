import { defineConfig } from "blume";
import { filesystem } from "blume/sources";

import { codeDark, codeLight } from "./site/code-themes";
import { DESCRIPTION, REPO, SITE_URL, SOCIAL_IMAGE } from "./site/project";

export default defineConfig({
  agents: {
    // The hand-written skill, at the repo root so `npx skills add` finds it
    // too. Named mail-quilt, it replaces the one Blume would generate.
    skills: "../../skills",
  },
  content: {
    // The docs live under /docs, which leaves / for the landing page.
    sources: [filesystem({ prefix: "docs", root: "docs" })],
  },
  deployment: { site: SITE_URL },
  description: DESCRIPTION,
  // With no analytics to send them to, readers' answers would go nowhere.
  feedback: false,
  github: {
    dir: "apps/docs",
    owner: "mailquilt",
    repo: "editor",
  },
  // The wordmark is part of the image, so there is no text beside it.
  logo: {
    image: { alt: "Mail Quilt", dark: "/logo-dark.svg", light: "/logo.svg" },
    text: "",
  },
  markdown: {
    code: { theme: { dark: codeDark, light: codeLight } },
  },
  navigation: {
    actions: [{ href: REPO, label: "GitHub" }],
    cta: { href: "/playground", label: "Try the Playground" },
    // One group at /docs, so the Docs tab finds its section. Its groups are
    // the sidebar's headings.
    sidebar: [
      {
        items: [
          {
            items: [
              "/docs",
              "/docs/quick-start",
              "/docs/shell",
              "/docs/packages",
            ],
            label: "Get started",
          },
          {
            items: [
              "/docs/design-your-editor-page",
              "/docs/theme-tokens",
              "/docs/keyboard",
              "/docs/render-on-a-server",
              "/docs/change-emails-in-code",
            ],
            label: "Guides",
          },
          {
            items: ["/docs/document-format", "/docs/email-clients"],
            label: "Reference",
          },
        ],
        label: "Docs",
        root: "/docs",
      },
    ],
    tabs: [
      { label: "Docs", path: "/docs" },
      { label: "Examples", path: "/examples" },
      { label: "Compare", path: "/compare" },
      { label: "Why", path: "/why" },
      { label: "Roadmap", path: "/roadmap" },
    ],
  },
  seo: { og: { image: SOCIAL_IMAGE.path } },
  theme: {
    // Blume's own chrome stays ink and grey. The logo's orange is added by
    // hand in theme.css, where it marks one thing at a time.
    accent: { dark: "#f4f4f5", light: "#111113" },
    // Space Grotesk is the logo's typeface. DM Sans is from the foundry whose
    // Space Mono it was drawn from, so the two sit together.
    fonts: { body: "dm-sans", display: "space-grotesk", mono: "geist-mono" },
    radius: "md",
  },
  title: "Mail Quilt",
});
