// What the site states about core's Blocks and layouts, in words. Apart from
// package-facts.ts, which reaches Node's Buffer through the examples, so the
// browser can use it too.
import { BLOCK_TYPES, ROW_LAYOUTS } from "@mailquilt/core";

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
export const listed = (items: readonly string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** The most Columns a Row can have. */
export const MOST_COLUMNS = Math.max(
  ...ROW_LAYOUTS.map((layout) => layout.split("/").length)
);

/** Every type of Block by name, in the order the editor offers them. */
export const BLOCK_NAMES = listed(BLOCK_TYPES.map(({ label }) => label));
