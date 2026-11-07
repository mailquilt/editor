import { blockStyles, loadDocument, rowStyles } from "@mailquilt/core";
import type {
  Block,
  BlocksDocument,
  Column,
  RichTextDocument,
  RichTextHardBreak,
  RichTextMark,
  RichTextNode,
  Row,
} from "@mailquilt/core";

const escapeText = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const escapeAttribute = (value: string) =>
  escapeText(value).replaceAll('"', "&quot;");

const wrapInMark = (html: string, mark: RichTextMark) => {
  switch (mark.type) {
    case "bold": {
      return `<strong>${html}</strong>`;
    }
    case "italic": {
      return `<em>${html}</em>`;
    }
    case "underline": {
      return `<u>${html}</u>`;
    }
    case "link": {
      return `<a href="${escapeAttribute(mark.attrs.href)}" target="_blank">${html}</a>`;
    }
    default: {
      throw new Error("Unknown mark");
    }
  }
};

const inlineToHtml = (node: RichTextHardBreak | RichTextNode) => {
  if (node.type === "hardBreak") {
    return "<br />";
  }
  let html = escapeText(node.text);
  // Inner marks first, so that the first mark goes on the outside. Tiptap lists
  // links first, which keeps them around the other marks.
  for (const mark of (node.marks ?? []).toReversed()) {
    html = wrapInMark(html, mark);
  }
  return html;
};

const richTextToHtml = ({ content }: RichTextDocument) =>
  content
    .map((paragraph) => {
      const inline = paragraph.content ?? [];
      const html = inline.map(inlineToHtml).join("");
      // A last empty line takes up space on the canvas, but a <br /> at the end
      // of a paragraph doesn't make one on its own. Nor does an empty paragraph.
      const needsLastLine = inline.at(-1)?.type !== "text";
      return `<p style="margin:0;white-space:pre-wrap">${html}${needsLastLine ? "<br />" : ""}</p>`;
    })
    .join("");

/** MJML's attributes share their CSS names, apart from this one. */
const mjmlAttributes = (styles: Record<string, string>) =>
  Object.entries(styles)
    .map(
      ([name, value]) =>
        ` ${name === "text-align" ? "align" : name}="${escapeAttribute(value)}"`
    )
    .join("");

const blockToMjml = (block: Block) => {
  if (block.type !== "text") {
    throw new Error(`Can't render unknown Block type "${block.type}"`);
  }
  return `<mj-text${mjmlAttributes(blockStyles(block))}>${richTextToHtml(block.props.content as RichTextDocument)}</mj-text>`;
};

const columnToMjml = ({ blocks, width }: Column) =>
  `<mj-column width="${width}%">${blocks.map(blockToMjml).join("")}</mj-column>`;

const rowToMjml = (row: Row) =>
  `<mj-section${mjmlAttributes(rowStyles(row))}>${row.columns.map(columnToMjml).join("")}</mj-section>`;

/** Throws if the document can't be trusted, and renders migrated older ones. */
export const toMjml = (document: BlocksDocument) => {
  const loaded = loadDocument(document);
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  const { rows, settings } = loaded.document;
  const language = settings.language
    ? ` lang="${escapeAttribute(settings.language)}"`
    : "";
  const preheader = settings.preheader
    ? `<mj-preview>${escapeText(settings.preheader)}</mj-preview>`
    : "";
  return `<mjml${language}>
  <mj-head>
    ${preheader}
    <mj-attributes>
      <mj-all font-family="${escapeAttribute(settings.fontFamily)}" />
      <mj-section padding="0" />
      <mj-text line-height="1.5" padding="16px" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="${escapeAttribute(settings.backgroundColor)}" width="${settings.width}px">
    ${rows.map(rowToMjml).join("")}
  </mj-body>
</mjml>`;
};
