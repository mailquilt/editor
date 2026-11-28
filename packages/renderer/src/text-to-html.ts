import type {
  RichTextDocument,
  RichTextMark,
  RichTextParagraph,
} from "@mailquilt/core";
import type { BlockProps } from "@mailquilt/core/internal";

import { escapeAttribute, escapeText } from "./escape.js";
import {
  ADDRESS_IN_TEXT,
  SPACE_OR_MERGE_TAG,
  TAG_OR_BREAK,
  WORD_OR_SPACE,
} from "./text-patterns.js";

// An email's text as the HTML inside MJML's tags: escaped, with its marks, its
// spaces as the canvas shows them, break points in long words, and a link on
// each URL or email address written as text.

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
 * Where a text may break: after each / . - ? & = and _ in a word of 20 or more
 * characters as typed, such as a pasted URL, outside Merge Tags and the // of a
 * URL, and not at the word's end, where it already can. Yahoo, AOL, GMX, Web.de
 * and classic Outlook ignore CSS that breaks a word, and widened the email with
 * it (#91). Shorter words, and numbers such as 3.5, stay whole. Read across any
 * change of formatting, as the reader sees it.
 */
const breakPoints = (text: string) => {
  const breaks = new Uint8Array(text.length);
  for (const { 0: word, index } of text.matchAll(WORD_OR_SPACE)) {
    if ([...word].length >= 20) {
      for (const { 0: match, index: at } of word.matchAll(TAG_OR_BREAK)) {
        if (match.length === 1 && at < word.length - 1) {
          breaks[index + at] = 1;
        }
      }
    }
  }
  return breaks;
};

/** A piece of a text as HTML, escaped, with a zero-width space at each break. */
const withBreaks = (piece: string, start: number, breaks: Uint8Array) => {
  let html = "";
  let from = 0;
  for (let index = 0; index < piece.length; index += 1) {
    if (breaks[start + index] === 1) {
      html += `${escapeText(piece.slice(from, index + 1))}&#8203;`;
      from = index + 1;
    }
  }
  return html + escapeText(piece.slice(from));
};

/** Plain text, such as a Button's label, escaped, with its break points. */
export const plainTextToHtml = (text: string) =>
  withBreaks(text, 0, breakPoints(text));

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

/** Text and line breaks, as the passes below read them. */
type TextOrBreak = Exclude<Inline, { type: "mergeTag" }>;

/**
 * Each Merge Tag as the text `{{name}}`, with its marks, so it keeps the spaces,
 * escaping and break points a tag in text has always had, and an email saved
 * before tags were nodes exports the same.
 */
const tagsAsText = (inline: Inline[] = []): TextOrBreak[] =>
  inline.map((node) =>
    node.type === "mergeTag"
      ? {
          ...(node.marks ? { marks: node.marks } : {}),
          text: `{{${node.attrs.name}}}`,
          type: "text",
        }
      : node
  );

/**
 * A paragraph's text and line breaks, with a link mark on each URL or email
 * address written in its text, as Apple Mail and Gmail would link it, because
 * its break points stop them recognizing it (#91). The text is read as the
 * reader sees it, across any change of formatting, so the link goes to the
 * whole address. One that runs into a link isn't linked, as that link already
 * goes somewhere else from a part of it. Each node and address is read once.
 * Each piece comes with where it starts in the text.
 */
const linkWrittenAddresses = (inline: TextOrBreak[]) => {
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
  const pieces = spans.flatMap(({ end, node, start }) => {
    const parts: { node: TextOrBreak; start: number }[] = [];
    let from = start;
    while (node.type === "text" && from < end) {
      while ((links[next]?.end ?? end) <= from) {
        next += 1;
      }
      const link = links[next];
      const inLink = link !== undefined && link.start <= from;
      const to = Math.min(end, inLink ? link.end : (link?.start ?? end));
      parts.push({
        node: {
          ...node,
          marks: inLink
            ? [
                { attrs: { href: link.href }, type: "link" },
                ...(node.marks ?? []),
              ]
            : node.marks,
          text: node.text.slice(from - start, to - start),
        },
        start: from,
      });
      from = to;
    }
    return parts.length > 0 ? parts : [{ node, start }];
  });
  return { pieces, text };
};

/**
 * A paragraph's pieces as the email draws them, with each address written in
 * its text as a link, for Check to read their colors and weights.
 */
export const drawnPieces = (inline: Inline[] = []) =>
  linkWrittenAddresses(tagsAsText(inline)).pieces.map(({ node }) => node);

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
  const { pieces, text } = linkWrittenAddresses(tagsAsText(inline));
  const breaks = breakPoints(text);
  for (const { node, start } of pieces) {
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
      html += keepSpaces(withBreaks(node.text, start, breaks), afterSpace);
      afterSpace = node.text.endsWith(" ");
    }
  }
  closeFrom(0);
  return html;
};

