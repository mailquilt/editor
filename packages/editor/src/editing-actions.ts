import { ROW_LAYOUTS } from "@mailquilt/core";
import type {
  ApplyResult,
  BlocksDocument,
  Command,
  Operation,
  Row,
  RowLayout,
} from "@mailquilt/core";
import { rowLayoutOf } from "@mailquilt/core/internal";

import type { Announcements } from "./announcements.js";
import { writeCopy } from "./clipboard.js";
import type { Pasted } from "./clipboard.js";
import type { EditorFocus } from "./focus.js";
import {
  blockPositionLabel,
  dropCommand,
  locate,
  locateRow,
  moveCommand,
  moveRowCommand,
  neighbourBlockId,
  positionLabel,
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
  /**
   * Adds an Image Block for each pasted image where a paste lands, and uploads
   * it, as a drop does, and returns the one selected. Refused without
   * `uploadImage`.
   */
  pasteFiles: (files: File[], position: DropPosition) => string | undefined;
  focus: Pick<
    EditorFocus,
    "focus" | "focusWhenRendered" | "revealBlock" | "revealRow"
  >;
  selection: Pick<
    EditorSelection,
    "blockId" | "rowId" | "select" | "selectLanded" | "selectRow"
  >;
}

/**
 * A Row's layout, or for Column widths that aren't one, as a saved email may
 * have, the layout with as many Columns, all the same width.
 */
const layoutOf = (row: Row) =>
  rowLayoutOf(row) ??
  ROW_LAYOUTS.find((layout) => layout.split("/").length === row.columns.length);

export type EditingActions = ReturnType<typeof createEditingActions>;

