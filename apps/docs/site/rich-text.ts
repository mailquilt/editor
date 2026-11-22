import type {
  RichTextHeadingDocument,
  RichTextMark,
  RichTextMergeTag,
  RichTextText,
} from "@mailquilt/core";
import { MERGE_TAG } from "@mailquilt/core/internal";

/**
 * Text as the editor saves it, with each `{{name}}` as a Merge Tag node and
 * the rest as text, all with the same marks.
 */
export const runs = (
  text: string,
  marks?: RichTextMark[]
): (RichTextText | RichTextMergeTag)[] =>
  text
    .split(new RegExp(`(${MERGE_TAG.source})`, "u"))
    .filter((part) => part !== "")
    .map((part) =>
      MERGE_TAG.test(part)
        ? {
            attrs: { name: part.slice(2, -2) },
            type: "mergeTag",
            ...(marks && { marks }),
          }
        : { text: part, type: "text", ...(marks && { marks }) }
    );

/** One paragraph of plain text, as a Text or Heading Block stores it. */
export const paragraph = (text: string): RichTextHeadingDocument => ({
  content: [{ content: runs(text), type: "paragraph" }],
  type: "doc",
});
