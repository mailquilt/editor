import { planCommand } from "./commands.js";
import type { Command } from "./commands.js";
import type { BlocksDocument } from "./document.js";
import { isSameDocument, loadDocument } from "./load-document.js";
import { applyOperation, reverseOperation } from "./operations.js";
import type { Operation, PropsTarget } from "./operations.js";

export type ApplyResult =
  | {
      ok: true;
      /** The ID of what the Command added, if it added a Block or Row. */
      createdId?: string;
    }
  | {
      ok: false;
      reason: string;
      /** Things are already as the Command asks, so nothing went wrong. */
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

/** Whether two setProps Operations change the same thing. */
const isSameTarget = (a: PropsTarget, b: PropsTarget) => {
  if ("blockId" in a) {
    return "blockId" in b && a.blockId === b.blockId;
  }
  if ("rowId" in a) {
    return "rowId" in b && a.rowId === b.rowId;
  }
  return "emailSettings" in b;
};

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
        for (const operation of operations) {
          const last = openStep.at(-1);
          // One Operation per thing, from its first props to its latest, so a
          // step doesn't keep a copy of a Block's text for every keystroke.
          if (
            last?.type === "setProps" &&
            operation.type === "setProps" &&
            isSameTarget(last, operation)
          ) {
            // Back where it started, as when a character is typed and deleted.
            if (isSameDocument(operation.props, last.previousProps)) {
              openStep.pop();
            } else {
              openStep[openStep.length - 1] = {
                ...last,
                props: operation.props,
              };
            }
          } else {
            openStep.push(operation);
          }
        }
      } else {
        undoStack.push(operations);
      }
      openMergeKey = mergeKey;
      // A step that changes nothing would make an undo seem to do nothing.
      if (openStep?.length === 0) {
        undoStack.pop();
        openMergeKey = undefined;
      }
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
