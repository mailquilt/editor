// The exported HTML laid out to read in Check's HTML tab: a tag to a line,
// indented, a long tag broken between its attributes, a CSS rule to a line,
// and its tag names and attribute values marked to be colored. The export
// itself is one line, which is what Copy HTML copies.

/** A part of a line: a tag's name, an attribute's value, a comment, or the rest. */
export interface HtmlPart {
  kind: "comment" | "name" | "text" | "value";
  text: string;
}

/** Past this, a tag goes on after an attribute on a line of its own. */
const LINE_LENGTH = 80;

/** How much further a tag's next line is indented than the tag. */
const GOES_ON = "    ";

/** Elements that have no closing tag, so nothing inside them is indented. */
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/** A comment, Outlook's with tags in it too, a tag, or the text between. */
const PIECE = /<!--[\s\S]*?-->|<[^>]*>|[^<]+/gu;

/** A tag's start, `<` or `</` and its name, then the rest. */
const TAG = /^(?<start><\/?)(?<name>[^\s/>]+)(?<rest>[\s\S]*)$/u;

/** An attribute's name, and its value, if it has one. */
const ATTRIBUTE =
  /(?<attribute>\s+[^\s=/>]+)(?:(?<equals>\s*=\s*)(?<value>"[^"]*"|'[^']*'|[^\s>]+))?/gu;

/** An Outlook comment, whose tags are each put on a line. */
const OUTLOOK_COMMENT =
  /^(?<open><!--\[if [^\]]*\]>)(?<tags>[\s\S]*)(?<close><!\[endif\]-->)$/u;

/**
 * An at-rule with no block, such as an `@import`, an at-rule's opening, a rule
 * with its declarations, or an at-rule's end.
 */
const CSS_PIECE = /@[^{};]+;|@[^{}]+\{|[^{}]+\{[^{}]*\}|\}/gu;

type Line = HtmlPart[];

const textPart = (text: string): HtmlPart => ({ kind: "text", text });

const lengthOf = (parts: Line) =>
  parts.reduce((length, { text }) => length + text.length, 0);

/** A tag's start and name, each attribute with the space before it, and its end. */
const tagParts = (tag: string) => {
  const { name = "", rest = "", start = "" } = TAG.exec(tag)?.groups ?? {};
  const attributes: Line[] = [];
  let end = 0;
  for (const { 0: match, groups = {}, index } of rest.matchAll(ATTRIBUTE)) {
    const { attribute = "", equals, value } = groups;
    attributes.push(
      equals === undefined || value === undefined
        ? [textPart(rest.slice(end, index) + attribute)]
        : [
            textPart(rest.slice(end, index) + attribute),
            textPart(equals),
            { kind: "value", text: value },
          ]
    );
    end = index + match.length;
  }
  return {
    attributes,
    head: [textPart(start), { kind: "name", text: name }] as Line,
    tail: [textPart(rest.slice(end))],
  };
};

/**
 * A tag at `indent`, with what follows it on its line, such as its text and
 * closing tag. One too long goes on after an attribute, indented further.
 */
const tagLines = (indent: string, tag: string, after: Line = []) => {
  const { attributes, head, tail } = tagParts(tag);
  const lines: Line[] = [[textPart(indent), ...head]];
  for (const attribute of attributes) {
    const line = lines.at(-1) as Line;
    const [first, ...rest] = attribute as [HtmlPart, ...HtmlPart[]];
    // Never before a tag's first attribute, so its name has one beside it.
    const besideName = line === lines[0] && line.length <= head.length + 1;
    if (!besideName && lengthOf(line) + lengthOf(attribute) > LINE_LENGTH) {
      lines.push([
        textPart(indent + GOES_ON + first.text.trimStart()),
        ...rest,
      ]);
      continue;
    }
    line.push(...attribute);
  }
  lines.at(-1)?.push(...tail, ...after);
  return lines;
};

const nameOf = (tag: string) => TAG.exec(tag)?.groups?.name?.toLowerCase();

/** Whether a tag opens an element that later closes, so what follows is inside it. */
const opens = (tag: string) => {
  const name = nameOf(tag);
  return (
    name !== undefined &&
    !tag.startsWith("</") &&
    !tag.startsWith("<!") &&
    !tag.endsWith("/>") &&
    !VOID.has(name)
  );
};

/** A comment, with each tag of an Outlook one on a line, indented further. */
const commentLines = (indent: string, comment: string): Line[] => {
  const { close, open, tags } = OUTLOOK_COMMENT.exec(comment)?.groups ?? {};
  if (open === undefined || close === undefined || tags === undefined) {
    return [[textPart(indent), { kind: "comment", text: comment }]];
  }
  return [
    [textPart(indent), { kind: "comment", text: open }],
    ...(tags.match(PIECE) ?? []).map((tag): Line => [
      textPart(`${indent}  `),
      { kind: "comment", text: tag },
    ]),
    [textPart(indent), { kind: "comment", text: close }],
  ];
};

/** A style's CSS, a rule to a line, with an at-rule's rules indented inside it. */
const cssLines = (indent: string, css: string): Line[] => {
  let depth = 1;
  return (css.match(CSS_PIECE) ?? []).map((piece) => {
    const rule = piece.replaceAll(/\s+/gu, " ").trim();
    if (rule === "}") {
      depth -= 1;
    }
    const line = [textPart(indent + "  ".repeat(depth) + rule)];
    if (rule.startsWith("@") && rule.endsWith("{")) {
      depth += 1;
    }
    return line;
  });
};

/** The lines, each a list of its parts, starting with its indent. */
export const htmlLines = (html: string) => {
  const pieces = (html.match(PIECE) ?? []).filter(
    (piece) => piece.trim() !== ""
  );
  const lines: Line[] = [];
  let depth = 0;
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index] as string;
    if (piece.startsWith("</")) {
      depth = Math.max(0, depth - 1);
    }
    const indent = "  ".repeat(depth);
    const [next = "", afterNext = ""] = [pieces[index + 1], pieces[index + 2]];
    const closes = (tag: string) =>
      tag.startsWith("</") && nameOf(tag) === nameOf(piece);
    const textNext = next !== "" && !next.startsWith("<");
    if (piece.startsWith("<!--")) {
      lines.push(...commentLines(indent, piece));
    } else if (!piece.startsWith("<")) {
      lines.push([textPart(indent + piece)]);
    } else if (opens(piece) && closes(next)) {
      // An empty element, such as an email's title, on one line.
      const closing = tagParts(next);
      lines.push(
        ...tagLines(indent, piece, [...closing.head, ...closing.tail])
      );
      index += 1;
    } else if (opens(piece) && nameOf(piece) === "style" && textNext) {
      lines.push(...tagLines(indent, piece), ...cssLines(indent, next));
      index += 1;
      depth += 1;
    } else if (opens(piece) && textNext && closes(afterNext)) {
      // A text and its closing tag, such as a title's, on the opening tag's line.
      const closing = tagParts(afterNext);
      lines.push(
        ...tagLines(indent, piece, [
          textPart(next),
          ...closing.head,
          ...closing.tail,
        ])
      );
      index += 2;
    } else {
      lines.push(...tagLines(indent, piece));
      if (opens(piece)) {
        depth += 1;
      }
    }
  }
  return lines.map((parts) => parts.filter(({ text }) => text !== ""));
};
