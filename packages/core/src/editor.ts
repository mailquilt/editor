import { planCommand } from "./commands.js";
import type { Command } from "./commands.js";
import type { BlocksDocument } from "./document.js";
import { loadDocument } from "./load-document.js";
import { applyOperation, reverseOperation } from "./operations.js";
import type { Operation } from "./operations.js";

export type ApplyResult =
  | {
      ok: true;
      /** The ID of what the Command added, if it added a Block or Row. */
      createdId?: string;
    }
  | {
      ok: false;
      reason: string;
      /** The Block is already where the Command asks, so nothing went wrong. */
      unchanged?: true;
    };

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
      const plan = planCommand(current, command);
      if (!plan.ok) {
        return plan;
      }

      const { createdId, operations } = plan;
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
      return createdId === undefined ? { ok: true } : { createdId, ok: true };
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
