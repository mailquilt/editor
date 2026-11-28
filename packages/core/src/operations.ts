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

/**
 * What an insert or remove acts on, and `at`, where it is in its list: like a
 * move's `from` and `to`. So an ID outside `at` always names what changed.
 */
type Placement =
  | { at: BlockPosition; block: Block }
  | { at: { index: number; rowId: string }; column: Column }
  | { at: { index: number }; row: Row };

/** What a setProps changes. */
export type PropsTarget =
  | { blockId: string }
  | { rowId: string }
  | { columnId: string }
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

/**
 * A Block and where it is, or undefined if it isn't in the document.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
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

export const findBlock = (document: BlocksDocument, blockId: string) =>
  findBlockPosition(document, blockId)?.block;

export const findColumn = (document: BlocksDocument, columnId: string) =>
  columnsIn(document).find(({ id }) => id === columnId);

/** -1 if the Row isn't in the document. */
export const findRowIndex = (document: BlocksDocument, rowId: string) =>
  document.rows.findIndex(({ id }) => id === rowId);

export const findRow = (document: BlocksDocument, rowId: string) =>
  document.rows[findRowIndex(document, rowId)];

/** What a Command refusal and an Operation's error say of a missing item. */
export const noSuchItem = (kind: "Block" | "Column" | "Row", id: string) =>
  `No ${kind} with ID "${id}"`;

const getColumn = (document: BlocksDocument, columnId: string) => {
  const column = findColumn(document, columnId);
  if (!column) {
    throw new Error(noSuchItem("Column", columnId));
  }
  return column;
};

const getRow = (document: BlocksDocument, rowId: string) => {
  const row = findRow(document, rowId);
  if (!row) {
    throw new Error(noSuchItem("Row", rowId));
  }
  return row;
};

/** Changes the list in the document that a Placement's item belongs in. */
type ListEdit = <Item extends { id: string }>(
  list: Item[],
  index: number,
  item: Item
) => void;

/** Gives `edit` the Placement's item with its own list, so the types match. */
const editPlacement = (
  document: BlocksDocument,
  placement: Placement,
  edit: ListEdit
) => {
  if ("row" in placement) {
    edit(document.rows, placement.at.index, placement.row);
  } else if ("column" in placement) {
    edit(
      getRow(document, placement.at.rowId).columns,
      placement.at.index,
      placement.column
    );
  } else {
    edit(
      getColumn(document, placement.at.columnId).blocks,
      placement.at.index,
      placement.block
    );
  }
};

const insertItem: ListEdit = (list, index, item) => {
  // A copy, because later Operations change this item in place.
  list.splice(index, 0, structuredClone(item));
};

const removeItem: ListEdit = (list, index, item) => {
  // As for a move: a stale index would otherwise remove another item.
  if (list[index]?.id !== item.id) {
    throw new Error(`No "${item.id}" at index ${index}`);
  }
  list.splice(index, 1);
};

/** Changes `document` in place. */
export const applyOperation = (
  document: BlocksDocument,
  operation: Operation
) => {
  switch (operation.type) {
    case "insert": {
      editPlacement(document, operation, insertItem);
      break;
    }
    case "remove": {
      editPlacement(document, operation, removeItem);
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
      const { blockId, from, to } = operation;
      const { blocks } = getColumn(document, from.columnId);
      if (blocks[from.index]?.id !== blockId) {
        throw new Error(
          `No Block "${blockId}" at index ${from.index} of "${from.columnId}"`
        );
      }
      const target = getColumn(document, to.columnId).blocks;
      const [block] = blocks.splice(from.index, 1) as [Block];
      target.splice(to.index, 0, block);
      break;
    }
    case "setProps": {
      if ("emailSettings" in operation) {
        // Safe: the Command that planned it checked these against the email
        // settings' schema, and undo gives back settings that were checked.
        document.settings = operation.props as unknown as EmailSettings;
      } else if ("rowId" in operation) {
        getRow(document, operation.rowId).props = operation.props;
      } else if ("columnId" in operation) {
        getColumn(document, operation.columnId).props = operation.props;
      } else {
        const block = findBlock(document, operation.blockId);
        if (!block) {
          throw new Error(noSuchItem("Block", operation.blockId));
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
