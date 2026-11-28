import type { Block, BlocksDocument, BlockType } from "@mailquilt/core";

const PACKAGE_VERSION_IN_URL = /@mailquilt\/renderer@[^/]+\//gu;

/**
 * An export with a line break between tags, so a saved file's diff can be read.
 * The renderer's own version in a default icon URL is swapped for `VERSION`, so
 * a release doesn't change the saved files.
 */
export const readable = (html: string) =>
  html
    .replaceAll("><", ">\n<")
    .replaceAll(PACKAGE_VERSION_IN_URL, "@mailquilt/renderer@VERSION/");

/**
 * An email with one Row and one Column holding `blocks`. Their props are cast,
 * as `renderEmail` checks them when it loads the email. It's version 2, so each
 * Merge Tag in its text becomes a node as it loads, as in an email saved with
 * `0.2.0`.
 */
export const emailWith = (
  ...blocks: { props: Record<string, unknown>; type: BlockType }[]
): BlocksDocument => ({
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: blocks.map(
            (block, index) => ({ id: `block-${index}`, ...block }) as Block
          ),
          id: "column-1",
          props: {},
          width: 100,
        },
      ],
      id: "row-1",
      props: {},
    },
  ],
  settings: {
    backgroundColor: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    width: 600,
  },
  version: 2,
});
