import type { Command } from "./command-schema.js";
import { planCommand } from "./commands.js";
import type { RefusalCode } from "./commands.js";
import type { BlocksDocument } from "./document.js";
import { isSameDocument } from "./is-same-document.js";
import { loadDocument } from "./load-document.js";
import type { LoadResult } from "./load-document.js";
import { applyOperation, reverseOperation } from "./operations.js";
import type { Operation, PropsTarget } from "./operations.js";

export type ApplyResult =
  | {
      ok: true;
      /**
       * The new Block's ID from `insertBlock` and `insertBlockInNewRow`, or the
       * new Row's from `insertRow`. Other Commands, including
       * `moveBlockToNewRow`, have none.
       */
      createdId?: string;
    }
  | {
      ok: false;
      /** What kind of refusal this is, for code to match on. */
      code: RefusalCode;
      /** Why, in English, for a person to read. */
      reason: string;
    };

export interface ApplyOptions {
  /**
   * Joins this Command to the undo step made by the Command just before it, if
   * that one had the same key. Undo and redo end a step, so it can't be joined.
   * Property changes that end where they started leave no step, and the next
   * Command with the key starts a new one. That holds when changes to several
   * things take turns, too.
   */
  mergeKey?: string;
}

export interface Editor {
  apply: (command: Command, options?: ApplyOptions) => ApplyResult;
  /** Returns false when there is nothing to undo. */
  undo: () => boolean;
  /** Returns false when there is nothing to redo. */
  redo: () => boolean;
  /** Whether `undo()` would change the email. */
  canUndo: () => boolean;
  /** Whether `redo()` would change the email. */
  canRedo: () => boolean;
  getDocument: () => BlocksDocument;
  /**
   * Calls `listener` with the Operations of each change, including undo and
   * redo. Returns a function that ends the subscription. Subscribing a function
   * that's already subscribed adds nothing, so one call ends it. A listener
   * that throws doesn't stop the others hearing of the change. Once they all
   * have, the first error is thrown from the `apply()`, `undo()` or `redo()`
   * that made it. A Command that a listener applies is heard of once every
   * listener has heard of the change before it, which is after that `apply()`
   * has returned, so an error from hearing of it is thrown from the call that
   * made the first change.
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

/**
 * An Editor for a document that `loadDocument` accepted, which it doesn't check
 * again. It keeps that document as its own, so nothing else may change it.
 */
export const editorOfLoaded = ({
  document: loadedDocument,
}: Extract<LoadResult, { ok: true }>): Editor => {
  let current = loadedDocument;
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

  // A listener can apply a Command of its own. Its change happens at once, but
  // listeners hear of it only after every listener has heard of the one before,
  // so each hears them in order.
  const unheard: Operation[][] = [];
  let notifying = false;

  /**
   * Runs last, so listeners can't interrupt a change or see it half done. A
   * listener that throws doesn't stop the others hearing of a change that has
   * happened. Its error is thrown once they all have.
   */
  const notify = (operations: Operation[]) => {
    unheard.push(operations);
    if (notifying) {
      return;
    }
    notifying = true;
    let failure: { error: unknown } | undefined;
    for (let next = unheard.shift(); next; next = unheard.shift()) {
      for (const listener of listeners) {
        try {
          listener(structuredClone(next));
        } catch (error) {
          failure ??= { error };
        }
      }
    }
    notifying = false;
    if (failure) {
      throw failure.error;
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
          // One Operation per thing, from its first props to its latest, so a
          // step doesn't keep a copy of a Block's text for every keystroke.
          // Each setProps holds the whole props before and after, so it joins
          // the latest change to the same thing, whatever came between. That
          // holds while no Command puts back a Block or Row it removed, whose
          // insert would hold a copy of its props.
          const index =
            operation.type === "setProps"
              ? openStep.findLastIndex(
                  (earlier) =>
                    earlier.type === "setProps" &&
                    isSameTarget(earlier, operation)
                )
              : -1;
          const earlier = openStep[index];
          if (earlier?.type === "setProps" && operation.type === "setProps") {
            // Back where it started, as when a character is typed and deleted.
            if (isSameDocument(operation.props, earlier.previousProps)) {
              openStep.splice(index, 1);
            } else {
              openStep[index] = { ...earlier, props: operation.props };
            }
          } else {
            openStep.push(operation);
          }
        }
        openMergeKey = mergeKey;
        // A step that changes nothing would make an undo seem to do nothing.
        if (openStep.length === 0) {
          undoStack.pop();
          openMergeKey = undefined;
        }
      } else {
        // A copy, as a listener's Command can join this step, and every
        // listener must hear only this Command's Operations.
        undoStack.push([...operations]);
        openMergeKey = mergeKey;
      }
      redoStack.length = 0;
      notify(operations);
      return createdId === undefined ? { ok: true } : { createdId, ok: true };
    },
    canRedo: () => redoStack.length > 0,
    canUndo: () => undoStack.length > 0,
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
      return () => {
        listeners.delete(listener);
      };
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

/** Throws if `document` isn't an email Mail Quilt accepts, with the reason. */
export const createEditor = ({
  document: initialDocument,
}: {
  document: BlocksDocument;
}): Editor => {
  const loaded = loadDocument(initialDocument);
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  return editorOfLoaded(loaded);
};
