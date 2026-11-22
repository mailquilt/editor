import type { RichTextHeadingDocument } from "@mailquilt/core";

/** One paragraph of plain text, as a Text or Heading Block stores it. */
export const paragraph = (text: string): RichTextHeadingDocument => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});
