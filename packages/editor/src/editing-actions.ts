import type {
  ApplyResult,
  BlocksDocument,
  Command,
  Operation,
  RowLayout,
} from "@mailquilt/core";

import type { Announcements } from "./announcements.js";
import { dropCommand } from "./block-dragging.js";
import type { DragSource, DropPlace } from "./block-dragging.js";
import type { Direction } from "./key-map.js";
import type { RowPlace } from "./panel-api.js";
import {
  locate,
  moveCommand,
  moveRowCommand,
  neighbourBlockId,
} from "./places.js";
import type { Selection } from "./selection.js";

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
  document: () => BlocksDocument | undefined;
  announcements: Announcements;
  selection: Pick<
    Selection,
    | "blockId"
    | "focus"
    | "focusWhenRendered"
    | "revealBlock"
    | "revealRow"
    | "rowId"
    | "selectPlaced"
    | "selectRow"
  >;
}

export type EditingActions = ReturnType<typeof createEditingActions>;

export const createEditingActions = ({
  announcements,
  apply,
  document: current,
  selection,
}: EditingHost) => {
  /** What the latest change moved, for undo and redo to announce. */
  let lastMoves: MoveOperation[] = [];

  const selectedBlock = (document: BlocksDocument) => {
    const { blockId } = selection;
    return blockId === undefined ? undefined : locate(document, blockId);
  };

  const selectedRow = (document: BlocksDocument): RowPlace | undefined => {
    const rowIndex = document.rows.findIndex(
      ({ id }) => id === selection.rowId
    );
    const row = document.rows[rowIndex];
    return row && { row, rowIndex };
  };

  /**
   * After the selected Block, at the end of the selected Row's first Column, or
   * else at the end of the email.
   */
  const defaultBlockPlace = (document: BlocksDocument) => {
    const selected = selectedBlock(document);
    if (selected) {
      return { columnId: selected.columnId, index: selected.index + 1 };
    }
    const column =
      selectedRow(document)?.row.columns[0] ??
      document.rows.at(-1)?.columns.at(-1);
    return column && { columnId: column.id, index: column.blocks.length };
  };

  return {
    /**
     * Adds a Block and selects it, ready to type in if it has text. By default it
     * goes where `defaultBlockPlace` says.
     */
    addBlock: async (
      blockType: string,
      place?: { columnId: string; index: number }
    ) => {
      const document = current();
      if (!document) {
        return;
      }
      const target = place ?? defaultBlockPlace(document);
      const result = apply(
        target
          ? { blockType, ...target, type: "insertBlock" }
          : { blockType, rowIndex: 0, type: "insertBlockInNewRow" }
      );
      if (result?.ok) {
        await selection.selectPlaced(result.createdId);
      }
    },

    /** After the selected Block's Row, or else at the end, and selects it. */
    addRow: async (layout: RowLayout) => {
      const document = current();
      if (!document) {
        return;
      }
      const rowIndex =
        selectedRow(document)?.rowIndex ?? selectedBlock(document)?.rowIndex;
      const result = apply({
        index: rowIndex === undefined ? document.rows.length : rowIndex + 1,
        layout,
        type: "insertRow",
      });
      if (result?.ok && result.createdId !== undefined) {
        await selection.selectRow(result.createdId);
      }
    },

    /**
     * From the keyboard, focus goes to the next Block, or else the one before, as
     * it would be lost. A button pressed with a key clicks with a `detail` of 0.
     */
    deleteBlock: async (fromKeyboard: boolean) => {
      const document = current();
      const { blockId } = selection;
      if (!document || blockId === undefined) {
        return;
      }
      const neighbour =
        neighbourBlockId(document, blockId, "down") ??
        neighbourBlockId(document, blockId, "up");
      if (apply({ blockId, type: "removeBlock" })?.ok) {
        announcements.say("Block deleted.");
        if (fromKeyboard && neighbour !== undefined) {
          await selection.focusWhenRendered({
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
    deleteRow: async (rowId: string, fromKeyboard: boolean) => {
      const rows = current()?.rows ?? [];
      const index = rows.findIndex(({ id }) => id === rowId);
      const neighbour = rows[index + 1] ?? rows[index - 1];
      if (apply({ rowId, type: "removeRow" })?.ok) {
        announcements.say("Row deleted.");
        if (fromKeyboard && neighbour) {
          await selection.focusWhenRendered({
            on: "rowTool",
            rowId: neighbour.id,
          });
        }
      }
    },

    /** What's dropped: a Block or Row moved, or a new one, which is selected. */
    drop: async (source: DragSource, place: DropPlace) => {
      const result = apply(dropCommand(source, place));
      if (!result?.ok) {
        return;
      }
      if ("rowId" in source) {
        announcements.rowMoved(source.rowId);
        return;
      }
      if ("rowLayout" in source) {
        if (result.createdId !== undefined) {
          await selection.selectRow(result.createdId);
        }
        return;
      }
      if ("blockId" in source) {
        announcements.blockMoved(source.blockId);
      }
      await selection.selectPlaced(
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
        selection.revealBlock(blockId);
      }
    },

    /** The selected Block, one step. */
    moveBlock: (direction: Direction) => {
      const document = current();
      const { blockId } = selection;
      if (!document || blockId === undefined) {
        return;
      }
      const command = moveCommand(document, blockId, direction);
      if (command && apply(command)?.ok) {
        announcements.blockMoved(blockId);
        selection.revealBlock(blockId);
      } else {
        announcements.say(`The Block can't move ${direction}.`);
      }
    },

    /**
     * One step, keeping the selection, and focus on the Row's tools if it was
     * there. A Row can't move left or right.
     */
    moveRow: (rowId: string, direction: Direction) => {
      const document = current();
      const command =
        document &&
        (direction === "up" || direction === "down") &&
        moveRowCommand(document, rowId, direction);
      if (!command) {
        announcements.say(`The Row can't move ${direction}.`);
        return;
      }
      if (apply(command)?.ok) {
        announcements.rowMoved(rowId);
        selection.revealRow(rowId);
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
      const document = current();
      const { blockId } = selection;
      const next =
        document &&
        blockId !== undefined &&
        neighbourBlockId(document, blockId, direction);
      if (next) {
        selection.focus({ blockId: next, on: "block" });
      }
    },

    /** The selected Block, and where it is. */
    selectedBlock,

    /** The selected Row, and where it is. */
    selectedRow,
  };
};
