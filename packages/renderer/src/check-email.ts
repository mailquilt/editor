import { loadDocument } from "@mailquilt/core";
import type {
  Block,
  EmailSettings,
  EmailStyle,
  RichTextParagraph,
  Row,
} from "@mailquilt/core";
import {
  blockStyles,
  hexColor,
  isHiddenOn,
  linkColor,
  menuLinks,
  MERGE_TAG,
  onPhone,
  videoLabel,
  videoShown,
} from "@mailquilt/core/internal";
import type { ColumnProps, RowProps } from "@mailquilt/core/internal";

import { renderEmail } from "./render-email.js";
import { drawnPieces } from "./text-to-html.js";
import type { RenderEmailOptions } from "./to-mjml.js";

/** What each Problem is, as a code a host can act on. */
export type ProblemCode =
  | "button-without-link"
  | "empty-preheader"
  | "html-too-large"
  | "image-without-alt"
  | "image-without-src"
  | "low-button-contrast"
  | "low-link-contrast"
  | "low-text-contrast"
  | "no-language"
  | "no-unsubscribe-link"
  | "unknown-merge-tag"
  | "vague-link-text"
  | "video-without-link";

/**
 * Something in an email that would go wrong for its readers. It never stops an
 * export. A Problem in a Block names its Row, Column and Block, and `field` is
 * the setting that fixes it.
 */
export interface Problem {
  code: ProblemCode;
  /** What's wrong and why it matters, in English, for developers. */
  message: string;
  rowId?: string;
  columnId?: string;
  blockId?: string;
  field?: string;
  /** For `unknown-merge-tag`, the tag's name, which goes between the braces. */
  mergeTag?: string;
  /** For the contrast codes, the first text found too hard to read. */
  contrast?: Contrast;
  /** For `vague-link-text`, what the link says. */
  linkText?: string;
}

/**
 * Text's contrast with what's behind it, each color as `#rrggbb` as it's
 * drawn, with a see-through one over what's behind it, and the ratio WCAG AA
 * asks of text its size.
 */
export interface Contrast {
  color: string;
  background: string;
  ratio: number;
  required: number;
}

/** What the Host app tells the check, and how the email is rendered. */
export interface CheckEmailOptions extends RenderEmailOptions {
  /**
   * The email's HTML, if it has been rendered already, which is measured
   * instead of rendering it again.
   */
  html?: string | undefined;
  /**
   * The Host app's Merge Tags, as given to the editor. With them, a tag not in
   * the list is a Problem. A tag with `unsubscribe` is the unsubscribe link, and
   * an email with no link to it is a Problem.
   */
  mergeTags?: readonly { name: string; unsubscribe?: boolean }[] | undefined;
}

type BlockProblem = Pick<
  Problem,
  "code" | "contrast" | "field" | "linkText" | "mergeTag" | "message"
>;

const MERGE_TAGS = new RegExp(MERGE_TAG.source, "gu");

type Inline = NonNullable<RichTextParagraph["content"]>[number];

/** A piece of a paragraph as it's exported, with a Merge Tag in its braces. */
const inlineText = (inline: Inline) => {
  switch (inline.type) {
    case "text": {
      return inline.text;
    }
    case "mergeTag": {
      return `{{${inline.attrs.name}}}`;
    }
    default: {
      return "\n";
    }
  }
};

const paragraphText = ({ content = [] }: RichTextParagraph) =>
  content.map(inlineText).join("");

const isParagraph = (value: object): value is RichTextParagraph =>
  "type" in value && value.type === "paragraph";

/**
 * Every text in a value, such as a Block's prop, and each paragraph's whole, so
 * a Merge Tag split across runs of text is read as one, as it's exported.
 */
const textsIn = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }
  const texts = Array.isArray(value) ? value : Object.values(value);
  return [
    ...(isParagraph(value) ? [paragraphText(value)] : []),
    ...texts.flatMap(textsIn),
  ];
};

/** Each link's URL in a value, such as a Block's prop. */
const linksIn = (value: unknown): string[] => {
  // A line break keeps a link open across it, but opens none of its own.
  if (
    typeof value !== "object" ||
    value === null ||
    ("type" in value && value.type === "hardBreak")
  ) {
    return [];
  }
  return Object.entries(value).flatMap(([key, inner]) =>
    (key === "href" || key === "url") && typeof inner === "string"
      ? [inner]
      : linksIn(inner)
  );
};

