import { findBlockPosition } from "@mailquilt/core";
import type { BlocksDocument } from "@mailquilt/core";

/** Where Blocks are in an email, and how the editor says it in words. */

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
