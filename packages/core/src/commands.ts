import * as v from "valibot";

import { blockDefinitions, describeIssues, validateProps } from "./blocks.js";
import { createId } from "./create-email.js";
import type { BlocksDocument, Column, Row } from "./document.js";
import { findBlock, findBlockPosition, findColumn } from "./operations.js";
import type { Operation } from "./operations.js";

/** The layouts a Row can have, in the order a person chooses from them. */
export const ROW_LAYOUTS = [
  "100",
  "50/50",
  "33/67",
  "67/33",
  "33/33/33",
  "25/25/25/25",
] as const;

export type RowLayout = (typeof ROW_LAYOUTS)[number];

/** Percentages that add up to 100, so thirds can't all be the same width. */
const LAYOUT_WIDTHS: Record<RowLayout, readonly number[]> = {
  "100": [100],
  "25/25/25/25": [25, 25, 25, 25],
  "33/33/33": [33.33, 33.33, 33.34],
  "33/67": [33, 67],
  "50/50": [50, 50],
  "67/33": [67, 33],
};

/** The preset a Row uses. A saved email may have other widths, so none. */
export const rowLayoutOf = ({ columns }: Row) =>
  ROW_LAYOUTS.find((layout) => {
    const widths = LAYOUT_WIDTHS[layout];
    return (
      widths.length === columns.length &&
      widths.every((width, index) => width === columns[index]?.width)
    );
  });

const indexSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

const layoutSchema = v.picklist(ROW_LAYOUTS);

const commandSchema = v.variant("type", [
  v.strictObject({
    blockId: v.string(),
    props: v.record(v.string(), v.unknown()),
    type: v.literal("updateProps"),
  }),
  v.strictObject({
    blockType: v.string(),
    columnId: v.string(),
    index: indexSchema,
    type: v.literal("insertBlock"),
  }),
  v.strictObject({
    blockId: v.string(),
    type: v.literal("removeBlock"),
  }),
  v.strictObject({
    index: indexSchema,
    layout: layoutSchema,
    type: v.literal("insertRow"),
  }),
  v.strictObject({
    rowId: v.string(),
    type: v.literal("removeRow"),
  }),
  v.strictObject({
    layout: layoutSchema,
    rowId: v.string(),
    type: v.literal("setRowLayout"),
  }),
]);

/** A request to change an email. It can be rejected. */
export type Command = v.InferOutput<typeof commandSchema>;

/** What an accepted Command does to the document. */
export type CommandPlan =
  | { ok: true; operations: Operation[]; createdId?: string }
  | { ok: false; reason: string };

const rejected = (reason: string) => ({ ok: false as const, reason });

const planUpdateProps = (
  document: BlocksDocument,
  blockId: string,
  props: Record<string, unknown>
): CommandPlan => {
  const block = findBlock(document, blockId);
  if (!block) {
    return rejected(`No Block with ID "${blockId}"`);
  }
  const validated = validateProps(block, { ...block.props, ...props });
  if (!validated.valid) {
    return rejected(validated.reason);
  }
  return {
    ok: true,
    operations: [
      {
        blockId,
        previousProps: block.props,
        props: validated.props,
        type: "setProps",
      },
    ],
  };
};

const planInsertBlock = (
  document: BlocksDocument,
  blockType: string,
  columnId: string,
  index: number
): CommandPlan => {
  const definition = blockDefinitions.get(blockType);
  if (!definition) {
    return rejected(`Unknown Block type "${blockType}"`);
  }
  const column = findColumn(document, columnId);
  if (!column) {
    return rejected(`No Column with ID "${columnId}"`);
  }
  if (index > column.blocks.length) {
    return rejected(
      `Index ${index} is past the end of Column "${columnId}", which has ${column.blocks.length} Blocks`
    );
  }
  const block = {
    id: createId(),
    props: structuredClone(definition.defaults),
    type: blockType,
  };
  return {
    createdId: block.id,
    ok: true,
    operations: [{ block, columnId, index, type: "insert" }],
  };
};

