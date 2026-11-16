import type { BlocksDocument } from "@mailquilt/react";

/** The email the editor opens with when nothing is saved. */
export const starterEmail: BlocksDocument = {
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: [
            {
              id: "block-1",
              props: {
                content: {
                  content: [
                    {
                      content: [{ text: "Hello", type: "text" }],
                      type: "paragraph",
                    },
                  ],
                  type: "doc",
                },
              },
              type: "text",
            },
          ],
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
  version: 1,
};
