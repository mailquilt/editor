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
  blockPlace,
  dropCommand,
  locate,
  locateColumn,
  locateRow,
  moveCommand,
  moveRowCommand,
  neighbourBlockId,
  placeIn,
} from "./positions.js";
import type {
  ColumnPosition,
  Direction,
  DragSource,
  DropPosition,
  RowPosition,
} from "./positions.js";
import type { OfferedSavedRow } from "./saved-rows.js";
import type { EditorSelection } from "./selection.js";
import type { StringId } from "./strings.js";
import { blockTypeName } from "./text.js";
import type { Text } from "./text.js";

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
  /**
   * The email as the Canvas draws it on the device being viewed, which the
   * arrow keys and focus after a delete go through.
   */
  drawnEmail: () => BlocksDocument | undefined;
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
    "blockId" | "columnId" | "rowId" | "select" | "selectLanded" | "selectRow"
  >;
  text: Text;
}

/** What's said when the selected Block can't move, each way. */
const BLOCK_CANT_MOVE = {
  down: "said.blockCantMoveDown",
  left: "said.blockCantMoveLeft",
  right: "said.blockCantMoveRight",
  up: "said.blockCantMoveUp",
} as const satisfies Record<Direction, StringId>;

/**
 * A Row's layout, or for Column widths that aren't one, as a saved email may
 * have, the layout with as many Columns, all the same width.
 */
export const layoutOf = (row: Row) =>
  rowLayoutOf(row) ??
  ROW_LAYOUTS.find((layout) => layout.split("/").length === row.columns.length);

/**
 * The Command that inserts a copy of a Row at `index`, as a paste, a duplicate
 * or a Saved Row does: its props, and its Columns' and Blocks', with new IDs.
 * None for a Row with more Columns than a layout has.
 */
export const copyRowCommand = (
  row: Row,
  index: number
): Command | undefined => {
  const layout = layoutOf(row);
  return (
    layout && {
      columns: row.columns.map(({ blocks, props }) => ({
        blocks: blocks.map((block) => ({
          props: block.props,
          type: block.type,
        })),
        props,
      })),
      index,
      layout,
      props: row.props,
      type: "insertRow",
    }
  );
};

export type EditingActions = ReturnType<typeof createEditingActions>;

