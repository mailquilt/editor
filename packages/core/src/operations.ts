import type { Block, BlocksDocument, Column, Row } from "./document.js";

interface BlockPosition {
  columnId: string;
  index: number;
}

/** What an insert or remove acts on, and where it goes in its list. */
type Placement =
  | ({ block: Block } & BlockPosition)
  | { column: Column; index: number; rowId: string }
  | { index: number; row: Row };

/**
 * A recorded change that actually happened to an email. This is the fixed set
 * of Operations, and each one is plain JSON.
 */
export type Operation =
  | ({ type: "insert" } & Placement)
  | ({ type: "remove" } & Placement)
  | {
      type: "move";
      blockId: string;
      from: BlockPosition;
      /** The index once the Block has left `from`. */
      to: BlockPosition;
    }
  | {
      type: "setProps";
      blockId: string;
      props: Record<string, unknown>;
      previousProps: Record<string, unknown>;
    }
  | {
      type: "setColumnWidth";
      columnId: string;
      width: number;
      previousWidth: number;
    };

const columnsIn = (document: BlocksDocument) =>
  document.rows.flatMap(({ columns }) => columns);

export const findBlock = (document: BlocksDocument, blockId: string) =>
  columnsIn(document)
    .flatMap(({ blocks }) => blocks)
    .find(({ id }) => id === blockId);

/** Where a Block is, or undefined if it isn't in the document. */
export const findBlockPosition = (
  document: BlocksDocument,
  blockId: string
) => {
  for (const [rowIndex, row] of document.rows.entries()) {
    for (const column of row.columns) {
      const index = column.blocks.findIndex(({ id }) => id === blockId);
      if (index !== -1) {
        return { columnId: column.id, index, rowIndex };
      }
    }
  }
};

export const findColumn = (document: BlocksDocument, columnId: string) =>
  columnsIn(document).find(({ id }) => id === columnId);

const getColumn = (document: BlocksDocument, columnId: string) => {
  const column = findColumn(document, columnId);
  if (!column) {
    throw new Error(`No Column with ID "${columnId}"`);
  }
  return column;
};

const getRow = (document: BlocksDocument, rowId: string) => {
  const row = document.rows.find(({ id }) => id === rowId);
  if (!row) {
    throw new Error(`No Row with ID "${rowId}"`);
  }
  return row;
};

const listFor = (
  document: BlocksDocument,
  placement: Placement
): (Block | Column | Row)[] => {
  if ("row" in placement) {
    return document.rows;
  }
  return "column" in placement
    ? getRow(document, placement.rowId).columns
    : getColumn(document, placement.columnId).blocks;
};

const placedItem = (placement: Placement) => {
  if ("row" in placement) {
    return placement.row;
  }
  return "column" in placement ? placement.column : placement.block;
};

/** Changes `document` in place. */
export const applyOperation = (
  document: BlocksDocument,
  operation: Operation
) => {
  switch (operation.type) {
    case "insert": {
      // A copy, because later Operations change this item in place.
      listFor(document, operation).splice(
        operation.index,
        0,
        structuredClone(placedItem(operation))
      );
      break;
    }
    case "remove": {
      listFor(document, operation).splice(operation.index, 1);
      break;
    }
    case "move": {
      const { from, to } = operation;
      const [block] = getColumn(document, from.columnId).blocks.splice(
        from.index,
        1
      );
      if (!block) {
        throw new Error(
          `No Block at index ${from.index} of "${from.columnId}"`
        );
      }
      getColumn(document, to.columnId).blocks.splice(to.index, 0, block);
      break;
    }
    case "setProps": {
      const block = findBlock(document, operation.blockId);
      if (!block) {
        throw new Error(`No Block with ID "${operation.blockId}"`);
      }
      block.props = operation.props;
      break;
    }
    case "setColumnWidth": {
      getColumn(document, operation.columnId).width = operation.width;
      break;
    }
    default: {
      throw new Error("Unknown Operation");
    }
  }
};

export const reverseOperation = (operation: Operation): Operation => {
  switch (operation.type) {
    case "insert": {
      return { ...operation, type: "remove" };
    }
    case "remove": {
      return { ...operation, type: "insert" };
    }
    case "move": {
      return { ...operation, from: operation.to, to: operation.from };
    }
    case "setProps": {
      return {
        ...operation,
        previousProps: operation.props,
        props: operation.previousProps,
      };
    }
    case "setColumnWidth": {
      return {
        ...operation,
        previousWidth: operation.width,
        width: operation.previousWidth,
      };
    }
    default: {
      throw new Error("Unknown Operation");
    }
  }
};
