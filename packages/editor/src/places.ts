import type { BlocksDocument, Command } from "@mailquilt/core";
import { findBlockPosition } from "@mailquilt/core/internal";

import type { Direction } from "./block-keyboard.js";

/**
 * Where Blocks are in an email, how the editor says it in words, and where the
 * arrow keys take a selection or a move.
 */

/** Every Block in the email, in reading order. */
export const blocksIn = (document: BlocksDocument) =>
  document.rows.flatMap((row) => row.columns.flatMap(({ blocks }) => blocks));

/** A Block, and its Column and Row with their indexes. */
export const locate = (document: BlocksDocument, blockId: string) => {
  const position = findBlockPosition(document, blockId);
  const row = position && document.rows[position.rowIndex];
  if (!(position && row)) {
    return;
  }
  const columnIndex = row.columns.findIndex(
    ({ id }) => id === position.columnId
  );
  const column = row.columns[columnIndex];
  return column && { ...position, column, columnIndex, row };
};

export type BlockPlace = NonNullable<ReturnType<typeof locate>>;

export const columnLabel = (rowIndex: number, columnIndex: number) =>
  `Row ${rowIndex + 1}, Column ${columnIndex + 1}`;

export const positionLabel = (index: number, count: number) =>
  `position ${index + 1} of ${count}`;

/** Where a Block is, in words. */
export const placeLabel = (document: BlocksDocument, blockId: string) => {
  const place = locate(document, blockId);
  return (
    place &&
    `${columnLabel(place.rowIndex, place.columnIndex)}, ${positionLabel(place.index, place.column.blocks.length)}`
  );
};

/**
 * The Block that arrow keys select next. Up and down follow reading order, which
 * reaches every Block. Left and right go to the nearest Column with Blocks in it,
 * as close as it has to the same position.
 */
export const neighbourBlockId = (
  document: BlocksDocument,
  blockId: string,
  direction: Direction
) => {
  if (direction === "up" || direction === "down") {
    const ids = blocksIn(document).map(({ id }) => id);
    return ids[ids.indexOf(blockId) + (direction === "down" ? 1 : -1)];
  }
  const place = locate(document, blockId);
  if (!place) {
    return;
  }
  const { columnIndex, row } = place;
  const columns =
    direction === "right"
      ? row.columns.slice(columnIndex + 1)
      : // oxlint-disable-next-line unicorn/no-array-reverse -- This package's ES2022 target has no toReversed, and slice made this a copy.
        row.columns.slice(0, columnIndex).reverse();
  const blocks = columns.find((column) => column.blocks.length > 0)?.blocks;
  return blocks?.[Math.min(place.index, blocks.length - 1)]?.id;
};

/**
 * The Command that moves a Block one step, or nothing if it can't go further. Up
 * and down leave a Column's end for the Row beyond, the same as dragging across,
 * then a Row of its own past the top or bottom of the email. Core refuses that
 * for a Block that already has one, as every press would add an empty Row.
 */
export const moveCommand = (
  document: BlocksDocument,
  blockId: string,
  direction: Direction
): Command | undefined => {
  const place = locate(document, blockId);
  if (!place) {
    return;
  }
  const { column, columnIndex, index, row, rowIndex } = place;
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
  const nextRow = document.rows[rowIndex + (down ? 1 : -1)];
  if (nextRow) {
    const target =
      nextRow.columns[Math.min(columnIndex, nextRow.columns.length - 1)];
    return target && moveTo(target.id, down ? 0 : target.blocks.length);
  }
  return {
    blockId,
    rowIndex: down ? document.rows.length : 0,
    type: "moveBlockToNewRow",
  };
};

/** The Command that moves a Row one step, or nothing at either end. */
export const moveRowCommand = (
  document: BlocksDocument,
  rowId: string,
  direction: "down" | "up"
): Command | undefined => {
  const index = document.rows.findIndex(({ id }) => id === rowId);
  const to = index + (direction === "up" ? -1 : 1);
  return index === -1 || to < 0 || to >= document.rows.length
    ? undefined
    : { index: to, rowId, type: "moveRow" };
};
