import type {
  Block,
  BlocksDocument,
  Column,
  EmailSettings,
  Row,
} from "./document.js";

interface BlockPosition {
  columnId: string;
  index: number;
}

/** What an insert or remove acts on, and where it goes in its list. */
type Placement =
  | ({ block: Block } & BlockPosition)
  | { column: Column; index: number; rowId: string }
  | { index: number; row: Row };

/** What a setProps changes. */
export type PropsTarget =
  | { blockId: string }
  | { rowId: string }
  | { emailSettings: true };

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
      type: "move";
      rowId: string;
      from: { index: number };
      /** The index once the Row has left `from`. */
      to: { index: number };
    }
  | ({
      type: "setProps";
      props: Record<string, unknown>;
      previousProps: Record<string, unknown>;
    } & PropsTarget)
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

/** A Block and where it is, or undefined if it isn't in the document. */
export const findBlockPosition = (
  document: BlocksDocument,
  blockId: string
) => {
  for (const [rowIndex, row] of document.rows.entries()) {
    for (const column of row.columns) {
      const index = column.blocks.findIndex(({ id }) => id === blockId);
      const block = column.blocks[index];
      if (block) {
        return { block, columnId: column.id, index, rowIndex };
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

/** A Placement's item, and the list in the document that it belongs in. */
const resolvePlacement = (
  document: BlocksDocument,
  placement: Placement
): { item: Block | Column | Row; list: (Block | Column | Row)[] } => {
  if ("row" in placement) {
    return { item: placement.row, list: document.rows };
  }
  return "column" in placement
    ? {
        item: placement.column,
        list: getRow(document, placement.rowId).columns,
      }
    : {
        item: placement.block,
        list: getColumn(document, placement.columnId).blocks,
      };
};

/** Changes `document` in place. */
export const applyOperation = (
  document: BlocksDocument,
  operation: Operation
) => {
  switch (operation.type) {
    case "insert": {
      const { item, list } = resolvePlacement(document, operation);
      // A copy, because later Operations change this item in place.
      list.splice(operation.index, 0, structuredClone(item));
      break;
    }
    case "remove": {
      resolvePlacement(document, operation).list.splice(operation.index, 1);
      break;
    }
    case "move": {
      if ("rowId" in operation) {
        const { from, rowId, to } = operation;
        if (document.rows[from.index]?.id !== rowId) {
          throw new Error(`No Row "${rowId}" at index ${from.index}`);
        }
        const [row] = document.rows.splice(from.index, 1) as [Row];
        document.rows.splice(to.index, 0, row);
        break;
      }
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
      if ("emailSettings" in operation) {
        document.settings = operation.props as unknown as EmailSettings;
      } else if ("rowId" in operation) {
        getRow(document, operation.rowId).props = operation.props;
      } else {
        const block = findBlock(document, operation.blockId);
        if (!block) {
          throw new Error(`No Block with ID "${operation.blockId}"`);
        }
        block.props = operation.props;
      }
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
      // Each kind on its own, so that `from` and `to` keep their types.
      return "rowId" in operation
        ? { ...operation, from: operation.to, to: operation.from }
        : { ...operation, from: operation.to, to: operation.from };
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
