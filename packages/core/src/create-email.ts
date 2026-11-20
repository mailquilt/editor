import { textBlock } from "./blocks.js";
import { createId, DOCUMENT_VERSION } from "./document.js";
import type { BlocksDocument } from "./document.js";

/**
 * How wide a new email is, in pixels.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const NEW_EMAIL_WIDTH = 600;

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
    width: NEW_EMAIL_WIDTH,
  },
  version: DOCUMENT_VERSION,
});
