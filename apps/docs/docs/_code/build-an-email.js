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
  type: "updateProps",
});

// A Command that adds something returns the ID of what it added.
const heading = editor.apply({
  blockType: "heading",
  rowIndex: 0,
  type: "insertBlockInNewRow",
});
if (heading.ok) {
  editor.apply({
    blockId: heading.createdId,
    props: { content: paragraph("On its way") },
    type: "updateProps",
  });
}

// A Command the email can't take is refused, and the email stays as it was.
const refused = editor.apply({
  blockId: textBlock.id,
  props: { color: "not a color" },
  type: "updateProps",
});
console.log(refused.ok, refused.reason);

export const email = editor.getDocument();
