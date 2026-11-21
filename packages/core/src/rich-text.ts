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
const MERGE_TAG_URL = new RegExp(
  `^${MERGE_TAG.source}[^:/?#]*(?:[/?#]|$)`,
  "u"
);

/**
 * An allowlist, because email has no use for any other scheme or a relative URL.
 * Being anchored at the start also refuses what browsers would clean up into
 * `javascript:`, such as a leading space or a tab inside the scheme.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const isAllowedLinkHref = (href: string) =>
  // oxlint-disable-next-line require-unicode-regexp -- With u, i would also take ſ as s.
  /^(?:https?:|mailto:|tel:)/i.test(href) || MERGE_TAG_URL.test(href);

/**
 * What a person is told when a link is refused, matching `isAllowedLinkHref`.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const INVALID_LINK =
  "Use a URL that starts with https:, http:, mailto: or tel:, such as https://example.com, or a Merge Tag such as {{cta_url}}.";

export const linkHrefSchema = v.pipe(
  v.string(),
  v.check(
    isAllowedLinkHref,
    "A link must start with http:, https:, mailto:, tel: or a Merge Tag"
  )
);

export const INVALID_IMAGE_URL =
  "Use a URL that starts with https: or http:, such as https://example.com/logo.png, or a Merge Tag such as {{logo_url}}.";

/** Its own allowlist, so that a scheme added for links doesn't reach images. */
export const imageSrcSchema = v.pipe(
  v.string(),
  v.check(
    // oxlint-disable-next-line require-unicode-regexp -- As for links.
    (src) => /^https?:/i.test(src) || MERGE_TAG_URL.test(src),
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

/**
 * Text is stored as limited ProseMirror JSON (ADR 0001), so it can be validated
 * like any other property without loading ProseMirror.
 */
export interface RichTextDocument {
  type: "doc";
  content: RichTextParagraph[];
}

// The types are written out above, so hosts see them rather than the library's.
export const richTextSchema = v.strictObject({
  content: v.pipe(v.array(paragraphSchema), v.nonEmpty()),
  type: v.literal("doc"),
}) satisfies v.GenericSchema<unknown, RichTextDocument>;
