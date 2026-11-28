import type { RichTextDocument } from "@mailquilt/core";
import { Fragment } from "prosemirror-model";
import type { MarkType, Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState } from "prosemirror-state";

import { tagsToNodes } from "./merge-tags.js";
import { inertBody, pastedHtmlParser } from "./pasted-html.js";
import type { TextSchema } from "./text-schema.js";

/**
 * Pasted or dropped text with each tab as a space, and no bold for a Block that
 * can't have it. The canvas would show a tab at a tab stop, which no email
 * client can draw, and the export as one space.
 */
export const asPasted = (fragment: Fragment, bold?: MarkType): Fragment =>
  Fragment.from(
    fragment.content.map((node) => {
      if (!node.isLeaf) {
        return node.copy(asPasted(node.content, bold));
      }
      const marks = bold ? bold.removeFromSet(node.marks) : node.marks;
      const text = node.text ?? "";
      return node.isText && text.includes("\t")
        ? node.type.schema.text(text.replaceAll("\t", " "), marks)
        : node.mark(marks);
    })
  );

/** HTML read through the schema's parser, as ProseMirror reads a paste. */
const fromHtml = (schema: TextSchema, html: string) =>
  pastedHtmlParser(schema).parse(inertBody(html));

/** A paragraph for each line, as ProseMirror reads pasted plain text. */
const fromText = (schema: TextSchema, text: string) =>
  schema.node(
    "doc",
    null,
    text
      .split(/(?:\r\n?|\n)+/u)
      .map((line) =>
        schema.node("paragraph", null, line ? schema.text(line) : undefined)
      )
  );

/**
 * The text of a new Text Block, from text or HTML pasted outside any text,
 * read as a paste into a Block's text is: the HTML, if there is any, through
 * the text's schema, with each tab a space and each Merge Tag a node. Nothing
 * for text with nothing to show.
 */
export const pastedContent = (
  schema: TextSchema,
  { html, text }: { html: string; text: string }
): RichTextDocument | undefined => {
  const read: ProseMirrorNode = html
    ? fromHtml(schema, html)
    : fromText(schema, text);
  const state = EditorState.create({
    doc: read.copy(asPasted(read.content)),
  });
  const { doc } = tagsToNodes(state, schema, [
    { from: 0, to: state.doc.content.size },
  ]) ?? { doc: state.doc };
  return doc.textBetween(0, doc.content.size, " ").trim() === ""
    ? undefined
    : (doc.toJSON() as RichTextDocument);
};