const planRemoveBlock = (
  document: BlocksDocument,
  blockId: string
): CommandPlan => {
  const position = findBlockPosition(document, blockId);
  if (!position) {
    return rejected(`No Block with ID "${blockId}"`);
  }
  const { block, columnId, index } = position;
  return {
    ok: true,
    operations: [{ block, columnId, index, type: "remove" }],
  };
};

const newColumn = (width: number): Column => ({
  blocks: [],
  id: createId(),
  props: {},
  width,
});

const planInsertRow = (
  document: BlocksDocument,
  layout: RowLayout,
  index: number
): CommandPlan => {
  if (index > document.rows.length) {
    return rejected(
      `Index ${index} is past the end of the email, which has ${document.rows.length} Rows`
    );
  }
  const row: Row = {
    columns: LAYOUT_WIDTHS[layout].map(newColumn),
    id: createId(),
    props: {},
  };
  return {
    createdId: row.id,
    ok: true,
    operations: [{ index, row, type: "insert" }],
  };
};

const planRemoveRow = (
  document: BlocksDocument,
  rowId: string
): CommandPlan => {
  const index = document.rows.findIndex(({ id }) => id === rowId);
  const row = document.rows[index];
  return row
    ? { ok: true, operations: [{ index, row, type: "remove" }] }
    : rejected(`No Row with ID "${rowId}"`);
};

/**
 * Empties each removed Column into the last one that stays, so no content is
 * lost. Undo runs these in reverse, so each Block returns to where it was.
 */
const planSetRowLayout = (
  document: BlocksDocument,
  layout: RowLayout,
  rowId: string
): CommandPlan => {
  const row = document.rows.find(({ id }) => id === rowId);
  if (!row) {
    return rejected(`No Row with ID "${rowId}"`);
  }
  if (rowLayoutOf(row) === layout) {
    return rejected(`Row "${rowId}" already has the layout "${layout}"`);
  }

  const widths = LAYOUT_WIDTHS[layout];
  const operations: Operation[] = [];
  const kept = row.columns.slice(0, widths.length);
  const lastKept = kept.at(-1) as Column;
  let nextIndex = lastKept.blocks.length;

  for (const column of row.columns.slice(widths.length)) {
    for (const block of column.blocks) {
      operations.push({
        blockId: block.id,
        from: { columnId: column.id, index: 0 },
        to: { columnId: lastKept.id, index: nextIndex },
        type: "move",
      });
      nextIndex += 1;
    }
    operations.push({
      column: { ...column, blocks: [] },
      index: widths.length,
      rowId,
      type: "remove",
    });
  }

  for (const [index, width] of widths.entries()) {
    const column = kept[index];
    if (!column) {
      operations.push({
        column: newColumn(width),
        index,
        rowId,
        type: "insert",
      });
    } else if (column.width !== width) {
      operations.push({
        columnId: column.id,
        previousWidth: column.width,
        type: "setColumnWidth",
        width,
      });
    }
  }

  return { ok: true, operations };
};

/** Checks a Command against `document` and works out its Operations. */
export const planCommand = (
  document: BlocksDocument,
  command: unknown
): CommandPlan => {
  const parsed = v.safeParse(commandSchema, command);
  if (!parsed.success) {
    return rejected(`Invalid Command: ${describeIssues(parsed.issues)}`);
  }
  const { output } = parsed;
  switch (output.type) {
    case "updateProps": {
      return planUpdateProps(document, output.blockId, output.props);
    }
    case "insertBlock": {
      return planInsertBlock(
        document,
        output.blockType,
        output.columnId,
        output.index
      );
    }
    case "removeBlock": {
      return planRemoveBlock(document, output.blockId);
    }
    case "insertRow": {
      return planInsertRow(document, output.layout, output.index);
    }
    case "removeRow": {
      return planRemoveRow(document, output.rowId);
    }
    case "setRowLayout": {
      return planSetRowLayout(document, output.layout, output.rowId);
    }
    default: {
      throw new Error("Unknown Command");
    }
  }
};