export const createEditingActions = ({
  announcements,
  apply,
  email: current,
  focus,
  pasteFiles,
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

  /**
   * From the keyboard, focus goes to the next Block, or else the one before,
   * as the deleted Block's toolbar had it.
   */
  const deleteBlock = (fromKeyboard: boolean, said = "Block deleted.") => {
    const email = current();
    const { blockId } = selection;
    if (!email || blockId === undefined) {
      return;
    }
    const neighbour =
      neighbourBlockId(email, blockId, "down") ??
      neighbourBlockId(email, blockId, "up");
    if (apply({ blockId, type: "removeBlock" })?.ok) {
      announcements.say(said);
      if (fromKeyboard && neighbour !== undefined) {
        focus.focusWhenRendered({
          blockId: neighbour,
          on: "block",
        });
      }
    }
  };

  /**
   * From the keyboard, focus goes to the next Row's tools, or else the one
   * before, as the deleted Row's toolbar had it.
   */
  const deleteRow = (
    rowId: string,
    fromKeyboard: boolean,
    said = "Row deleted."
  ) => {
    const email = current();
    const position = email && locateRow(email, rowId);
    const neighbour =
      position &&
      (email.rows[position.rowIndex + 1] ?? email.rows[position.rowIndex - 1]);
    if (apply({ rowId, type: "removeRow" })?.ok) {
      announcements.say(said);
      if (fromKeyboard && neighbour) {
        focus.focusWhenRendered({
          on: "rowTool",
          rowId: neighbour.id,
        });
      }
    }
  };

  /** Puts the selected Block on the clipboard, and returns where it is, in words. */
  const writeBlock = (data: DataTransfer) => {
    const email = current();
    const selected = email && selectedBlock(email);
    if (!selected) {
      return;
    }
    writeCopy(data, { block: selected.block });
    return blockPositionLabel(email, selected.block.id);
  };

  /** Puts a Row on the clipboard, and returns where it is, in words. */
  const writeRow = (rowId: string, data: DataTransfer) => {
    const email = current();
    const position = email && locateRow(email, rowId);
    if (!position) {
      return;
    }
    writeCopy(data, { row: position.row });
    return positionLabel(position.rowIndex, email.rows.length);
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

    /**
     * New Blocks of one type where a drop landed, one after another, in one new
     * Row if it landed outside any Column. Returns their IDs.
     */
    addBlocksAt: (blockType: string, count: number, position: DropPosition) => {
      const blockIds: string[] = [];
      let at = position;
      while (blockIds.length < count) {
        const result = apply(dropCommand({ blockType }, at));
        const email = current();
        const landed =
          result?.ok &&
          result.createdId !== undefined &&
          email &&
          locate(email, result.createdId);
        if (!landed) {
          break;
        }
        blockIds.push(landed.block.id);
        at = { columnId: landed.columnId, index: landed.index + 1 };
      }
      return blockIds;
    },

    /**
     * After the selected Row or the selected Block's Row, or else at the end, and
     * selects it.
     */
    addRow: (layout: RowLayout, fromKeyboard: boolean) => {
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
        selection.selectRow(result.createdId, fromKeyboard);
      }
    },

    /** Puts the selected Block on the clipboard, and says where it is. */
    copyBlock: (data: DataTransfer) => {
      const where = writeBlock(data);
      if (where) {
        announcements.say(`Block copied, ${where}.`);
      }
    },

    /** Puts a Row on the clipboard, and says where it is. */
    copyRow: (rowId: string, data: DataTransfer) => {
      const where = writeRow(rowId, data);
      if (where) {
        announcements.say(`Row copied, ${where}.`);
      }
    },

    /** Copies the selected Block, then deletes it, as Delete Block does. */
    cutBlock: (data: DataTransfer) => {
      const where = writeBlock(data);
      if (where) {
        deleteBlock(true, `Block cut, ${where}.`);
      }
    },

    /** Copies a Row, then deletes it, as Delete Row does. */
    cutRow: (rowId: string, data: DataTransfer) => {
      const where = writeRow(rowId, data);
      if (where) {
        deleteRow(rowId, true, `Row cut, ${where}.`);
      }
    },

    deleteBlock,

    deleteRow,

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
          selection.selectRow(result.createdId, false);
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
     * A copy of the selected Block right after it, which is selected. From the
     * keyboard, focus goes to the copy itself, ready for the next key, and
     * otherwise into its text, as for a new Block.
     */
    duplicateBlock: (fromKeyboard: boolean) => {
      const email = current();
      const selected = email && selectedBlock(email);
      if (!selected) {
        return;
      }
      const { block, columnId, index } = selected;
      const result = apply({
        blockType: block.type,
        columnId,
        index: index + 1,
        props: block.props,
        type: "insertBlock",
      });
      if (!result?.ok || result.createdId === undefined) {
        return;
      }
      const blockId = result.createdId;
      if (fromKeyboard) {
        selection.select({ blockId });
        focus.focusWhenRendered({ blockId, on: "block" });
      } else {
        selection.selectLanded(blockId);
      }
      announcements.blockMoved(blockId, "Block duplicated,");
    },

    /** A copy of a Row, with its Blocks, right after it, which is selected. */
    duplicateRow: (rowId: string, fromKeyboard: boolean) => {
      const email = current();
      const position = email && locateRow(email, rowId);
      const layout = position && layoutOf(position.row);
      if (!(position && layout)) {
        return;
      }
      const { row, rowIndex } = position;
      const result = apply({
        columns: row.columns.map(({ blocks }) => ({
          blocks: blocks.map(({ props, type }) => ({ props, type })),
        })),
        index: rowIndex + 1,
        layout,
        props: row.props,
        type: "insertRow",
      });
      if (result?.ok && result.createdId !== undefined) {
        selection.selectRow(result.createdId, fromKeyboard);
        announcements.rowMoved(result.createdId, "Row duplicated,");
      }
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

    /**
     * Adds what was pasted in one Command, and selects it with focus on it. A
     * Row goes after the selected Row, or the selected Block's Row, or else at
     * the end. Anything else goes after the selected Block, or else in a new
     * Row where a Row would go. Pasted in a Row's toolbar, `afterRow` is that
     * Row, which counts as selected.
     */
    paste: (pasted: Pasted, afterRow?: string) => {
      const email = current();
      if (!email) {
        return;
      }
      if ("refused" in pasted) {
        announcements.say(`Can't paste. ${pasted.refused}.`);
        return;
      }
      const block = afterRow === undefined ? selectedBlock(email) : undefined;
      const row =
        afterRow === undefined
          ? selectedRow(email)
          : locateRow(email, afterRow);
      const rowIndex = (row ?? block)?.rowIndex;
      const nextRowIndex =
        rowIndex === undefined ? email.rows.length : rowIndex + 1;
      const position: DropPosition = block
        ? { columnId: block.columnId, index: block.index + 1 }
        : { rowIndex: nextRowIndex };
      if ("files" in pasted) {
        const blockId = pasteFiles(pasted.files, position);
        if (blockId !== undefined) {
          announcements.blockMoved(blockId, "Block pasted,");
        }
        return;
      }
      if ("row" in pasted) {
        const { row: copied } = pasted;
        const layout = layoutOf(copied);
        const result =
          layout &&
          apply({
            columns: copied.columns.map(({ blocks }) => ({
              blocks: blocks.map(({ props, type }) => ({ props, type })),
            })),
            index: nextRowIndex,
            layout,
            props: copied.props,
            type: "insertRow",
          });
        if (result?.ok && result.createdId !== undefined) {
          selection.selectRow(result.createdId, true);
          announcements.rowMoved(result.createdId, "Row pasted,");
        }
        return;
      }
      const { props, type: blockType } = pasted.block;
      const result = apply(
        "columnId" in position
          ? { blockType, props, ...position, type: "insertBlock" }
          : { blockType, props, ...position, type: "insertBlockInNewRow" }
      );
      if (result?.ok && result.createdId !== undefined) {
        const blockId = result.createdId;
        selection.select({ blockId });
        focus.focusWhenRendered({ blockId, on: "block" });
        announcements.blockMoved(blockId, "Block pasted,");
      }
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
