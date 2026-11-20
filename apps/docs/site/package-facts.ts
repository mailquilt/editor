// The counts the site states, taken from the packages when the site is built,
// so no page can quote an old one. The docs pages read them as Blume
// variables, set in blume.config.ts.
import { BLOCK_TYPES, ROW_LAYOUTS } from "@mailquilt/core";

import site from "../package.json" with { type: "json" };
import { examples } from "./examples";

const WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/** A count in words, as the site writes one, such as "six". */
export const inWords = (count: number) => WORDS[count] ?? String(count);

/** Joined as a sentence lists things, such as "a, b and c". */
const listed = (items: readonly string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** Each published package, as the site installs every one of them. */
const packages = Object.keys(site.dependencies).filter((name) =>
  name.startsWith("@mailquilt/")
);

/** The most Columns a Row can have. */
export const MOST_COLUMNS = Math.max(
  ...ROW_LAYOUTS.map((layout) => layout.split("/").length)
);

export const COUNTS = {
  blocks: inWords(BLOCK_TYPES.length),
  examples: inWords(examples.length),
  layouts: inWords(ROW_LAYOUTS.length),
  mostColumns: inWords(MOST_COLUMNS),
  packages: inWords(packages.length),
};

/** Every type of Block by name, in the order the editor offers them. */
export const BLOCK_NAMES = listed(BLOCK_TYPES.map(({ label }) => label));

/** How wide a new email is, in pixels. */
export { NEW_EMAIL_WIDTH as EMAIL_WIDTH } from "@mailquilt/core/internal";

/** With a capital letter, to start a sentence. */
export const capitalized = (text: string) =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
