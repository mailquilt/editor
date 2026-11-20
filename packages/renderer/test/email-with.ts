import type { Block, BlocksDocument, BlockType } from "@mailquilt/core";

/** An export with a line break between tags, so a saved file's diff can be read. */
export const readable = (html: string) => html.replaceAll("><", ">\n<");

/**
 * An email with one Row and one Column holding `blocks`. Their props are cast,
 * as `renderEmail` checks them when it loads the email.
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
