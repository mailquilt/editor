import * as v from "valibot";

/**
 * Text is stored as limited Tiptap JSON (ADR 0001), so it can be validated like
 * any other property without loading Tiptap.
 */
export interface RichTextNode {
  type: "text";
  text: string;
}

export interface RichTextParagraph {
  type: "paragraph";
  content?: RichTextNode[];
}

export interface RichTextDocument {
  type: "doc";
  content: RichTextParagraph[];
}

const textSchema = v.strictObject({
  text: v.pipe(v.string(), v.nonEmpty()),
  type: v.literal("text"),
});

const paragraphSchema = v.strictObject({
  content: v.optional(v.array(textSchema)),
  type: v.literal("paragraph"),
});

export const richTextSchema = v.strictObject({
  content: v.pipe(v.array(paragraphSchema), v.nonEmpty()),
  type: v.literal("doc"),
});
