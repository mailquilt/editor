import * as v from "valibot";

/**
 * A Merge Tag, such as `{{first_name}}`.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const MERGE_TAG = /\{\{[^{}]+\}\}/u;

/**
 * A Merge Tag must come first and be complete. Whatever follows it can't have a
 * colon before the path, query or fragment, because the tag's value could be
 * empty or finish a scheme, as in `{{x}}javascript:alert(1)`.
 */
const MERGE_TAG_URL = String.raw`${MERGE_TAG.source}[^:/?#]*(?:[/?#]|$)`;

/**
 * Schemes in either case, spelled out rather than with the i flag, which with
 * u would also take ſ as s, and which the JSON Schema's patterns can't have.
 */
const HTTP = "[Hh][Tt][Tt][Pp][Ss]?:";

/**
 * An allowlist, because email has no use for any other scheme or a relative URL.
 * Being anchored at the start also refuses what browsers would clean up into
 * `javascript:`, such as a leading space or a tab inside the scheme.
 */
const LINK_HREF = new RegExp(
  `^(?:${HTTP}|[Mm][Aa][Ii][Ll][Tt][Oo]:|[Tt][Ee][Ll]:|${MERGE_TAG_URL})`,
  "u"
);

/** For Mail Quilt's own packages: not documented, and not yet a promise to hosts. */
export const isAllowedLinkHref = (href: string) => LINK_HREF.test(href);

export const linkHrefSchema = v.pipe(
  v.string(),
  v.regex(
    LINK_HREF,
    "A link must start with http:, https:, mailto:, tel: or a Merge Tag"
  )
);

/** Its own allowlist, so that a scheme added for links doesn't reach images. */
export const imageSrcSchema = v.pipe(
  v.string(),
  v.regex(
    new RegExp(`^(?:${HTTP}|${MERGE_TAG_URL})`, "u"),
    "An image URL must start with http:, https: or a Merge Tag"
  )
);

const marksSchema = v.pipe(
  v.array(
    v.variant("type", [
      v.strictObject({ type: v.literal("bold") }),
      v.strictObject({ type: v.literal("italic") }),
      v.strictObject({ type: v.literal("underline") }),
      v.strictObject({
        attrs: v.strictObject({
          href: linkHrefSchema,
        }),
        type: v.literal("link"),
      }),
    ])
  ),
  v.check(
    (marks) => new Set(marks.map(({ type }) => type)).size === marks.length,
    "Text can't have the same mark twice"
  )
);

const inlineSchema = v.variant("type", [
  v.strictObject({
    marks: v.optional(marksSchema),
    text: v.pipe(v.string(), v.nonEmpty()),
    type: v.literal("text"),
  }),
  v.strictObject({
    /** ProseMirror keeps these on a line break inside formatted text. */
    marks: v.optional(marksSchema),
    type: v.literal("hardBreak"),
  }),
  v.strictObject({
    attrs: v.strictObject({
      // As typed, so a sending tool's own syntax survives (ADR 0017).
      name: v.pipe(
        v.string(),
        v.regex(
          /^[^{}]+$/u,
          "A Merge Tag's name can't be empty or hold a brace"
        )
      ),
    }),
    marks: v.optional(marksSchema),
    type: v.literal("mergeTag"),
  }),
]);

const paragraphSchema = v.strictObject({
  content: v.optional(v.array(inlineSchema)),
  type: v.literal("paragraph"),
});

/** One level deep, with one paragraph in each item. */
const listSchema = v.strictObject({
  content: v.pipe(
    v.array(
      v.strictObject({
        content: v.strictTuple(
          [paragraphSchema],
          "A List's item holds exactly one paragraph"
        ),
        type: v.literal("listItem"),
      })
    ),
    v.nonEmpty()
  ),
  type: v.picklist(["bulletList", "orderedList"]),
});

export type RichTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "link"; attrs: { href: string } };

export interface RichTextText {
  type: "text";
  text: string;
  marks?: RichTextMark[];
}

export interface RichTextHardBreak {
  type: "hardBreak";
  marks?: RichTextMark[];
}

/**
 * A Merge Tag in text, one unit (ADR 0017). Its name is what goes between the
 * braces, exactly as written, and the export writes it as `{{name}}`.
 */
export interface RichTextMergeTag {
  type: "mergeTag";
  attrs: { name: string };
  marks?: RichTextMark[];
}

export interface RichTextParagraph {
  type: "paragraph";
  content?: (RichTextText | RichTextHardBreak | RichTextMergeTag)[];
}

/** An item of a List, which holds exactly one paragraph. */
export interface RichTextListItem {
  type: "listItem";
  content: [RichTextParagraph];
}

/**
 * A bulleted or numbered List in a Text Block, one level deep. A numbered List
 * starts at 1.
 */
export interface RichTextList {
  type: "bulletList" | "orderedList";
  content: RichTextListItem[];
}

/**
 * Text is stored as limited ProseMirror JSON (ADR 0001), so it can be validated
 * like any other property without loading ProseMirror. A Heading's holds only
 * paragraphs.
 */
export interface RichTextDocument {
  type: "doc";
  content: (RichTextParagraph | RichTextList)[];
}

/** A Heading's text, which holds paragraphs only. */
export interface RichTextHeadingDocument {
  type: "doc";
  content: RichTextParagraph[];
}

// Typed as the types written out above, so hosts see them rather than the
// library's, which are also too deep for TypeScript to compare.
export const richTextSchema: v.GenericSchema<unknown, RichTextDocument> =
  v.strictObject({
    content: v.pipe(
      v.array(v.variant("type", [paragraphSchema, listSchema])),
      v.nonEmpty()
    ),
    type: v.literal("doc"),
  });

export const headingTextSchema: v.GenericSchema<
  unknown,
  RichTextHeadingDocument
> = v.strictObject({
  content: v.pipe(v.array(paragraphSchema), v.nonEmpty()),
  type: v.literal("doc"),
});
