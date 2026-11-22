// Facts about the project that more than one page states.
import { capitalized, COUNTS } from "./package-facts";

export const DESCRIPTION =
  "A set of free, MIT-licensed packages for adding a drag-and-drop email editor to any web app, with the document model and renderer it's built on.";

/** Where the site is served. Canonical links, the sitemap and shared images use it. */
export const SITE_URL = "https://editor.mailquilt.com";

export const REPO = "https://github.com/mailquilt/editor";

export const ISSUES = `${REPO}/issues`;

/** Who builds Mail Quilt, and the page their name links to. */
export const AUTHOR = {
  name: "Vishal Lohar",
  url: "https://x.com/yourcodebuddy",
};

export const NPM = "https://www.npmjs.com/org/mailquilt";

/** The day the compare page's lines about other editors were read from their own pages. */
export const COMPARED = "16 November 2026";

/** The logo kit's card, for links shared on social sites. */
export const SOCIAL_IMAGE = {
  alt: "Mail Quilt. Open-source packages for building an email editor into your app.",
  path: "/social-preview.png",
  size: { height: 640, width: 1280 },
};

/**
 * Mail Quilt's side of the compare pages: its column in each table, and the
 * reasons to choose it that more than one page gives. A fact about Mail Quilt
 * changes here, once, for every page.
 */
export const MAIL_QUILT = {
  account: "None.",
  blocks: `${capitalized(COUNTS.blocks)} Blocks, no template library and no editing together.`,
  browsers: "Its tests run in Chromium, Firefox and WebKit, Safari's engine.",
  build: `Nothing: the editor and its panel come ready, with ${COUNTS.blocks} Blocks.`,
  cost: "MIT. Free, with no paid plan.",
  frameworks:
    "Any framework, as a Web Component, and a React component for React 19.",
  outlook:
    "Works in classic Outlook for Windows, with limits: emoji are black and white, and dark mode inverts the colors.",
  saved:
    "A documented JSON format of Rows, Columns and Blocks. The HTML is written by MJML, in the browser or on your own server.",
  source:
    "Installed from npm and bundled with your app, or loaded from a CDN build you pin to a version.",
  support: "One maintainer and a public issue tracker.",
  what: "Packages for building an email editor into your app: a drag-and-drop editor, a ready-made editor page, and the document model and renderer under them. It makes emails only.",
};

/** A row of a compare page's table: which of Mail Quilt's facts, and the other editor's. */
export interface CompareRow {
  label: string;
  ours: keyof typeof MAIL_QUILT;
  theirs: string;
}

export const REASONS = {
  fewBlocks: `${capitalized(COUNTS.blocks)} Blocks are enough for the emails you send.`,
  keyboard:
    "You want everything that can be dragged to work from the keyboard too.",
  noFee:
    "You want the editor inside your product, with no fee and no other company's servers needed. Even the Social Block's icons can come from your own storage.",
  saved:
    "You want each email saved as a documented JSON format of Rows, Columns and Blocks, which you can check, change and render on your own server.",
};