/** Whether a paragraph's last line needs a <br /> to take up space. */
const endsWithoutText = (inline: RichTextParagraph["content"] = []) =>
  inline.at(-1)?.type === "hardBreak" || inline.length === 0;

/**
 * The styles core gives every Text and Heading, which always set these. The
 * line height is in pixels, which classic Outlook needs.
 */
export type TextCss = Record<string, string> & {
  color: string;
  "font-size": string;
  "line-height": string;
};

/** How far a List's items are indented, as a multiple of the font size. */
const LIST_INDENT = 1.5;

/** A List's indent in pixels, a margin as classic Outlook takes it. */
export const listIndent = (fontSize: string) =>
  Math.round(Number(fontSize.replace("px", "")) * LIST_INDENT);

const LIST_TAGS = { bulletList: "ul", orderedList: "ol" } as const;

/**
 * A Text Block's paragraphs and Lists. Each paragraph and item has the email's
 * font on its tag, as a heading does, because some clients, such as Libero,
 * give a paragraph a font of their own.
 */
export const richTextToHtml = (
  { content }: RichTextDocument,
  fontFamily: string,
  { "font-size": fontSize, "line-height": lineHeight }: TextCss,
  linkColor: string
) => {
  const textStyle = `${TEXT_STYLE};font-family:${escapeAttribute(fontFamily)};line-height:${lineHeight};mso-line-height-rule:exactly`;
  // A last empty line takes up space on the canvas, but a <br /> at the end of
  // a paragraph doesn't make one on its own. Nor does an empty paragraph.
  const lineHtml = (inline: RichTextParagraph["content"]) =>
    `${inlineToHtml(linkColor, inline)}${endsWithoutText(inline) ? "<br />" : ""}`;
  // The indent is a margin in pixels, which classic Outlook takes, where it
  // ignores a List's padding. A numbered List starts at 1, its default.
  const indent = listIndent(fontSize);
  return content
    .map((node) => {
      if (node.type === "paragraph") {
        return `<p style="${textStyle}">${lineHtml(node.content)}</p>`;
      }
      const tag = LIST_TAGS[node.type];
      const items = node.content
        .map(
          ({ content: [paragraph] }) =>
            `<li style="${textStyle}">${lineHtml(paragraph.content)}</li>`
        )
        .join("");
      return `<${tag} style="margin:0 0 0 ${indent}px;padding:0">${items}</${tag}>`;
    })
    .join("");
};

const hasText = ({ content }: RichTextDocument) =>
  content.some((paragraph) =>
    paragraph.content?.some(
      (node) =>
        node.type === "mergeTag" ||
        (node.type === "text" && node.text.trim() !== "")
    )
  );

/**
 * One heading, however many lines, or a screen reader would read it as several.
 * Its styles are on the tag as well, including what it would otherwise inherit,
 * because email clients give a heading their own. With no text it's only an empty
 * line, as a screen reader would announce an empty heading.
 */
export const headingToHtml = (
  { content, level }: BlockProps["heading"],
  fontFamily: string,
  { "line-height": lineHeight, ...blockCss }: TextCss,
  linkColor: string
) => {
  const lines = content.content
    .map((paragraph) => inlineToHtml(linkColor, paragraph.content))
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
