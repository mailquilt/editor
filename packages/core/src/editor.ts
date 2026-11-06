import * as v from "valibot";

import { describeIssues, validateProps } from "./blocks.js";
import type { BlocksDocument } from "./document.js";
import { loadDocument } from "./load-document.js";
import { applyOperation, findBlock, reverseOperation } from "./operations.js";
import type { Operation } from "./operations.js";

/** A request to change an email. It can be rejected. */
export interface Command {
  type: "updateProps";
  blockId: string;
  props: Record<string, unknown>;
}

export type ApplyResult = { ok: true } | { ok: false; reason: string };

export interface ApplyOptions {
  /**
   * Joins this Command to the undo step made by the Command just before it, if
   * that one had the same key. Undo and redo end a step, so it can't be joined.
   */
  mergeKey?: string;
}

export interface Editor {
  apply: (command: Command, options?: ApplyOptions) => ApplyResult;
  /** Returns false when there is nothing to undo. */
  undo: () => boolean;
  /** Returns false when there is nothing to redo. */
  redo: () => boolean;
  getDocument: () => BlocksDocument;
  /**
   * Calls `listener` with the Operations of each change, including undo and
   * redo. Returns a function that ends the subscription.
   */
  subscribe: (listener: (operations: Operation[]) => void) => () => void;
}

const commandSchema = v.strictObject({
  blockId: v.string(),
  props: v.record(v.string(), v.unknown()),
  type: v.literal("updateProps"),
});

export const createEditor = ({
  document: initialDocument,
}: {
  document: BlocksDocument;
}): Editor => {
  const loaded = loadDocument(initialDocument);
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  let current = loaded.document;
  const undoStack: Operation[][] = [];
  const redoStack: Operation[][] = [];
  let openMergeKey: string | undefined;
  const listeners = new Set<(operations: Operation[]) => void>();

  const changeDocument = (operations: Operation[]) => {
    const next = structuredClone(current);
    for (const operation of operations) {
      applyOperation(next, operation);
    }
    current = next;
  };

  /** Runs last, so listeners can't interrupt a change or see it half done. */
  const notify = (operations: Operation[]) => {
    for (const listener of listeners) {
      listener(structuredClone(operations));
    }
  };

  return {
    apply: (command, options) => {
      const parsed = v.safeParse(commandSchema, command);
      if (!parsed.success) {
        return {
          ok: false,
          reason: `Invalid Command: ${describeIssues(parsed.issues)}`,
        };
      }

      const { blockId, props } = parsed.output;
      const block = findBlock(current, blockId);
      if (!block) {
        return { ok: false, reason: `No Block with ID "${blockId}"` };
      }

      const validated = validateProps(block, { ...block.props, ...props });
      if (!validated.valid) {
        return { ok: false, reason: validated.reason };
      }

      const operations: Operation[] = [
        {
          blockId,
          previousProps: block.props,
          props: validated.props,
          type: "setProps",
        },
      ];
      changeDocument(operations);
      const mergeKey = options?.mergeKey;
      const openStep = undoStack.at(-1);
      if (openStep && mergeKey !== undefined && mergeKey === openMergeKey) {
        openStep.push(...operations);
      } else {
        undoStack.push(operations);
      }
      openMergeKey = mergeKey;
      redoStack.length = 0;
      notify(operations);
      return { ok: true };
    },
    getDocument: () => structuredClone(current),
    redo: () => {
      const step = redoStack.pop();
      if (!step) {
        return false;
      }
      changeDocument(step);
      undoStack.push(step);
      openMergeKey = undefined;
      notify(step);
      return true;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    undo: () => {
      const step = undoStack.pop();
      if (!step) {
        return false;
      }
      const reversed = step.map(reverseOperation).toReversed();
      changeDocument(reversed);
      redoStack.push(step);
      openMergeKey = undefined;
      notify(reversed);
      return true;
    },
  };
};
