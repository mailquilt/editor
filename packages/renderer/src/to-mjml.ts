import { blockStyles, loadDocument, rowStyles } from "@mailquilt/core";
import type {
  Block,
  BlocksDocument,
  Column,
  RichTextDocument,
  RichTextHardBreak,
  RichTextMark,
  RichTextNode,
  RichTextParagraph,
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

/** Whether a paragraph's last line needs a <br /> to take up space. */
const endsWithoutText = (inline: RichTextParagraph["content"] = []) =>
  inline.at(-1)?.type !== "text";

const richTextToHtml = ({ content }: RichTextDocument) =>
  content
    .map((paragraph) => {
      const inline = paragraph.content ?? [];
      const html = inline.map(inlineToHtml).join("");
      // A last empty line takes up space on the canvas, but a <br /> at the end
      // of a paragraph doesn't make one on its own. Nor does an empty paragraph.
      return `<p style="margin:0;white-space:pre-wrap">${html}${endsWithoutText(inline) ? "<br />" : ""}</p>`;
    })
    .join("");

const LINE_HEIGHT = "1.5";

/** MJML's attributes share their CSS names, apart from this one. */
const mjmlAttributes = (styles: Record<string, string>) =>
  Object.entries(styles)
    .map(
      ([name, value]) =>
        ` ${name === "text-align" ? "align" : name}="${escapeAttribute(value)}"`
    )
    .join("");

const hasText = ({ content }: RichTextDocument) =>
  content.some((paragraph) =>
    paragraph.content?.some(
      (node) => node.type === "text" && node.text.trim() !== ""
    )
  );

/**
 * One heading, however many lines, or a screen reader would read it as several.
 * Its styles are on the tag as well, including what it would otherwise inherit,
 * because email clients give a heading their own. With no text it's only an empty
 * line, as a screen reader would announce an empty heading.
 */
const headingToHtml = (block: Block, fontFamily: string) => {
  const { content, level } = block.props as unknown as {
    content: RichTextDocument;
    level: number;
  };
  const lines = content.content
    .map((paragraph) => (paragraph.content ?? []).map(inlineToHtml).join(""))
    .join("<br />");
  const lastLine = endsWithoutText(content.content.at(-1)?.content)
    ? "<br />"
    : "";
  const tag = hasText(content) ? `h${level}` : "p";
  const styles = Object.entries({
    "font-family": fontFamily,
    "line-height": LINE_HEIGHT,
    ...blockStyles(block),
  })
    .map(([name, value]) => `${name}:${escapeAttribute(value)}`)
    .join(";");
  return `<${tag} style="margin:0;white-space:pre-wrap;${styles}">${lines}${lastLine}</${tag}>`;
};

const linkAttribute = (href: string | undefined) =>
  href === undefined ? "" : ` href="${escapeAttribute(href)}"`;

const blockToMjml = (block: Block, fontFamily: string) => {
  const attributes = mjmlAttributes(blockStyles(block));
  switch (block.type) {
    case "text": {
      return `<mj-text${attributes}>${richTextToHtml(block.props.content as RichTextDocument)}</mj-text>`;
    }
    case "heading": {
      return `<mj-text${attributes}>${headingToHtml(block, fontFamily)}</mj-text>`;
    }
    case "button": {
      const { href, label } = block.props as { href?: string; label: string };
      return `<mj-button${attributes}${linkAttribute(href)}>${escapeText(label)}</mj-button>`;
    }
    case "image": {
      const {
        alt = "",
        href,
        src,
      } = block.props as {
        alt?: string;
        href?: string;
        src?: string;
      };
      // Until it has a URL, there's no image, and a link would have nothing in it.
      if (src === undefined) {
        return "";
      }
      return `<mj-image${attributes} alt="${escapeAttribute(alt)}" src="${escapeAttribute(src)}"${linkAttribute(href)}></mj-image>`;
    }
    case "divider": {
      return `<mj-divider${attributes}></mj-divider>`;
    }
    case "spacer": {
      return `<mj-spacer${attributes}></mj-spacer>`;
    }
    default: {
      throw new Error(`Can't render unknown Block type "${block.type}"`);
    }
  }
};

const columnToMjml = ({ blocks, width }: Column, fontFamily: string) =>
  `<mj-column width="${width}%">${blocks.map((block) => blockToMjml(block, fontFamily)).join("")}</mj-column>`;

const rowToMjml = (row: Row, fontFamily: string) =>
  `<mj-section${mjmlAttributes(rowStyles(row))}>${row.columns.map((column) => columnToMjml(column, fontFamily)).join("")}</mj-section>`;

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
      <mj-text line-height="${LINE_HEIGHT}" padding="16px" />
      <mj-button font-size="16px" line-height="${LINE_HEIGHT}" padding="16px" />
      <mj-image padding="16px" />
      <mj-divider padding="16px" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="${escapeAttribute(settings.backgroundColor)}" width="${settings.width}px">
    ${rows.map((row) => rowToMjml(row, settings.fontFamily)).join("")}
  </mj-body>
</mjml>`;
};
