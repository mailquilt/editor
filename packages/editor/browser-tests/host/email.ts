import type { BlocksDocument, RichTextNode } from "@mailquilt/core";

/** An email with one Text Block, holding one piece of text. */
export const emailWithInline = (inline: RichTextNode): BlocksDocument => ({
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
                  content: [{ content: [inline], type: "paragraph" }],
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
});

export const emailWith = (text: string) =>
  emailWithInline({ text, type: "text" });
