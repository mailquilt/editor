import {
  blockStyles,
  EMAIL_LOOK,
  loadDocument,
  rowStyles,
} from "@mailquilt/core";
import type {
  Block,
  Column,
  RichTextDocument,
  RichTextMark,
  RichTextParagraph,
  Row,
} from "@mailquilt/core";

const escapeText = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const escapeAttribute = (value: string) =>
  escapeText(value).replaceAll('"', "&quot;");

const MARK_TAGS = {
  bold: "strong",
  italic: "em",
  link: "a",
  underline: "u",
} as const;

const openTag = (mark: RichTextMark) =>
  mark.type === "link"
    ? `<a href="${escapeAttribute(mark.attrs.href)}" target="_blank">`
    : `<${MARK_TAGS[mark.type]}>`;

const isSameMark = (a: RichTextMark, b: RichTextMark) =>
  a.type === "link" && b.type === "link"
    ? a.attrs.href === b.attrs.href
    : a.type === b.type;

/**
 * A line's text and line breaks. Each mark stays open for as long as the text
 * next to it has it too, as on the canvas, or a link around partly bold text
 * would be several links. The first mark goes on the outside, and the editor's
 * schema lists links first, which keeps them around the other marks.
 */
const inlineToHtml = (inline: RichTextParagraph["content"] = []) => {
  const open: RichTextMark[] = [];
  let html = "";
  const closeFrom = (index: number) => {
    for (const mark of open.splice(index).toReversed()) {
      html += `</${MARK_TAGS[mark.type]}>`;
    }
  };
  for (const node of inline) {
    const marks = node.marks ?? [];
    let kept = 0;
    while (
      kept < open.length &&
      kept < marks.length &&
      isSameMark(open[kept] as RichTextMark, marks[kept] as RichTextMark)
    ) {
      kept += 1;
    }
    closeFrom(kept);
    if (node.type === "hardBreak") {
      // It keeps a mark open across it, but opens none of its own.
      html += "<br />";
    } else {
      for (const mark of marks.slice(kept)) {
        html += openTag(mark);
        open.push(mark);
      }
      html += escapeText(node.text);
    }
  }
  closeFrom(0);
  return html;
};

/** Whether a paragraph's last line needs a <br /> to take up space. */
const endsWithoutText = (inline: RichTextParagraph["content"] = []) =>
  inline.at(-1)?.type !== "text";

const richTextToHtml = ({ content }: RichTextDocument) =>
  content
    .map((paragraph) => {
      const inline = paragraph.content ?? [];
      const html = inlineToHtml(inline);
      // A last empty line takes up space on the canvas, but a <br /> at the end
      // of a paragraph doesn't make one on its own. Nor does an empty paragraph.
      return `<p style="margin:0;white-space:pre-wrap">${html}${endsWithoutText(inline) ? "<br />" : ""}</p>`;
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
    .map((paragraph) => inlineToHtml(paragraph.content))
    .join("<br />");
  const lastLine = endsWithoutText(content.content.at(-1)?.content)
    ? "<br />"
    : "";
  const tag = hasText(content) ? `h${level}` : "p";
  const styles = Object.entries({
    "font-family": fontFamily,
    "line-height": EMAIL_LOOK.lineHeight,
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
export const toMjml = (document: unknown) => {
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
      <mj-text line-height="${EMAIL_LOOK.lineHeight}" padding="${EMAIL_LOOK.blockPadding}" />
      <mj-button font-size="${EMAIL_LOOK.fontSize}" line-height="${EMAIL_LOOK.lineHeight}" padding="${EMAIL_LOOK.blockPadding}" />
      <mj-image padding="${EMAIL_LOOK.blockPadding}" />
      <mj-divider padding="${EMAIL_LOOK.blockPadding}" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="${escapeAttribute(settings.backgroundColor)}" width="${settings.width}px">
    ${rows.map((row) => rowToMjml(row, settings.fontFamily)).join("")}
  </mj-body>
</mjml>`;
};
