import { textBlock } from "./blocks.js";
import { createId, DOCUMENT_VERSION } from "./document.js";
import type { BlocksDocument } from "./document.js";

/** Creates a new email with one Row, one Column and one empty Text Block. */
export const createEmail = (): BlocksDocument => ({
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: [
            {
              id: createId(),
              props: structuredClone(textBlock.defaults),
              type: "text",
            },
          ],
          id: createId(),
          props: {},
          width: 100,
        },
      ],
      id: createId(),
      props: {},
    },
  ],
  settings: {
    backgroundColor: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    width: 600,
  },
  version: DOCUMENT_VERSION,
});
