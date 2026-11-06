import type {
  Block,
  BlocksDocument,
  Column,
  RichTextDocument,
  Row,
} from "@mailquilt/core";

const escapeText = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const escapeAttribute = (value: string) =>
  escapeText(value).replaceAll('"', "&quot;");

const richTextToHtml = ({ content }: RichTextDocument) =>
  content
    .map((paragraph) => {
      const text = paragraph.content
        ?.map((node) => escapeText(node.text))
        .join("");
      // An empty paragraph still takes up a line, as it does on the canvas.
      return `<p style="margin:0;white-space:pre-wrap">${text || "<br />"}</p>`;
    })
    .join("");

const blockToMjml = (block: Block) => {
  if (block.type !== "text") {
    throw new Error(`Can't render unknown Block type "${block.type}"`);
  }
  return `<mj-text>${richTextToHtml(block.props.content as RichTextDocument)}</mj-text>`;
};

const columnToMjml = ({ blocks, width }: Column) =>
  `<mj-column width="${width}%">${blocks.map(blockToMjml).join("")}</mj-column>`;

const rowToMjml = ({ columns }: Row) =>
  `<mj-section>${columns.map(columnToMjml).join("")}</mj-section>`;

export const toMjml = ({ rows, settings }: BlocksDocument) => `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="${escapeAttribute(settings.fontFamily)}" />
      <mj-section padding="0" />
      <mj-text color="#000000" font-size="16px" line-height="1.5" padding="16px" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="${escapeAttribute(settings.backgroundColor)}" width="${settings.width}px">
    ${rows.map(rowToMjml).join("")}
  </mj-body>
</mjml>`;
