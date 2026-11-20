import type {
  ApplyResult,
  BlocksDocument,
  Command,
  Operation,
  RowLayout,
} from "@mailquilt/core";

import type { Announcements } from "./announcements.js";
import type { EditorFocus } from "./focus.js";
import {
  dropCommand,
  locate,
  locateRow,
  moveCommand,
  moveRowCommand,
  neighbourBlockId,
} from "./positions.js";
import type {
  Direction,
  DragSource,
  DropPosition,
  RowPosition,
} from "./positions.js";
import type { EditorSelection } from "./selection.js";

/**
 * What the editor does to the email's Blocks and Rows: adding, deleting and
 * moving them, and where what's added goes. Each change is applied by the
 * element, which reports it, and then selected, focused or announced here.
 */

type MoveOperation = Extract<Operation, { type: "move" }>;

interface EditingHost {
  /** Applies a Command and reports the change. */
  apply: (command: Command) => ApplyResult | undefined;
  /** The email as it is now. */
  email: () => BlocksDocument | undefined;
  announcements: Pick<Announcements, "blockMoved" | "rowMoved" | "say">;
  focus: Pick<
    EditorFocus,
    "focus" | "focusWhenRendered" | "revealBlock" | "revealRow"
  >;
  selection: Pick<
    EditorSelection,
    "blockId" | "rowId" | "selectLanded" | "selectRow"
  >;
}

export type EditingActions = ReturnType<typeof createEditingActions>;

