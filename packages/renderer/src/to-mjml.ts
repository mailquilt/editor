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
import type { BlockProps } from "@mailquilt/core/internal";

/** A space HTML doesn't collapse, or a Merge Tag, which may have one. */
const KEPT_SPACE_OR_MERGE_TAG = new RegExp(
  `${MERGE_TAG.source}|[^\\S\\t\\n\\f\\r ]`,
  "gu"
);

/**
 * A line break is escaped too, so `renderEmail` can tell it from MJML's layout.
 * In text it still shows as a space, and browsers leave one out of a link or
 * image address. So is each space HTML doesn't collapse, such as a no-break
 * space, as MJML trims every kind of space from the ends of a Button's label.
 * A Merge Tag's spaces stay as typed, so it's still filled in.
 */
const escapeText = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "&#10;")
    .replaceAll(KEPT_SPACE_OR_MERGE_TAG, (match) =>
      match.length === 1 ? `&#${match.codePointAt(0) as number};` : match
    );

const escapeAttribute = (value: string) =>
  escapeText(value).replaceAll('"', "&quot;");

/** A space, or a Merge Tag, which may have spaces of its own. */
const SPACE_OR_MERGE_TAG = new RegExp(`${MERGE_TAG.source}| `, "gu");

/**
 * Repeated spaces as the canvas shows them. Each space after another, or at the
 * start of a line, is a no-break space. Not `white-space:pre-wrap`, which shows
 * the line breaks and indents some clients add when they reformat the HTML.
 * A Merge Tag's spaces stay as typed, so it's still filled in.
 */
