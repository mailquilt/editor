import { createEditor, createEmail } from "@mailquilt/core";

const paragraph = (text) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

// A new email has one Row, one Column and one empty Text Block.
const editor = createEditor({ document: createEmail() });
const [firstRow] = editor.getDocument().rows;
const [textBlock] = firstRow.columns[0].blocks;

editor.apply({
  blockId: textBlock.id,
  props: { content: paragraph("Hi {{first_name}}, your order has shipped.") },
  type: "updateBlockProps",
});

// A Command that adds a Block can give it its content too.
editor.apply({
  blockType: "heading",
  props: { content: paragraph("On its way"), level: 1 },
  rowIndex: 0,
  type: "insertBlockInNewRow",
});

// A Command the email can't take is refused, and the email stays as it was.
const refused = editor.apply({
  blockId: textBlock.id,
  props: { color: "not a color" },
  type: "updateBlockProps",
});
console.log(refused.ok, refused.code, refused.reason);

export const email = editor.getDocument();