/**
 * The names of the Merge Tags in each text, once each, without the spaces
 * around them, as a sending service reads `{{ first_name }}` as `first_name`.
 */
const mergeTagsIn = (texts: readonly string[]) =>
  new Set(
    texts.flatMap((text) =>
      Array.from(text.matchAll(MERGE_TAGS), ([tag]) => tag.slice(2, -2).trim())
    )
  );

/** A Problem for each tag in each field that isn't in the Host app's list. */
const unknownMergeTags = (
  fields: Record<string, unknown>,
  known: ReadonlySet<string> | undefined
): BlockProblem[] =>
  known === undefined
    ? []
    : Object.entries(fields).flatMap(([field, value]) =>
        [...mergeTagsIn(textsIn(value))]
          .filter((name) => !known.has(name))
          .map((name) => ({
            code: "unknown-merge-tag" as const,
            field,
            mergeTag: name,
            message: `The Merge Tag {{${name}}} isn't one of the Host app's, so it may reach readers as it's written.`,
          }))
      );

/** A color's red, green, blue and alpha, each from 0 to 1. */
type Rgba = readonly [number, number, number, number];

/** A color the schema accepts, with its alpha, if it's `rgba()`. */
const parseColor = (color: string): Rgba => {
  const hex = hexColor(color) as string;
  const channel = (at: number) =>
    Number.parseInt(hex.slice(at, at + 2), 16) / 255;
  // An alpha over 1 is drawn as 1.
  const alpha = /^rgba/iu.test(color)
    ? Math.min(Number(color.slice(color.lastIndexOf(",") + 1, -1)), 1)
    : 1;
  return [channel(1), channel(3), channel(5), alpha];
};

/** `color` drawn over `behind`, or `behind` alone where there's no color. */
const over = (color: string | undefined, behind: Rgba): Rgba => {
  if (color === undefined) {
    return behind;
  }
  const [red, green, blue, alpha] = parseColor(color);
  // Each channel is the 8-bit value the screen draws, so the hex and the ratio
  // are of the same color.
  const mix = (channel: number, under: number) =>
    Math.round((channel * alpha + under * (1 - alpha)) * 255) / 255;
  return [mix(red, behind[0]), mix(green, behind[1]), mix(blue, behind[2]), 1];
};

const WHITE: Rgba = [1, 1, 1, 1];

const linear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** WCAG 2.2's relative luminance. */
const luminance = ([red, green, blue]: Rgba) =>
  0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);

const contrast = (first: Rgba, second: Rgba) => {
  const [light, dark] = [luminance(first), luminance(second)].toSorted(
    (a, b) => b - a
  ) as [number, number];
  return (light + 0.05) / (dark + 0.05);
};