const keepSpaces = (text: string, afterSpace: boolean) =>
  text.replaceAll(SPACE_OR_MERGE_TAG, (match, offset: number) =>
    match === " " && (offset === 0 ? afterSpace : text[offset - 1] === " ")
      ? "&nbsp;"
      : match
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
const exactLineHeight = (fontSize: string) =>
  `${Math.ceil(Number(fontSize.replace("px", "")) * Number(EMAIL_LOOK.lineHeight))}px`;

const MERGE_TAG_PART = new RegExp(`(${MERGE_TAG.source})`, "u");

/**
 * Put before a character class: a whole Merge Tag, spaces and all, or one of
 * those characters that doesn't start one, so a word or URL never cuts a tag.
 */
const TAG_OR = `${MERGE_TAG.source}|(?!${MERGE_TAG.source})`;

/**
 * A word, with any Merge Tag in it whole, or the whitespace between words, which
 * has nothing to break after.
 */
const WORD_OR_SPACE = new RegExp(`(?:${TAG_OR}\\S)+|\\s+`, "gu");

/**
 * Text as HTML, escaped. A word of 20 or more characters as typed, such as a
 * pasted URL, gets a zero-width space after each / . - ? & = and _, outside
 * Merge Tags and the // of a URL. Yahoo, AOL, GMX, Web.de and classic Outlook
 * ignore CSS that breaks a word, and widened the email with it (#91). Shorter
 * words, and numbers such as 3.5, stay whole.
 */
const breakLongWords = (text: string) =>
  text.replaceAll(WORD_OR_SPACE, (word) =>
    [...word].length < 20
      ? escapeText(word)
      : word
          .split(MERGE_TAG_PART)
          .map((part, index) =>
            index % 2 === 1
              ? escapeText(part)
              : escapeText(part).replaceAll(
                  /&amp;|\/(?!\/)|[.\-?=_]/gu,
                  "$&&#8203;"
                )
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

/**
 * What follows a URL's `https://` or `www.`, with any Merge Tag in it whole, and
 * without the punctuation or closing bracket that may end a sentence after it.
 */
const URL_REST = `(?:${TAG_OR}[^\\s<>"])*(?:${TAG_OR}[^\\s<>".,;:!?)'\\]])`;

/**
 * Scripts written without spaces between words, such as Japanese, whose letters
 * end an address rather than join it, as in `info@example.comまで`.
 */
const WITHOUT_SPACES = String.raw`\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Thai}\p{scx=Lao}\p{scx=Khmer}\p{scx=Myanmar}`;

/** A letter or digit in any other script, which `\w` limits to ASCII. */
const LETTER = String.raw`(?![${WITHOUT_SPACES}])[\p{L}\p{M}\p{N}]`;

/** A part of a domain, which starts and ends with a letter or digit. */
const DOMAIN_PART = `${LETTER}(?:(?:${LETTER}|-)*${LETTER})?`;

/**
 * An email address, in any language. It may have an apostrophe, as in
 * o'brien@example.com, and a dot only between characters. It never starts right
 * after a character it may hold, a Merge Tag, a path or an @, nor ends right
 * before a letter, `_`, `-`, an @ or another part of its domain, so it's never a
 * part of something longer. A long word without an @ is read once, not once for
 * each character.
 */
const EMAIL_ADDRESS = `(?<!${LETTER}|[_'./+}@-])(?:${LETTER}|_)(?:${LETTER}|[_'+-])*(?:\\.(?:${LETTER}|[_'+-])+)*@${DOMAIN_PART}(?:\\.${DOMAIN_PART})+(?!${LETTER}|[_@-]|\\.${LETTER})`;

/**
 * A URL or email address written as text, or a Merge Tag, which is tried first
 * so that one written inside a tag, such as its default, stays part of it. The
 * letters of the scheme and `www.` may be capitals, spelled out because the u
 * flag's i would also take ſ as s. An address is tried before `www.`, so one
 * starting with it is still an address.
 */
const ADDRESS_IN_TEXT = new RegExp(
  `${MERGE_TAG.source}|(?<url>[Hh][Tt]{2}[Pp][Ss]?://${URL_REST})|(?<email>${EMAIL_ADDRESS})|(?<www>(?<!${LETTER}|[_./-])[Ww]{3}\\.${URL_REST})`,
  "gu"
);

/**
 * The URL or email address a match found, and where it goes, as clients would
 * link it. A Merge Tag isn't one. A URL takes the closing brackets after it
 * that it opened, as in Wikipedia's `Mercury_(planet)`.
 */
const addressAt = (
  text: string,
  { 0: match, groups = {}, index }: RegExpExecArray
) => {
  if (groups.email !== undefined) {
    return { href: `mailto:${match}`, written: match };
  }
  if (groups.url === undefined && groups.www === undefined) {
    return;
  }
  const unclosed = match.split("(").length - match.split(")").length;
  let end = index + match.length;
  while (end < index + match.length + unclosed && text[end] === ")") {
    end += 1;
  }
  const written = text.slice(index, end);
  return {
    href: groups.www === undefined ? written : `http://${written}`,
    written,
  };
};

type Inline = NonNullable<RichTextParagraph["content"]>[number];

/**
 * A paragraph's text and line breaks, with a link mark on each URL or email
 * address written in its text, as Apple Mail and Gmail would link it, because
 * its break points stop them recognizing it (#91). The text is read as the
 * reader sees it, across any change of formatting, so the link goes to the
 * whole address. One that runs into a link isn't linked, as that link already
 * goes somewhere else from a part of it. Each node and address is read once.
 */
const linkWrittenAddresses = (inline: Inline[]) => {
  let offset = 0;
  const spans = inline.map((node) => {
    const start = offset;
    offset += node.type === "text" ? node.text.length : 1;
    return { end: offset, node, start };
  });
  // A line break ends a URL or address, as a space would.
  const text = inline
    .map((node) => (node.type === "text" ? node.text : "\n"))
    .join("");
  const links: { end: number; href: string; start: number }[] = [];
  let first = 0;
  for (const match of text.matchAll(ADDRESS_IN_TEXT)) {
    const address = addressAt(text, match);
    if (address !== undefined) {
      const start = match.index;
      const end = start + address.written.length;
      while ((spans[first]?.end ?? end) <= start) {
        first += 1;
      }
      let linked = false;
      for (let index = first; (spans[index]?.start ?? end) < end; index += 1) {
        linked ||=
          spans[index]?.node.marks?.some((mark) => mark.type === "link") ??
          false;
      }
      if (!linked) {
        links.push({ end, href: address.href, start });
      }
    }
  }
  let next = 0;
  return spans.flatMap(({ end, node, start }): Inline[] => {
    const pieces: Inline[] = [];
    let from = start;
    while (node.type === "text" && from < end) {
      while ((links[next]?.end ?? end) <= from) {
        next += 1;
      }
      const link = links[next];
      const inLink = link !== undefined && link.start <= from;
      const to = Math.min(end, inLink ? link.end : (link?.start ?? end));
      pieces.push({
        ...node,
        marks: inLink
          ? [
              { attrs: { href: link.href }, type: "link" },
              ...(node.marks ?? []),
            ]
          : node.marks,
        text: node.text.slice(from - start, to - start),
      });
      from = to;
    }
    return pieces.length > 0 ? pieces : [node];
  });
};

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
  for (const node of linkWrittenAddresses(inline)) {
    const marks = (node.marks ?? []).toSorted(
      (a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type)
    );
    const differs = marks.findIndex((mark, index) => {
      const openMark = open[index];
      return openMark === undefined || !isSameMark(openMark, mark);
    });
    const kept = differs === -1 ? marks.length : differs;
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
      html += keepSpaces(breakLongWords(node.text), afterSpace);
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
  { content, level }: BlockProps["heading"],
  fontFamily: string,
  blockCss: TextCss,
  lineHeight: string
) => {
  const lines = content.content
    .map((paragraph) => inlineToHtml(blockCss.color, paragraph.content))
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

/** The styles core gives every Text and Heading, which always set these. */
type TextCss = Record<string, string> & { color: string; "font-size": string };

/**
 * A Block as MJML. The casts are safe, as `loadDocument` checked each Block's
 * props against its type's schema, and core's styles for a type always set the
 * same properties.
 */
const blockToMjml = (block: Block, fontFamily: string) => {
  const blockCss = blockStyles(block);
  const attributes = mjmlAttributes(blockCss);
  switch (block.type) {
    case "text": {
      const textCss = blockCss as TextCss;
      const lineHeight = exactLineHeight(textCss["font-size"]);
      return `<mj-text${attributes} line-height="${lineHeight}">${richTextToHtml((block.props as BlockProps["text"]).content, textCss.color, lineHeight)}</mj-text>`;
    }
    case "heading": {
      const textCss = blockCss as TextCss;
      const lineHeight = exactLineHeight(textCss["font-size"]);
      return `<mj-text${attributes} line-height="${lineHeight}">${headingToHtml(block.props as BlockProps["heading"], fontFamily, textCss, lineHeight)}</mj-text>`;
    }
    case "button": {
      const { href, label } = block.props as BlockProps["button"];
      return `<mj-button${attributes}${linkAttribute(href)}>${escapeText(label)}</mj-button>`;
    }
    case "image": {
      const { alt = "", href, src } = block.props as BlockProps["image"];
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
    // Only for a type core adds before this package can render it, which the
    // test that renders each of core's types would catch first.
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
