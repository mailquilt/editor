import type { BlocksDocument, Command, RowLayout } from "@mailquilt/core";
import { findBlockPosition } from "@mailquilt/core/internal";

/**
 * Where Blocks and Rows are in an email, how the editor says it in words, and
 * the Commands that move them from one position to another.
 */

/** A way to go in the email, as the arrow keys go. */
export type Direction = "down" | "left" | "right" | "up";

/** Every Block in the email, in reading order. */
export const blocksIn = (email: BlocksDocument) =>
  email.rows.flatMap((row) => row.columns.flatMap(({ blocks }) => blocks));

/** A Block, and its Column and Row with their indexes. */
export const locate = (email: BlocksDocument, blockId: string) => {
  const position = findBlockPosition(email, blockId);
  const row = position && email.rows[position.rowIndex];
  if (!(position && row)) {
    return;
  }
  const columnIndex = row.columns.findIndex(
    ({ id }) => id === position.columnId
  );
  const column = row.columns[columnIndex];
  return column && { ...position, column, columnIndex, row };
};

export type BlockPosition = NonNullable<ReturnType<typeof locate>>;

/** A Row, and its index. */
export const locateRow = (email: BlocksDocument, rowId: string) => {
  const rowIndex = email.rows.findIndex(({ id }) => id === rowId);
  const row = email.rows[rowIndex];
  return row && { row, rowIndex };
};

export type RowPosition = NonNullable<ReturnType<typeof locateRow>>;

/**
 * What a drag brings: a Block or Row on the canvas, a new Block from the palette,
 * or a new Row from the Rows tab.
 */
export type DragSource =
  | { blockId: string }
  | { blockType: string }
  | { rowId: string }
  | { rowLayout: string };

/** Where a drop lands: in a Column, or in a new Row of its own. */
export type DropPosition =
  | { columnId: string; index: number }
  | { rowIndex: number };

/** A Column's place, as its texts' `{row}` and `{column}` count from 1. */
export const columnPlace = (rowIndex: number, columnIndex: number) => ({
  column: columnIndex + 1,
  row: rowIndex + 1,
});

/** A place in a list, as its texts' `{position} of {count}` count from 1. */
export const placeIn = (index: number, count: number) => ({
  count,
  position: index + 1,
});

/**
 * Where a Block is, as the `{row}`, `{column}`, `{position}` and `{count}` of
 * the texts that say so.
 */
export const blockPlace = (email: BlocksDocument, blockId: string) => {
  const position = locate(email, blockId);
  return (
    position && {
      ...columnPlace(position.rowIndex, position.columnIndex),
      ...placeIn(position.index, position.column.blocks.length),
    }
  );
};

/**
 * The Block that arrow keys select next. Up and down follow reading order, which
 * reaches every Block. Left and right go to the nearest Column with Blocks in it,
 * as close as it has to the same position.
 */
export const neighbourBlockId = (
  email: BlocksDocument,
  blockId: string,
  direction: Direction
) => {
  if (direction === "up" || direction === "down") {
    const ids = blocksIn(email).map(({ id }) => id);
    const index = ids.indexOf(blockId);
    return index === -1
      ? undefined
      : ids[index + (direction === "down" ? 1 : -1)];
  }
  const position = locate(email, blockId);
  if (!position) {
    return;
  }
  const { columnIndex, row } = position;
  const columns =
    direction === "right"
      ? row.columns.slice(columnIndex + 1)
      : row.columns.slice(0, columnIndex).toReversed();
  const blocks = columns.find((column) => column.blocks.length > 0)?.blocks;
  return blocks?.[Math.min(position.index, blocks.length - 1)]?.id;
};

/**
 * The Command that moves a Block one step, or nothing if it can't go further. Up
 * and down leave a Column's end for the Row beyond, the same as dragging across,
 * then a Row of its own past the top or bottom of the email. Core refuses that
 * for a Block that already has one, as every press would add an empty Row.
 */
export const moveCommand = (
  email: BlocksDocument,
  blockId: string,
  direction: Direction
): Command | undefined => {
  const position = locate(email, blockId);
  if (!position) {
    return;
  }
  const { column, columnIndex, index, row, rowIndex } = position;
  const moveTo = (columnId: string, at: number): Command => ({
    blockId,
    columnId,
    index: at,
    type: "moveBlock",
  });

  if (direction === "left" || direction === "right") {
    const target = row.columns[columnIndex + (direction === "right" ? 1 : -1)];
    return target && moveTo(target.id, Math.min(index, target.blocks.length));
  }

  const down = direction === "down";
  const nextIndex = index + (down ? 1 : -1);
  if (nextIndex >= 0 && nextIndex < column.blocks.length) {
    return moveTo(column.id, nextIndex);
  }
  const nextRow = email.rows[rowIndex + (down ? 1 : -1)];
  if (nextRow) {
    const target =
      nextRow.columns[Math.min(columnIndex, nextRow.columns.length - 1)];
    return target && moveTo(target.id, down ? 0 : target.blocks.length);
  }
  return {
    blockId,
    rowIndex: down ? email.rows.length : 0,
    type: "moveBlockToNewRow",
  };
};

/** The Command that moves a Row one step, or nothing at either end. */
export const moveRowCommand = (
  email: BlocksDocument,
  rowId: string,
  direction: "down" | "up"
): Command | undefined => {
  const position = locateRow(email, rowId);
  const to = position && position.rowIndex + (direction === "up" ? -1 : 1);
  return to === undefined || to < 0 || to >= email.rows.length
    ? undefined
    : { index: to, rowId, type: "moveRow" };
};

/** A Row, new or on the canvas, which only ever lands between Rows. */
export const isRowSource = (
  source: DragSource
): source is { rowId: string } | { rowLayout: string } =>
  "rowLayout" in source || "rowId" in source;

/** The Command for a drop, which adds a Row if it landed outside any. */
export const dropCommand = (
  source: DragSource,
  position: DropPosition
): Command => {
  if (isRowSource(source)) {
    // A Row only lands between Rows, as dragging finds no Column for one.
    const { rowIndex: index } = position as { rowIndex: number };
    return "rowId" in source
      ? { index, rowId: source.rowId, type: "moveRow" }
      : { index, layout: source.rowLayout as RowLayout, type: "insertRow" };
  }
  if ("blockId" in source) {
    return "columnId" in position
      ? { ...source, ...position, type: "moveBlock" }
      : { ...source, ...position, type: "moveBlockToNewRow" };
  }
  return "columnId" in position
    ? { ...source, ...position, type: "insertBlock" }
    : { ...source, ...position, type: "insertBlockInNewRow" };
};
