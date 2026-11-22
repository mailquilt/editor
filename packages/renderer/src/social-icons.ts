import type { BlockProps } from "@mailquilt/core/internal";

import packageJson from "../package.json" with { type: "json" };

type SocialProps = BlockProps["social"];

/**
 * Where an email loads the Social Block's icons from, unless the Host app gives
 * `socialIconsUrl`: this package, on jsDelivr, at its exact version, so a later
 * release can't change an email already sent (ADR 0019).
 */
const PUBLISHED_ICONS = `https://cdn.jsdelivr.net/npm/${packageJson.name}@${packageJson.version}/icons/`;

/**
 * The URL of one of the Social Block's icons, under `base` if the Host app
 * gives one, with or without its last slash. An empty one is no folder, so the
 * icons still load.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const socialIconUrl = (
  network: SocialProps["links"][number]["network"],
  style: NonNullable<SocialProps["iconStyle"]>,
  base?: string
) => {
  const folder = base || PUBLISHED_ICONS;
  return `${folder.endsWith("/") ? folder : `${folder}/`}${network}-${style}.png`;
};