export const createEditingActions = ({
  announcements,
  apply,
  drawnEmail,
  email: current,
  focus,
  pasteFiles,
  selection,
  text,
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

  const selectedColumn = (
    email: BlocksDocument
  ): ColumnPosition | undefined => {
    const { columnId } = selection;
    return columnId === undefined ? undefined : locateColumn(email, columnId);
  };

  /**
   * After the selected Block, at the end of the selected Column or the
   * selected Row's first Column, or else at the end of the email.
   */
  const defaultBlockPosition = (email: BlocksDocument) => {
    const selected = selectedBlock(email);
    if (selected) {
      return { columnId: selected.columnId, index: selected.index + 1 };
    }
    const column =
      selectedColumn(email)?.column ??
      selectedRow(email)?.row.columns[0] ??
      email.rows.at(-1)?.columns.at(-1);
    return column && { columnId: column.id, index: column.blocks.length };
  };

  /** After the selected Row, or the selected Column's or Block's Row, or else at the end. */
  const newRowIndex = (email: BlocksDocument) => {
    const rowIndex =
      selectedRow(email)?.rowIndex ??
      selectedColumn(email)?.rowIndex ??
      selectedBlock(email)?.rowIndex;
    return rowIndex === undefined ? email.rows.length : rowIndex + 1;
  };

  /**
   * From the keyboard, focus goes to the next Block, or else the one before,
   * as the deleted Block's toolbar had it.
   */
  const deleteBlock = (
    fromKeyboard: boolean,
    said = text("said.blockDeleted")
  ) => {
    const email = current();
    const { blockId } = selection;
    if (!email || blockId === undefined) {
      return;
    }
    const drawn = drawnEmail() ?? email;
    const neighbour =
      neighbourBlockId(drawn, blockId, "down") ??
      neighbourBlockId(drawn, blockId, "up");
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
   * From the keyboard, the next Row is selected, or else the one before, and
   * focus stays where it is in the Selection bar, which then acts on that
   * Row, so the next press deletes that one.
   */
  const deleteRow = (
    rowId: string,
    fromKeyboard: boolean,
    said = text("said.rowDeleted")
  ) => {
    const email = current();
    const position = email && locateRow(email, rowId);
    const neighbour =
      position &&
      (email.rows[position.rowIndex + 1] ?? email.rows[position.rowIndex - 1]);
    if (apply({ rowId, type: "removeRow" })?.ok) {
      announcements.say(said);
      if (fromKeyboard && neighbour) {
        selection.select({ rowId: neighbour.id });
        focus.revealRow(neighbour.id);
      }
    }
  };

  /** Puts the selected Block on the clipboard, and returns where it is. */
  const writeBlock = (data: DataTransfer) => {
    const email = current();
    const selected = email && selectedBlock(email);
    if (!selected) {
      return;
    }
    writeCopy(data, { block: selected.block });
    return blockPlace(email, selected.block.id);
  };

  /** Puts a Row on the clipboard, and returns where it is. */
  const writeRow = (rowId: string, data: DataTransfer) => {
    const email = current();
    const position = email && locateRow(email, rowId);
    if (!position) {
      return;
    }
    writeCopy(data, { row: position.row });
    return placeIn(position.rowIndex, email.rows.length);
  };

  /** Says a new Block's type and where it is. */
  const announceAdded = (blockId: string | undefined) => {
    const email = current();
    const position = email && blockId !== undefined && locate(email, blockId);
    if (position) {
      announcements.say(
        text("said.blockAdded", {
          ...blockPlace(email, blockId),
          type: blockTypeName(position.block.type, text),
        })
      );
    }
  };

  return {
    /**
     * Adds a Block, selects it, ready to type in if it has text, and says
     * where it went. By default it goes where `defaultBlockPosition` says.
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
        announceAdded(result.createdId);
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
     * After the selected Row, or the selected Column's or Block's Row, or else
     * at the end, and selects it.
     */
    addRow: (layout: RowLayout, fromKeyboard: boolean) => {
      const email = current();
      if (!email) {
        return;
      }
      const result = apply({
        index: newRowIndex(email),
        layout,
        type: "insertRow",
      });
      if (result?.ok && result.createdId !== undefined) {
        selection.selectRow(result.createdId, fromKeyboard);
      }
    },

    /**
     * A copy of a Saved Row, in one Command, where `addRow` adds one or at
     * `rowIndex`, as a drop gives it. It's selected, and its name and place
     * are said.
     */
    addSavedRow: (
      saved: OfferedSavedRow,
      fromKeyboard: boolean,
      rowIndex?: number
    ) => {
      const email = current();
      const command =
        email && copyRowCommand(saved.row, rowIndex ?? newRowIndex(email));
      const result = command && apply(command);
      const added = result?.ok && current();
      const position =
        added && result.createdId !== undefined
          ? locateRow(added, result.createdId)
          : undefined;
      if (!(added && position)) {
        return;
      }
      selection.selectRow(position.row.id, fromKeyboard);
      announcements.say(
        text("said.savedRowAdded", {
          ...placeIn(position.rowIndex, added.rows.length),
          name: saved.name,
        })
      );
    },

    /** Puts the selected Block on the clipboard, and says where it is. */
    copyBlock: (data: DataTransfer) => {
      const where = writeBlock(data);
      if (where) {
        announcements.say(text("said.blockCopied", where));
      }
    },

    /** Puts a Row on the clipboard, and says where it is. */
    copyRow: (rowId: string, data: DataTransfer) => {
      const where = writeRow(rowId, data);
      if (where) {
        announcements.say(text("said.rowCopied", where));
      }
    },

    /** Copies the selected Block, then deletes it, as Delete Block does. */
    cutBlock: (data: DataTransfer) => {
      const where = writeBlock(data);
      if (where) {
        deleteBlock(true, text("said.blockCut", where));
      }
    },

    /** Copies a Row, then deletes it, as Delete Row does. */
    cutRow: (rowId: string, data: DataTransfer) => {
      const where = writeRow(rowId, data);
      if (where) {
        deleteRow(rowId, true, text("said.rowCut", where));
      }
    },

    deleteBlock,

    deleteRow,

    /**
     * What's dropped: a Block or Row moved, or a new one, which is selected.
     * A Saved Row is the editor's to give, as `addSavedRow` takes it.
     */
    drop: (
      source: Exclude<DragSource, { savedRow: number }>,
      position: DropPosition
    ) => {
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
      } else {
        announceAdded(result.createdId);
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
      announcements.blockMoved(blockId, "said.blockDuplicated");
    },

    /**
     * A copy of a Row, with its Blocks, right after it, which is selected.
     * Focus stays where it is, such as on the Selection bar's Duplicate, which
     * then acts on the copy.
     */
    duplicateRow: (rowId: string) => {
      const email = current();
      const position = email && locateRow(email, rowId);
      const command =
        position && copyRowCommand(position.row, position.rowIndex + 1);
      const result = command && apply(command);
      if (result?.ok && result.createdId !== undefined) {
        selection.select({ rowId: result.createdId });
        focus.revealRow(result.createdId);
        announcements.rowMoved(result.createdId, "said.rowDuplicated");
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
      if ("rowId" in operation) {
        announcements.rowMoved(
          operation.rowId,
          step === "undo" ? "said.undoMovedRow" : "said.redoMovedRow"
        );
        return;
      }
      const { blockId } = operation;
      announcements.blockMoved(
        blockId,
        step === "undo" ? "said.undoMovedBlock" : "said.redoMovedBlock"
      );
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
        announcements.say(text(BLOCK_CANT_MOVE[direction]));
      }
    },

    /**
     * One step, keeping the selection, and focus on the Row's tools if it was
     * there.
     */
    moveRow: (rowId: string, direction: "down" | "up") => {
      const email = current();
      const command = email && moveRowCommand(email, rowId, direction);
      if (!command) {
        announcements.say(
          text(
            direction === "up" ? "said.rowCantMoveUp" : "said.rowCantMoveDown"
          )
        );
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
        announcements.say(text(`paste.${pasted.refused}`));
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
          announcements.blockMoved(blockId, "said.blockPasted");
        }
        return;
      }
      if ("row" in pasted) {
        const command = copyRowCommand(pasted.row, nextRowIndex);
        const result = command && apply(command);
        if (result?.ok && result.createdId !== undefined) {
          selection.selectRow(result.createdId, true);
          announcements.rowMoved(result.createdId, "said.rowPasted");
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
        announcements.blockMoved(blockId, "said.blockPasted");
      }
    },

    /** Focuses the selected Block's neighbour, if it has one that way. */
    selectNeighbour: (direction: Direction) => {
      const email = drawnEmail();
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

    /** The selected Column, and where it is. */
    selectedColumn,

    /** The selected Row, and where it is. */
    selectedRow,
  };
};
