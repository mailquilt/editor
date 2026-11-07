import { textBlock } from "./blocks.js";
import type { BlocksDocument } from "./document.js";

export const DOCUMENT_VERSION = 1;

export const createId = () => {
  // getRandomValues, unlike randomUUID, also works on plain-HTTP host pages.
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
};

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
