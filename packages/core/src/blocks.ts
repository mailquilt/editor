import * as v from "valibot";

import { richTextSchema } from "./rich-text.js";
import type { RichTextDocument } from "./rich-text.js";

interface TextBlockProps {
  content: RichTextDocument;
}

export const textBlock = {
  defaults: {
    content: { content: [{ type: "paragraph" }], type: "doc" },
  } satisfies TextBlockProps,
  schema: v.strictObject({ content: richTextSchema }),
};

export const blockDefinitions = new Map([["text", textBlock]]);
