import * as v from "valibot";

import { blockDefinitions } from "./blocks.js";
import type { Block, BlocksDocument } from "./document.js";

/** A request to change an email. It can be rejected. */
export interface Command {
  type: "updateProps";
  blockId: string;
  props: Record<string, unknown>;
}

export type ApplyResult = { ok: true } | { ok: false; reason: string };

export interface Editor {
  apply: (command: Command) => ApplyResult;
  getDocument: () => BlocksDocument;
}

const commandSchema = v.strictObject({
  blockId: v.string(),
  props: v.record(v.string(), v.unknown()),
  type: v.literal("updateProps"),
});

const describeIssues = (issues: readonly v.BaseIssue<unknown>[]) =>
  issues
    .map((issue) => {
      const path = v.getDotPath(issue);
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");

const findBlock = (document: BlocksDocument, blockId: string) => {
  for (const row of document.rows) {
    for (const column of row.columns) {
      const block = column.blocks.find(({ id }) => id === blockId);
      if (block) {
        return block;
      }
    }
  }
};

const validateProps = (block: Block, props: Record<string, unknown>) => {
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

export const createEditor = ({
  document: initialDocument,
}: {
  document: BlocksDocument;
}): Editor => {
  let current = structuredClone(initialDocument);

  return {
    apply: (command) => {
      const parsed = v.safeParse(commandSchema, command);
      if (!parsed.success) {
        return {
          ok: false,
          reason: `Invalid Command: ${describeIssues(parsed.issues)}`,
        };
      }

      const { blockId, props } = parsed.output;
      const next = structuredClone(current);
      const block = findBlock(next, blockId);
      if (!block) {
        return { ok: false, reason: `No Block with ID "${blockId}"` };
      }

      const validated = validateProps(block, { ...block.props, ...props });
      if (!validated.valid) {
        return { ok: false, reason: validated.reason };
      }

      block.props = validated.props;
      current = next;
      return { ok: true };
    },
    getDocument: () => structuredClone(current),
  };
};
