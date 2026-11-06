import * as v from "valibot";

import type { Block } from "./document.js";
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

export const describeIssues = (issues: readonly v.BaseIssue<unknown>[]) =>
  issues
    .map((issue) => {
      const path = v.getDotPath(issue);
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");

export const validateProps = (
  block: Pick<Block, "id" | "type">,
  props: unknown
) => {
  const definition = blockDefinitions.get(block.type);
  if (!definition) {
    return {
      reason: `Block "${block.id}" has unknown type "${block.type}"`,
      valid: false as const,
    };
  }
  const result = v.safeParse(definition.schema, props);
  return result.success
    ? { props: result.output, valid: true as const }
    : {
        reason: `Invalid props for Block "${block.id}": ${describeIssues(result.issues)}`,
        valid: false as const,
      };
};
