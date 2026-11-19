import type { BlocksDocument } from "@mailquilt/core";

/** An export with a line break between tags, so a saved file's diff can be read. */
export const readable = (html: string) => html.replaceAll("><", ">\n<");

/** An email with one Row and one Column holding `blocks`. */
export const emailWith = (
  ...blocks: { props: Record<string, unknown>; type: string }[]
): BlocksDocument => ({
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: blocks.map((block, index) => ({
            id: `block-${index}`,
            ...block,
          })),
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
