import type { Block, BlocksDocument } from "./document.js";

interface BlockPosition {
  columnId: string;
  index: number;
}

/**
 * A recorded change that actually happened to an email. This is the fixed set
 * of Operations, and each one is plain JSON.
 */
export type Operation =
  | ({ type: "insert"; block: Block } & BlockPosition)
  | ({ type: "remove"; block: Block } & BlockPosition)
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
    };

const columnsIn = (document: BlocksDocument) =>
  document.rows.flatMap(({ columns }) => columns);

export const findBlock = (document: BlocksDocument, blockId: string) =>
  columnsIn(document)
    .flatMap(({ blocks }) => blocks)
    .find(({ id }) => id === blockId);

const getColumn = (document: BlocksDocument, columnId: string) => {
  const column = columnsIn(document).find(({ id }) => id === columnId);
  if (!column) {
    throw new Error(`No Column with ID "${columnId}"`);
  }
  return column;
};

/** Changes `document` in place. */
export const applyOperation = (
  document: BlocksDocument,
  operation: Operation
) => {
  switch (operation.type) {
    case "insert": {
      const { blocks } = getColumn(document, operation.columnId);
      // A copy, because later Operations change this Block in place.
      blocks.splice(operation.index, 0, structuredClone(operation.block));
      break;
    }
    case "remove": {
      const { blocks } = getColumn(document, operation.columnId);
      blocks.splice(operation.index, 1);
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
    default: {
      throw new Error("Unknown Operation");
    }
  }
};
