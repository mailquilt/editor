import { appendFile } from "node:fs/promises";

import type { AstroIntegration } from "astro";
import { defineConfig } from "blume";
import { filesystem } from "blume/sources";

import { codeDark, codeLight } from "./site/code-themes";
import { DESCRIPTION, NPM, REPO, SITE_URL, SOCIAL_IMAGE } from "./site/project";

/**
 * Security headers for every page. Cloudflare reads them from `_headers`, which
 * Blume writes with its own rules, and skips writing if `public/` has one. So
 * these are added to Blume's file once the build is done. Pages may be framed
 * only by the site itself, as the examples' previews are.
 */
const SECURITY_HEADERS = `
/*
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: frame-ancestors 'self'
`;

const securityHeaders: AstroIntegration = {
  hooks: {
    "astro:build:done": async ({ dir }) => {
      await appendFile(new URL("_headers", dir), SECURITY_HEADERS);
    },
  },
  name: "mailquilt-security-headers",
};

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
  // Blume runs its own first, so `_headers` is there to add to.
  integrations: [securityHeaders],
  // Each docs page's date comes from the last commit that changed it, for
  // the page and the sitemap.
  lastModified: "git",
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
              "/docs/packages",
              "/docs/let-customers-design-emails",
              "/docs/ai-agents",
            ],
            label: "Get started",
          },
          {
            items: [
              "/docs/html",
              "/docs/react",
              "/docs/nextjs",
              "/docs/other-frameworks",
            ],
            label: "Frameworks",
          },
          {
            items: [
              "/docs/shell",
              "/docs/design-your-editor-page",
              "/docs/theme-the-editor",
            ],
            label: "The editor page",
          },
          {
            items: [
              "/docs/save-emails",
              "/docs/render-on-a-server",
              "/docs/send-email",
              "/docs/change-emails-in-code",
            ],
            label: "Your emails",
          },
          {
            items: [
              "/docs/api",
              "/docs/document-format",
              "/docs/theme-tokens",
              "/docs/keyboard",
              "/docs/email-clients",
            ],
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
      { label: "Why Mail Quilt", path: "/why" },
      { label: "Roadmap", path: "/roadmap" },
    ],
  },
  seo: {
    og: { image: SOCIAL_IMAGE.path },
    // Who publishes the site, cited as publisher on every page.
    organization: {
      logo: "/logo.svg",
      sameAs: ["https://github.com/mailquilt"],
    },
    // What Mail Quilt is, on the home page: a free, MIT-licensed library.
    software: {
      license: `${REPO}/blob/main/LICENSE`,
      price: 0,
      sameAs: [REPO, NPM],
    },
  },
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
