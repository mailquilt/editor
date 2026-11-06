import * as v from "valibot";

/**
 * Text is stored as limited Tiptap JSON (ADR 0001), so it can be validated like
 * any other property without loading Tiptap.
 */
export type RichTextMark =
  | { type: "bold" | "italic" | "underline" }
  | { type: "link"; attrs: { href: string } };

export interface RichTextNode {
  type: "text";
  text: string;
  marks?: RichTextMark[];
}

export interface RichTextHardBreak {
  type: "hardBreak";
  /** ProseMirror keeps these on a line break inside formatted text. */
  marks?: RichTextMark[];
}

export interface RichTextParagraph {
  type: "paragraph";
  content?: (RichTextHardBreak | RichTextNode)[];
}

export interface RichTextDocument {
  type: "doc";
  content: RichTextParagraph[];
}

/**
 * An allowlist, because email has no use for any other scheme or a relative URL.
 * Being anchored at the start also refuses what browsers would clean up into
 * `javascript:`, such as a leading space or a tab inside the scheme.
 *
 * A Merge Tag must come first and be complete. Whatever follows it can't have a
 * colon before the path, query or fragment, because the tag's value could be
 * empty or finish a scheme, as in `{{x}}javascript:alert(1)`.
 */
const ALLOWED_LINK_HREF =
  /^(?:https?:|mailto:|tel:|\{\{[^{}]+\}\}[^:/?#]*(?:[/?#]|$))/iu;

export const isAllowedLinkHref = (href: string) => ALLOWED_LINK_HREF.test(href);

const marksSchema = v.pipe(
  v.array(
    v.variant("type", [
      v.strictObject({ type: v.literal("bold") }),
      v.strictObject({ type: v.literal("italic") }),
      v.strictObject({ type: v.literal("underline") }),
      v.strictObject({
        attrs: v.strictObject({
          href: v.pipe(
            v.string(),
            v.check(
              isAllowedLinkHref,
              "A link must start with http:, https:, mailto:, tel: or a Merge Tag"
            )
          ),
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
    marks: v.optional(marksSchema),
    type: v.literal("hardBreak"),
  }),
]);

const paragraphSchema = v.strictObject({
  content: v.optional(v.array(inlineSchema)),
  type: v.literal("paragraph"),
});

export const richTextSchema = v.strictObject({
  content: v.pipe(v.array(paragraphSchema), v.nonEmpty()),
  type: v.literal("doc"),
});