const hexOf = (rgba: Rgba) =>
  `#${rgba
    .slice(0, 3)
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;

/**
 * Text's contrast, and what WCAG AA asks: 4.5:1, or 3:1 for large text, which
 * is 24px, or 18.67px (14pt) when bold.
 */
const contrastOf = (
  color: string,
  behind: Rgba,
  fontSize = "16px",
  bold = false
): Contrast => {
  const pixels = Number(fontSize.slice(0, -"px".length));
  const large = pixels >= 24 || (bold && pixels * 3 >= 56);
  const drawn = over(color, behind);
  return {
    background: hexOf(behind),
    color: hexOf(drawn),
    ratio: contrast(drawn, behind),
    required: large ? 3 : 4.5,
  };
};

const isReadable = ({ ratio, required }: Contrast) => ratio >= required;

/**
 * What's behind a Row's Blocks: the Row's own color, or else the Email style's
 * color behind the Rows, over the page around the email, over white, which
 * email clients show by default.
 */
const behindRow = (
  { props }: Row,
  { backgroundColor }: EmailSettings,
  style: EmailStyle
) => {
  const page = over(backgroundColor, WHITE);
  const rowColor =
    (props as RowProps).backgroundColor ?? style.emailBackgroundColor;
  return rowColor === undefined ? page : over(rowColor, page);
};

/** Each paragraph in a Block's text, in a List's items too. */
const paragraphsIn = (value: unknown): RichTextParagraph[] => {
  if (typeof value !== "object" || value === null) {
    return [];
  }
  return isParagraph(value)
    ? [value]
    : Object.values(value).flatMap(paragraphsIn);
};

/** How a piece of text the reader sees is drawn. */
interface Run {
  bold: boolean;
  link: boolean;
}

const marked = (inline: Inline, type: string) =>
  inline.marks?.some((mark) => mark.type === type) ?? false;

/**
 * Each piece of a paragraph's text that the reader sees, as the renderer draws
 * it, with an address written in the text as a link.
 */
const visibleRuns = ({ content }: RichTextParagraph): Run[] =>
  drawnPieces(content)
    .filter((piece) => piece.type === "text" && piece.text.trim() !== "")
    .map((piece) => ({
      bold: marked(piece, "bold"),
      link: marked(piece, "link"),
    }));

const LINK_CONTRAST_MESSAGE =
  "Links have too little contrast with what's behind them for everyone to read them. They need 4.5:1, or 3:1 for large text.";

const lowContrast = (
  block: Block,
  behind: Rgba,
  style: EmailStyle
): BlockProblem[] => {
  const css = blockStyles(block, style);
  switch (block.type) {
    case "text":
    case "heading": {
      // A Block with only spaces in it has none, so nothing to read.
      const runs = paragraphsIn(block.props.content).flatMap(visibleRuns);
      const color = css.color as string;
      const links = linkColor(block.props, style, color);
      // Links in the text's own color are checked as text.
      const sameColor = links === color;
      /** The first of `inRuns` too hard to read in `runColor`. */
      const unreadable = (runColor: string, inRuns: Run[]) =>
        inRuns
          .map(({ bold }) =>
            contrastOf(
              runColor,
              behind,
              css["font-size"],
              bold || css["font-weight"] === "700"
            )
          )
          .find((found) => !isReadable(found));
      const textFails = unreadable(
        color,
        runs.filter((run) => sameColor || !run.link)
      );
      const linksFail = sameColor
        ? undefined
        : unreadable(
            links,
            runs.filter((run) => run.link)
          );
      return [
        ...(textFails
          ? [
              {
                code: "low-text-contrast" as const,
                contrast: textFails,
                field: "color",
                message:
                  "Text has too little contrast with what's behind it for everyone to read it. It needs 4.5:1, or 3:1 for large text.",
              },
            ]
          : []),
        ...(linksFail
          ? [
              {
                code: "low-link-contrast" as const,
                contrast: linksFail,
                field: "color",
                message: LINK_CONTRAST_MESSAGE,
              },
            ]
          : []),
      ];
    }
    case "menu":
    case "video": {
      // Only the links the email shows, which are all links: a Menu's, and a
      // Video's line.
      if (
        block.type === "menu"
          ? menuLinks(block.props).shown.length === 0
          : !videoShown(block.props)?.line
      ) {
        return [];
      }
      const links = contrastOf(css.color as string, behind, css["font-size"]);
      return isReadable(links)
        ? []
        : [
            {
              code: "low-link-contrast",
              contrast: links,
              field: "color",
              message: LINK_CONTRAST_MESSAGE,
            },
          ];
    }
    case "button": {
      const label = contrastOf(
        css.color as string,
        parseColor(css["background-color"] as string),
        css["font-size"]
      );
      return isReadable(label)
        ? []
        : [
            {
              code: "low-button-contrast",
              contrast: label,
              field: "color",
              message:
                "A Button's label has too little contrast with the Button's color for everyone to read it. It needs 4.5:1, or 3:1 for large text.",
            },
          ];
    }
    default: {
      return [];
    }
  }
};

/** Link text that says nothing of where it goes, in English. */
const VAGUE_LINK_TEXT = new Set([
  "click here",
  "here",
  "learn more",
  "link",
  "read more",
  "this link",
]);

const isVague = (text: string) =>
  VAGUE_LINK_TEXT.has(
    text
      .toLowerCase()
      .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  );

const hrefOf = (inline: Inline) =>
  inline.marks?.find((mark) => mark.type === "link")?.attrs.href;

/** The URL of each address a Text Block or Heading writes, as the renderer links it. */
const writtenLinksIn = (block: Block) =>
  block.type === "text" || block.type === "heading"
    ? paragraphsIn(block.props.content).flatMap(({ content }) =>
        // A line break keeps a link open across it, but opens none of its own.
        drawnPieces(content).flatMap((piece) =>
          piece.type === "text" ? (hrefOf(piece) ?? []) : []
        )
      )
    : [];

/** The text of each link in a paragraph, a run of text with the same URL. */
const linkTexts = ({ content = [] }: RichTextParagraph) => {
  const texts: string[] = [];
  let previous: string | undefined;
  for (const inline of content) {
    const href = hrefOf(inline);
    const text = inlineText(inline);
    if (href !== undefined && href === previous) {
      texts[texts.length - 1] += text;
    } else if (href !== undefined) {
      texts.push(text);
    }
    previous = href;
  }
  return texts;
};

/** Each link's text in a Block, in the field that holds it. */
const linkTextsOf = (block: Block): [field: string, texts: string[]] => {
  switch (block.type) {
    case "button": {
      return ["label", [block.props.label]];
    }
    case "text":
    case "heading": {
      return ["content", paragraphsIn(block.props.content).flatMap(linkTexts)];
    }
    case "menu": {
      return ["links", menuLinks(block.props).shown.map(({ label }) => label)];
    }
    case "video": {
      return videoShown(block.props)?.line
        ? ["label", [videoLabel(block.props)]]
        : ["", []];
    }
    default: {
      return ["", []];
    }
  }
};

const vagueLinks = (block: Block): BlockProblem[] => {
  const [field, texts] = linkTextsOf(block);
  const vague = texts.find(isVague);
  return vague === undefined
    ? []
    : [
        {
          code: "vague-link-text",
          field,
          linkText: vague.trim(),
          message:
            "A link says only something like “click here”, which doesn't say where it goes to someone who hears or scans the email's links on their own.",
        },
      ];
};

/**
 * A Block's props that are in the email: a Menu's links with a label and a
 * URL, and a Video's link, alt text, the picture it shows and its line's
 * words while it shows one, or nothing for a Video the email leaves out.
 */
const shownProps = (block: Block): Record<string, unknown> => {
  if (block.type === "menu") {
    return { ...block.props, links: menuLinks(block.props).shown };
  }
  if (block.type !== "video") {
    return block.props;
  }
  const shown = videoShown(block.props);
  if (!shown) {
    return {};
  }
  const { alt, playThumbnail, thumbnail } = block.props;
  return {
    alt,
    url: shown.url,
    ...(shown.picture === thumbnail ? { thumbnail } : { playThumbnail }),
    ...(shown.line ? { label: videoLabel(block.props) } : {}),
  };
};

/**
 * What's too hard to read, at desktop sizes and then on phones, where a Phone
 * font size can be smaller. Each code once, as the desktop's if both have it.
 */
const contrastProblems = (
  block: Block,
  behind: Rgba,
  style: EmailStyle
): BlockProblem[] => {
  const desktop = isHiddenOn(block, "desktop")
    ? []
    : lowContrast(block, behind, style);
  const phone = isHiddenOn(block, "phone")
    ? []
    : lowContrast(onPhone(block), behind, style);
  return [
    ...desktop,
    ...phone.filter(
      ({ code }) => !desktop.some((found) => found.code === code)
    ),
  ];
};

const blockProblems = (
  block: Block,
  knownTags: ReadonlySet<string> | undefined,
  behind: Rgba,
  style: EmailStyle
): BlockProblem[] => {
  const problems: BlockProblem[] = [];
  switch (block.type) {
    case "image": {
      const { alt = "", decorative, src } = block.props;
      // Without an image, it's left out, so its alt text doesn't matter yet.
      // A decorative one is skipped by screen readers, so it needs none.
      if (src === undefined) {
        problems.push({
          code: "image-without-src",
          field: "src",
          message: "An Image has no image, so it's left out of the email.",
        });
      } else if (!decorative && alt.trim() === "") {
        problems.push({
          code: "image-without-alt",
          field: "alt",
          message:
            "An Image has no alt text, so readers who can't see it, or whose email client blocks images, don't know what it shows.",
        });
      }
      break;
    }
    case "video": {
      const { alt = "", thumbnail, url } = block.props;
      // Left out until it has both, so its alt text doesn't matter yet.
      if (url === undefined) {
        problems.push({
          code: "video-without-link",
          field: "url",
          message: "A Video has no link, so it's left out of the email.",
        });
      } else if (thumbnail === undefined) {
        problems.push({
          code: "image-without-src",
          field: "thumbnail",
          message: "A Video has no thumbnail, so it's left out of the email.",
        });
      } else if (alt.trim() === "") {
        problems.push({
          code: "image-without-alt",
          field: "alt",
          message:
            "A Video's thumbnail has no alt text, so readers who can't see it, or whose email client blocks images, don't know what the link is.",
        });
      }
      break;
    }
    case "button": {
      if (block.props.href === undefined) {
        problems.push({
          code: "button-without-link",
          field: "href",
          message: "A Button has no link, so pressing it does nothing.",
        });
      }
      break;
    }
    default:
  }
  problems.push(
    ...contrastProblems(block, behind, style),
    ...vagueLinks(block),
    // A Menu's link without a label or a URL isn't in the email, nor what a
    // Video doesn't show.
    ...unknownMergeTags(shownProps(block), knownTags)
  );
  return problems;
};

const settingsProblems = (
  { language, preheader = "" }: EmailSettings,
  knownTags: ReadonlySet<string> | undefined
) => {
  const problems: Problem[] = [];
  if (preheader.trim() === "") {
    problems.push({
      code: "empty-preheader",
      field: "preheader",
      message:
        "The email has no preheader, so inboxes show its first words after the subject instead.",
    });
  }
  if (language === undefined || language.trim() === "") {
    problems.push({
      code: "no-language",
      field: "language",
      message:
        "The email has no language, so screen readers may read it in the wrong voice.",
    });
  }
  problems.push(...unknownMergeTags({ language, preheader }, knownTags));
  return problems;
};

/** Gmail shows only the start of an email whose HTML is larger, in bytes. */
const GMAIL_CLIP_BYTES = 102 * 1024;

/** The size of `text` in UTF-8, as it's sent. */
const utf8Bytes = (text: string) => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) as number;
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x8_00) {
      bytes += 2;
    } else if (code < 0x1_00_00) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
};

/**
 * Lists an email's Problems: first the email's settings, then each Block in
 * order, then the email as a whole. `document` is checked as `renderEmail`
 * checks it, and the promise rejects with the reason if it isn't an email Mail
 * Quilt accepts. It renders the email to measure its HTML, unless `html` is given.
 */
export const checkEmail = async (
  document: unknown,
  { html, mergeTags, ...renderOptions }: CheckEmailOptions = {}
) => {
  const loaded = loadDocument(document);
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  const { rows, settings } = loaded.document;
  const style = settings.style ?? {};
  const knownTags = mergeTags
    ? new Set(mergeTags.map(({ name }) => name))
    : undefined;
  const problems = settingsProblems(settings, knownTags);
  const links: string[] = [];
  for (const row of rows) {
    const behindColumns = behindRow(row, settings, style);
    for (const column of row.columns) {
      const behindBlocks = over(
        (column.props as ColumnProps).backgroundColor,
        behindColumns
      );
      for (const block of column.blocks) {
        // A Block's own Box background, over its Column's.
        const behind = over(
          (block.props as { boxBackgroundColor?: string }).boxBackgroundColor,
          behindBlocks
        );
        // An Image with no image is left out, with its link, as is a Menu's
        // link without a label and a Video without a thumbnail.
        if (block.type === "menu") {
          links.push(...linksIn(menuLinks(block.props).shown));
        } else if (block.type === "video") {
          links.push(...linksIn({ url: videoShown(block.props)?.url }));
        } else if (block.type !== "image" || block.props.src !== undefined) {
          links.push(...linksIn(block.props), ...writtenLinksIn(block));
        }
        for (const problem of blockProblems(block, knownTags, behind, style)) {
          problems.push({
            ...problem,
            blockId: block.id,
            columnId: column.id,
            rowId: row.id,
          });
        }
      }
    }
  }
  if (
    utf8Bytes(html ?? (await renderEmail(document, renderOptions))) >
    GMAIL_CLIP_BYTES
  ) {
    problems.push({
      code: "html-too-large",
      message:
        "The email's HTML is over 102 KB, so Gmail cuts it off and hides the rest behind a link.",
    });
  }
  const unsubscribe = mergeTags
    ?.filter((tag) => tag.unsubscribe)
    .map(({ name }) => name);
  const linkedTags = mergeTagsIn(links);
  if (
    unsubscribe !== undefined &&
    unsubscribe.length > 0 &&
    !unsubscribe.some((name) => linkedTags.has(name))
  ) {
    problems.push({
      code: "no-unsubscribe-link",
      message: `The email has no link to the unsubscribe Merge Tag, {{${unsubscribe[0]}}}, which the law and sending services ask for.`,
    });
  }
  return problems;
};
