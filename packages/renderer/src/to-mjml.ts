import { loadDocument } from "@mailquilt/core";
import type {
  Block,
  Column,
  RichTextDocument,
  RichTextMark,
  RichTextParagraph,
  Row,
} from "@mailquilt/core";
import {
  blockStyles,
  EMAIL_LOOK,
  MERGE_TAG,
  rowStyles,
} from "@mailquilt/core/internal";

const escapeText = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const escapeAttribute = (value: string) =>
  escapeText(value).replaceAll('"', "&quot;");

/**
 * Repeated spaces as the canvas shows them. Each space after another, or at the
 * start of a line, is a no-break space. Not `white-space:pre-wrap`, which shows
 * the line breaks and indents some clients add when they reformat the HTML.
 */
const keepSpaces = (text: string, afterSpace: boolean) =>
  text.replaceAll(" ", (space, offset: number) =>
    (offset === 0 ? afterSpace : text[offset - 1] === " ") ? "&nbsp;" : space
  );

/**
 * A paragraph's or heading's own style. A word too long for its Column, such as
 * a pasted URL, breaks rather than widening the email. Classic Outlook ignores
 * both properties.
 */
const TEXT_STYLE = "margin:0;word-break:break-word;overflow-wrap:anywhere";

/**
 * A text's line height in pixels, 1.5 times its font size rounded up, which the
 * canvas shows as 1.5. Classic Outlook draws a thin line under text whose line
 * height is 1.5, and squeezes its lines (#95).
 */
const exactLineHeight = (fontSize: string = EMAIL_LOOK.fontSize) =>
  `${Math.ceil(Number(fontSize.replace("px", "")) * Number(EMAIL_LOOK.lineHeight))}px`;

const MERGE_TAG_PART = new RegExp(`(${MERGE_TAG.source})`, "u");

/**
 * A word of 20 or more characters, such as a pasted URL, gets a zero-width space
 * after each / . - ? & = and _, outside Merge Tags and the // of a URL. Yahoo,
 * AOL, GMX, Web.de and classic Outlook ignore CSS that breaks a word, and widened
 * the email with it (#91). Shorter words, and numbers such as 3.5, stay whole.
 */
const breakLongWords = (html: string) =>
  html.replaceAll(/\S{20,}/gu, (word) =>
    word
      .split(MERGE_TAG_PART)
      .map((part, index) =>
        index % 2 === 1
          ? part
          : part.replaceAll(/&amp;|\/(?!\/)|[.\-?=_]/gu, "$&&#8203;")
      )
      .join("")
  );

const MARK_TAGS = {
  bold: "strong",
  italic: "em",
  link: "a",
  underline: "u",
} as const;

/** The editor's order, which keeps a link around the other marks. */
const MARK_ORDER: RichTextMark["type"][] = [
  "link",
  "bold",
  "italic",
  "underline",
];

/**
 * A link is in its Block's color and underlined, as on the canvas. Without a
 * color, each client uses its own, which can't be read on a dark Row.
 */
const openTag = (mark: RichTextMark, linkColor: string) =>
  mark.type === "link"
    ? `<a href="${escapeAttribute(mark.attrs.href)}" target="_blank" style="color:${escapeAttribute(linkColor)};text-decoration:underline">`
    : `<${MARK_TAGS[mark.type]}>`;

/** A URL written as text, without the punctuation that may end a sentence after it. */
const URL_IN_TEXT = /(?<url>https?:\/\/[^\s<>"]*[^\s<>".,;:!?)'\]])/u;

/**
 * A text's HTML. A URL in text that isn't already linked becomes a link to
 * itself, as Apple Mail and Gmail would make it, because its break points stop
 * them recognizing it (#91).
 */
const textToHtml = (
  text: string,
  linkColor: string,
  afterSpace: boolean,
  linked: boolean
) =>
  (linked ? [text] : text.split(URL_IN_TEXT))
    .map((part, index) =>
      index % 2 === 1
        ? `${openTag({ attrs: { href: part }, type: "link" }, linkColor)}${breakLongWords(escapeText(part))}</a>`
        : keepSpaces(
            breakLongWords(escapeText(part)),
            index === 0 ? afterSpace : false
          )
    )
    .join("");

const isSameMark = (a: RichTextMark, b: RichTextMark) =>
  a.type === "link" && b.type === "link"
    ? a.attrs.href === b.attrs.href
    : a.type === b.type;

/**
 * A line's text and line breaks. Each mark stays open for as long as the text
 * next to it has it too, as on the canvas, or a link around partly bold text
 * would be several links. Marks go in the editor's order, whatever order they
 * were saved in, so that one text's [bold, link] matches the next's [link].
 */
const inlineToHtml = (
  linkColor: string,
  inline: RichTextParagraph["content"] = []
) => {
  const open: RichTextMark[] = [];
  let html = "";
  let afterSpace = true;
  const closeFrom = (index: number) => {
    for (const mark of open.splice(index).toReversed()) {
      html += `</${MARK_TAGS[mark.type]}>`;
    }
  };
  for (const node of inline) {
    const marks = (node.marks ?? []).toSorted(
      (a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type)
    );
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
      afterSpace = true;
    } else {
      for (const mark of marks.slice(kept)) {
        html += openTag(mark, linkColor);
        open.push(mark);
      }
      html += textToHtml(
        node.text,
        linkColor,
        afterSpace,
        marks[0]?.type === "link"
      );
      afterSpace = node.text.endsWith(" ");
    }
  }
  closeFrom(0);
  return html;
};

/** Whether a paragraph's last line needs a <br /> to take up space. */
const endsWithoutText = (inline: RichTextParagraph["content"] = []) =>
  inline.at(-1)?.type !== "text";

