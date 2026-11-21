import type { BlocksDocument, RichTextText } from "@mailquilt/core";

/** An email of Text Blocks: each Row's Columns, as each Column's pieces of text. */
const emailOf = (rows: RichTextText[][][]): BlocksDocument => ({
  kind: "blocks",
  rows: rows.map((columns, rowIndex) => ({
    columns: columns.map((inlines, columnIndex) => ({
      blocks: inlines.map((inline) => ({
        id: `block-${inline.text}`,
        props: {
          content: {
            content: [{ content: [inline], type: "paragraph" }],
            type: "doc",
          },
        },
        type: "text",
      })),
      id: `column-${rowIndex}-${columnIndex}`,
      props: {},
      width: 100 / columns.length,
    })),
    id: `row-${rowIndex}`,
    props: {},
  })),
  settings: {
    backgroundColor: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    width: 600,
  },
  version: 3,
});

/** An email from each Row's Columns, as the text of each Column's Blocks. */
export const emailWith = (rows: string[][][]) =>
  emailOf(
    rows.map((columns) =>
      columns.map((texts) => texts.map((text) => ({ text, type: "text" })))
    )
  );

/** An email with one Text Block, holding one piece of text. */
export const emailWithInline = (inline: RichTextText) => emailOf([[[inline]]]);