export const createEditingActions = ({
  announcements,
  apply,
  email: current,
  focus,
  selection,
}: EditingHost) => {
  /** What the latest change moved, for undo and redo to announce. */
  let lastMoves: MoveOperation[] = [];

  const selectedBlock = (email: BlocksDocument) => {
    const { blockId } = selection;
    return blockId === undefined ? undefined : locate(email, blockId);
  };

  const selectedRow = (email: BlocksDocument): RowPosition | undefined => {
    const { rowId } = selection;
    return rowId === undefined ? undefined : locateRow(email, rowId);
  };

  /**
   * After the selected Block, at the end of the selected Row's first Column, or
   * else at the end of the email.
   */
  const defaultBlockPosition = (email: BlocksDocument) => {
    const selected = selectedBlock(email);
    if (selected) {
      return { columnId: selected.columnId, index: selected.index + 1 };
    }
    const column =
      selectedRow(email)?.row.columns[0] ?? email.rows.at(-1)?.columns.at(-1);
    return column && { columnId: column.id, index: column.blocks.length };
  };

  return {
    /**
     * Adds a Block and selects it, ready to type in if it has text. By default it
     * goes where `defaultBlockPosition` says.
     */
    addBlock: (
      blockType: string,
      position?: { columnId: string; index: number }
    ) => {
      const email = current();
      if (!email) {
        return;
      }
      const target = position ?? defaultBlockPosition(email);
      const result = apply(
        target
          ? { blockType, ...target, type: "insertBlock" }
          : { blockType, rowIndex: 0, type: "insertBlockInNewRow" }
      );
      if (result?.ok) {
        selection.selectLanded(result.createdId);
      }
    },

    /** After the selected Block's Row, or else at the end, and selects it. */
    addRow: (layout: RowLayout) => {
      const email = current();
      if (!email) {
        return;
      }
      const rowIndex =
        selectedRow(email)?.rowIndex ?? selectedBlock(email)?.rowIndex;
      const result = apply({
        index: rowIndex === undefined ? email.rows.length : rowIndex + 1,
        layout,
        type: "insertRow",
      });
      if (result?.ok && result.createdId !== undefined) {
        selection.selectRow(result.createdId);
      }
    },

    /**
     * From the keyboard, focus goes to the next Block, or else the one before, as
     * it would be lost. A button pressed with a key clicks with a `detail` of 0.
     */
    deleteBlock: (fromKeyboard: boolean) => {
      const email = current();
      const { blockId } = selection;
      if (!email || blockId === undefined) {
        return;
      }
      const neighbour =
        neighbourBlockId(email, blockId, "down") ??
        neighbourBlockId(email, blockId, "up");
      if (apply({ blockId, type: "removeBlock" })?.ok) {
        announcements.say("Block deleted.");
        if (fromKeyboard && neighbour !== undefined) {
          focus.focusWhenRendered({
            blockId: neighbour,
            on: "block",
          });
        }
      }
    },

    /**
     * From the keyboard, focus goes to the next Row's tools, or else the one
     * before, as it would be lost.
     */
    deleteRow: (rowId: string, fromKeyboard: boolean) => {
      const email = current();
      const position = email && locateRow(email, rowId);
      const neighbour =
        position &&
        (email.rows[position.rowIndex + 1] ??
          email.rows[position.rowIndex - 1]);
      if (apply({ rowId, type: "removeRow" })?.ok) {
        announcements.say("Row deleted.");
        if (fromKeyboard && neighbour) {
          focus.focusWhenRendered({
            on: "rowTool",
            rowId: neighbour.id,
          });
        }
      }
    },

    /** What's dropped: a Block or Row moved, or a new one, which is selected. */
    drop: (source: DragSource, position: DropPosition) => {
      const result = apply(dropCommand(source, position));
      if (!result?.ok) {
        return;
      }
      if ("rowId" in source) {
        announcements.rowMoved(source.rowId);
        return;
      }
      if ("rowLayout" in source) {
        if (result.createdId !== undefined) {
          selection.selectRow(result.createdId);
        }
        return;
      }
      if ("blockId" in source) {
        announcements.blockMoved(source.blockId);
      }
      selection.selectLanded(
        "blockId" in source ? source.blockId : result.createdId
      );
    },

    /**
     * After an undo or redo, says what it moved: one Block or Row, or nothing,
     * as a layout can move many at once. A Block that moved stays in view.
     */
    historyStepped: (step: "redo" | "undo") => {
      const [operation] = lastMoves;
      if (operation === undefined || lastMoves.length > 1) {
        announcements.say("");
        return;
      }
      const prefix = step === "undo" ? "Undo moved" : "Redo moved";
      if ("rowId" in operation) {
        announcements.rowMoved(operation.rowId, `${prefix} a Row to`);
        return;
      }
      const { blockId } = operation;
      announcements.blockMoved(blockId, `${prefix} a Block to`);
      if (blockId === selection.blockId) {
        focus.revealBlock(blockId);
      }
    },

    /** The selected Block, one step. */
    moveBlock: (direction: Direction) => {
      const email = current();
      const { blockId } = selection;
      if (!email || blockId === undefined) {
        return;
      }
      const command = moveCommand(email, blockId, direction);
      if (command && apply(command)?.ok) {
        announcements.blockMoved(blockId);
        focus.revealBlock(blockId);
      } else {
        announcements.say(`The Block can't move ${direction}.`);
      }
    },

    /**
     * One step, keeping the selection, and focus on the Row's tools if it was
     * there. A Row can't move left or right.
     */
    moveRow: (rowId: string, direction: Direction) => {
      const email = current();
      const command =
        email &&
        (direction === "up" || direction === "down") &&
        moveRowCommand(email, rowId, direction);
      if (!command) {
        announcements.say(`The Row can't move ${direction}.`);
        return;
      }
      if (apply(command)?.ok) {
        announcements.rowMoved(rowId);
        focus.revealRow(rowId);
      }
    },

    /** Each change to the email, undo and redo too. */
    onOperations: (operations: Operation[]) => {
      lastMoves = operations.filter(
        (operation): operation is MoveOperation => operation.type === "move"
      );
    },

    /** Focuses the selected Block's neighbour, if it has one that way. */
    selectNeighbour: (direction: Direction) => {
      const email = current();
      const { blockId } = selection;
      const next =
        email &&
        blockId !== undefined &&
        neighbourBlockId(email, blockId, direction);
      if (next) {
        focus.focus({ blockId: next, on: "block" });
      }
    },

    /** The selected Block, and where it is. */
    selectedBlock,

    /** The selected Row, and where it is. */
    selectedRow,
  };
};
