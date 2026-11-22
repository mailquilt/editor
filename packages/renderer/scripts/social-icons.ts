// Makes the Social Block's icons in `icons/` again, from the pinned sources
// that icons/NOTICE.md credits (ADR 0019). The PNGs committed in `icons/` are the
// source of truth: nothing is fetched at build time, so a brand removed
// upstream changes nothing until this is run again. Run it when a source or a
// network changes:
// node scripts/social-icons.ts
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { SOCIAL_NETWORKS } from "@mailquilt/core/internal";
import sharp from "sharp";

type Network = keyof typeof SOCIAL_NETWORKS;

/** Twice the largest icon size, for screens that show two pixels for one. */
const SIZE = 96;

const SIMPLE_ICONS = "https://cdn.jsdelivr.net/npm/simple-icons@16.38.0/icons";
const LUCIDE = "https://cdn.jsdelivr.net/npm/lucide-static@1.77.0/icons";
const FONT_AWESOME =
  "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@7.3.1/svgs/brands";

interface Source {
  url: string;
  /** The part of the source's own box the mark fills. */
  viewBox: string;
  /** Its color in the color style, as the source gives it. */
  color: string;
  /**
   * Drawn in white behind the color icon, under the parts its brand requires
   * to be white, such as Facebook's "f", which are holes in the source.
   */
  whiteParts?: string;
  /** Lucide's icons are lines, where the others are filled shapes. */
  lines?: boolean;
}

const simpleIcon = (
  slug: string,
  color: string,
  whiteParts?: string
): Source => ({
  color,
  url: `${SIMPLE_ICONS}/${slug}.svg`,
  viewBox: "0 0 24 24",
  whiteParts,
});

/** Inside a round mark, so none of it shows past the edge. */
const WHITE_CIRCLE = '<circle cx="12" cy="12" r="11.8" />';

const SOURCES = {
  bluesky: simpleIcon("bluesky", "#1185FE"),
  facebook: simpleIcon("facebook", "#0866FF", WHITE_CIRCLE),
  instagram: simpleIcon("instagram", "#FF0069"),
  linkedin: {
    color: "#0A66C2",
    url: `${FONT_AWESOME}/linkedin.svg`,
    // Only the square, which the source draws in a taller box.
    viewBox: "0 32 448 448",
    whiteParts: '<rect height="400" width="400" x="24" y="56" />',
  },
  pinterest: simpleIcon("pinterest", "#BD081C", WHITE_CIRCLE),
  threads: simpleIcon("threads", "#000000"),
  tiktok: simpleIcon("tiktok", "#000000"),
  website: {
    color: "#3F3F46",
    lines: true,
    url: `${LUCIDE}/globe.svg`,
    // The globe and its lines, without Lucide's margin.
    viewBox: "1 1 22 22",
  },
  x: simpleIcon("x", "#000000"),
  youtube: simpleIcon(
    "youtube",
    "#FF0000",
    '<rect height="9" width="8" x="8.5" y="7.5" />'
  ),
} satisfies Record<Network, Source>;

/** What a source draws, without its own `<svg>` element, title or comments. */
const shapesOf = (svg: string) =>
  svg
    .replaceAll(/<!--[\s\S]*?-->|<title>[\s\S]*?<\/title>/gu, "")
    .replace(/^[\s\S]*?<svg[^>]*>/u, "")
    .replace(/<\/svg>\s*$/u, "")
    .replaceAll(/\sfill="currentColor"/gu, "");

const iconSvg = (
  shapes: string,
  source: Source,
  color: string,
  white: boolean
) => {
  const paint = source.lines
    ? `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
    : `fill="${color}"`;
  const backing =
    !white && source.whiteParts
      ? `<g fill="#FFFFFF">${source.whiteParts}</g>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="${source.viewBox}">${backing}<g ${paint}>${shapes}</g></svg>`;
};

const iconsDir = path.join(import.meta.dirname, "..", "icons");
mkdirSync(iconsDir, { recursive: true });

const makeIcons = async ([network, source]: [Network, Source]) => {
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`${source.url}: ${response.status}`);
  }
  const shapes = shapesOf(await response.text());
  await Promise.all(
    (["color", "white"] as const).map(async (style) => {
      const white = style === "white";
      const svg = iconSvg(
        shapes,
        source,
        white ? "#FFFFFF" : source.color,
        white
      );
      const png = await sharp(Buffer.from(svg))
        .png({ compressionLevel: 9 })
        .toBuffer();
      writeFileSync(path.join(iconsDir, `${network}-${style}.png`), png);
    })
  );
};

await Promise.all(
  (Object.entries(SOURCES) as [Network, Source][]).map(makeIcons)
);
