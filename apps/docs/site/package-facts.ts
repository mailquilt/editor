// The counts the site states, taken from the packages when the site is built,
// so no page can quote an old one. The docs pages read them as Blume
// variables, set in blume.config.ts.
import { BLOCK_TYPES, ROW_LAYOUTS } from "@mailquilt/core";

import site from "../package.json" with { type: "json" };
import { BLOCK_NAMES, inWords, MOST_COLUMNS } from "./core-facts";
import { examples } from "./examples";

export { BLOCK_NAMES, inWords, MOST_COLUMNS };

/** Each published package, as the site installs every one of them. */
const packages = Object.keys(site.dependencies).filter((name) =>
  name.startsWith("@mailquilt/")
);

export const COUNTS = {
  blocks: inWords(BLOCK_TYPES.length),
  examples: inWords(examples.length),
  layouts: inWords(ROW_LAYOUTS.length),
  mostColumns: inWords(MOST_COLUMNS),
  packages: inWords(packages.length),
};

/** How wide a new email is, in pixels. */
export { NEW_EMAIL_WIDTH as EMAIL_WIDTH } from "@mailquilt/core/internal";

/** With a capital letter, to start a sentence. */
export const capitalized = (text: string) =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