const richTextToHtml = (
  { content }: RichTextDocument,
  linkColor: string,
  lineHeight: string
) =>
  content
    .map(({ content: inline }) => {
      const html = inlineToHtml(linkColor, inline);
      // A last empty line takes up space on the canvas, but a <br /> at the end
      // of a paragraph doesn't make one on its own. Nor does an empty paragraph.
      return `<p style="${TEXT_STYLE};line-height:${lineHeight};mso-line-height-rule:exactly">${html}${endsWithoutText(inline) ? "<br />" : ""}</p>`;
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
const headingToHtml = (
  block: Block,
  fontFamily: string,
  blockCss: Record<string, string>,
  lineHeight: string
) => {
  const { content, level } = block.props as unknown as {
    content: RichTextDocument;
    level: number;
  };
  const lines = content.content
    .map((paragraph) => inlineToHtml(blockCss.color ?? "", paragraph.content))
    .join("<br />");
  const lastLine = endsWithoutText(content.content.at(-1)?.content)
    ? "<br />"
    : "";
  const tag = hasText(content) ? `h${level}` : "p";
  const styles = Object.entries({
    "font-family": fontFamily,
    "line-height": lineHeight,
    "mso-line-height-rule": "exactly",
    ...blockCss,
  })
    .map(([name, value]) => `${name}:${escapeAttribute(value)}`)
    .join(";");
  return `<${tag} style="${TEXT_STYLE};${styles}">${lines}${lastLine}</${tag}>`;
};

const linkAttribute = (href: string | undefined) =>
  href === undefined ? "" : ` href="${escapeAttribute(href)}"`;

const blockToMjml = (block: Block, fontFamily: string) => {
  const blockCss = blockStyles(block);
  const attributes = mjmlAttributes(blockCss);
  switch (block.type) {
    case "text": {
      const lineHeight = exactLineHeight(blockCss["font-size"]);
      return `<mj-text${attributes} line-height="${lineHeight}">${richTextToHtml(block.props.content as RichTextDocument, blockCss.color ?? "", lineHeight)}</mj-text>`;
    }
    case "heading": {
      const lineHeight = exactLineHeight(blockCss["font-size"]);
      return `<mj-text${attributes} line-height="${lineHeight}">${headingToHtml(block, fontFamily, blockCss, lineHeight)}</mj-text>`;
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

/** Marks a Column that shares its Row, for `limitColumnWidths`. */
const SHARED_COLUMN = "mq-column";

const columnToMjml = (
  { blocks, width }: Column,
  fontFamily: string,
  shared: boolean
) =>
  `<mj-column width="${width}%"${shared ? ` css-class="${SHARED_COLUMN}"` : ""}>${blocks.map((block) => blockToMjml(block, fontFamily)).join("")}</mj-column>`;

const rowToMjml = (row: Row, fontFamily: string) =>
  `<mj-section${mjmlAttributes(rowStyles(row))}>${row.columns.map((column) => columnToMjml(column, fontFamily, row.columns.length > 1)).join("")}</mj-section>`;

/**
 * MJML gives a Column its desktop width only inside a media query, and
 * `width:100%` inline. GMX, Web.de, T-Online and Libero drop the media query,
 * so Columns that share a Row stacked on a desktop. Each one gets its desktop
 * width inline as a `max-width` in pixels, which a phone media query lifts so
 * they still stack there (ADR 0005). Rounded down, so the Columns never add up
 * to more than the email and wrap.
 */
export const limitColumnWidths = (html: string, emailWidth: number) =>
  html.replaceAll(
    new RegExp(
      `(class="mj-column-per-(\\d+)(?:-(\\d+))? mj-outlook-group-fix ${SHARED_COLUMN}" style="[^"]*)width:100%;`,
      "gu"
    ),
    (_match, start: string, whole: string, fraction = "") =>
      `${start}width:100%;max-width:${Math.floor(emailWidth * Number(`${whole}.${fraction}`)) / 100}px;`
  );

/** Throws if the document can't be trusted, and renders migrated older ones. */
export const toMjml = (document: unknown) => {
  const loaded = loadDocument(document);
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  const { rows, settings } = loaded.document;
  const sharedColumns = rows.some(({ columns }) => columns.length > 1)
    ? `<mj-style>@media only screen and (max-width:479px) { .${SHARED_COLUMN} { max-width:100% !important; } }</mj-style>`
    : "";
  const language = settings.language
    ? ` lang="${escapeAttribute(settings.language)}"`
    : "";
  const preheader = settings.preheader
    ? `<mj-preview>${escapeText(settings.preheader)}</mj-preview>`
    : "";
  const mjml = `<mjml${language}>
  <mj-head>
    ${preheader}
    ${sharedColumns}
    <mj-attributes>
      <mj-all font-family="${escapeAttribute(settings.fontFamily)}" />
      <mj-section padding="0" />
      <mj-text padding="${EMAIL_LOOK.blockPadding}" />
      <mj-button font-size="${EMAIL_LOOK.fontSize}" line-height="${EMAIL_LOOK.lineHeight}" padding="${EMAIL_LOOK.blockPadding}" />
      <mj-image padding="${EMAIL_LOOK.blockPadding}" />
      <mj-divider padding="${EMAIL_LOOK.blockPadding}" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="${escapeAttribute(settings.backgroundColor)}" width="${settings.width}px">
    ${rows.map((row) => rowToMjml(row, settings.fontFamily)).join("")}
  </mj-body>
</mjml>`;
  return { emailWidth: settings.width, mjml };
};
