import * as v from "valibot";

import {
  blockDefinitions,
  describeIssues,
  parseProps,
  validateProps,
} from "./blocks.js";
import { createId } from "./document.js";
import type { BlocksDocument, Column, Row } from "./document.js";
import { isSameDocument } from "./load-document.js";
import {
  applyOperation,
  findBlock,
  findBlockPosition,
  findColumn,
  findRow,
} from "./operations.js";
import type { Operation, PropsTarget } from "./operations.js";
import {
  emailSettingsSchema,
  newLanguageSettingsSchema,
  rowPropsSchema,
} from "./settings.js";

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

/**
 * The preset a Row uses. A saved email may have other widths, so none.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
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

/**
 * Changes to a Block's, Row's or the email's properties. Not v.record, which
 * accepts an array and silently drops a key such as "constructor". An undefined
 * changes nothing, as the key would be gone once the Command is JSON.
 */
const changesSchema = v.pipe(
  v.custom<Record<string, unknown>>(
    (input) =>
      typeof input === "object" && input !== null && !Array.isArray(input),
    "Expected an object"
  ),
  v.transform((changes) =>
    Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined)
    )
  )
);

/** A request to change an email. It can be rejected. */
export type Command =
  | {
      type: "updateBlockProps";
      blockId: string;
      props: Record<string, unknown>;
    }
  | { type: "updateRowProps"; rowId: string; props: Record<string, unknown> }
  | { type: "updateEmailSettings"; settings: Record<string, unknown> }
  | { type: "insertBlock"; blockType: string; columnId: string; index: number }
  | { type: "removeBlock"; blockId: string }
  | {
      type: "moveBlock";
      blockId: string;
      columnId: string;
      /** Where the Block goes once it has left its current place. */
      index: number;
    }
  | { type: "moveBlockToNewRow"; blockId: string; rowIndex: number }
  | { type: "insertBlockInNewRow"; blockType: string; rowIndex: number }
  | { type: "insertRow"; index: number; layout: RowLayout }
  | { type: "removeRow"; rowId: string }
  | {
      type: "moveRow";
      /** Where the Row goes once it has left its current place. */
      index: number;
      rowId: string;
    }
  | { type: "setRowLayout"; layout: RowLayout; rowId: string };

// Written out above, so hosts see Commands rather than the library's types.
const commandSchema = v.variant("type", [
  v.strictObject({
    blockId: v.string(),
    props: changesSchema,
    type: v.literal("updateBlockProps"),
  }),
  v.strictObject({
    props: changesSchema,
    rowId: v.string(),
    type: v.literal("updateRowProps"),
  }),
  v.strictObject({
    settings: changesSchema,
    type: v.literal("updateEmailSettings"),
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
    blockId: v.string(),
    columnId: v.string(),
    index: indexSchema,
    type: v.literal("moveBlock"),
  }),
  v.strictObject({
    blockId: v.string(),
    rowIndex: indexSchema,
    type: v.literal("moveBlockToNewRow"),
  }),
  v.strictObject({
    blockType: v.string(),
    rowIndex: indexSchema,
    type: v.literal("insertBlockInNewRow"),
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
    index: indexSchema,
    rowId: v.string(),
    type: v.literal("moveRow"),
  }),
  v.strictObject({
    layout: layoutSchema,
    rowId: v.string(),
    type: v.literal("setRowLayout"),
  }),
]) satisfies v.GenericSchema<unknown, Command>;

/** What an accepted Command does to the document. */
type CommandPlan =
  | { ok: true; operations: Operation[]; createdId?: string }
  | { ok: false; reason: string; unchanged?: true };

const rejected = (reason: string) => ({ ok: false as const, reason });

/** Refused only because the email is already that way. */
const unchanged = (reason: string) => ({
  ok: false as const,
  reason,
  unchanged: true as const,
});

/**
 * Plans what `changes` makes of `current`. Only the top-level keys merge, so a
 * nested value is replaced whole. A null removes a property, so that a Command
 * stays plain JSON, and the schema decides whether that property can go.
 */
const planProps = (
  target: PropsTarget,
  current: object,
  changes: Record<string, unknown>,
  validate: (props: Record<string, unknown>) => ReturnType<typeof parseProps>
): CommandPlan => {
  const merged = Object.entries({ ...current, ...changes }).filter(
    ([, value]) => value !== null
  );
  const validated = validate(Object.fromEntries(merged));
  if (!validated.ok) {
    return rejected(validated.reason);
  }
  if (isSameDocument(validated.props, current)) {
    return unchanged("Nothing would change");
  }
  return {
    ok: true,
    operations: [
      {
        ...target,
        previousProps: { ...current },
        props: validated.props,
        type: "setProps",
      },
    ],
  };
};

const planUpdateBlockProps = (
  document: BlocksDocument,
  blockId: string,
  props: Record<string, unknown>
): CommandPlan => {
  const block = findBlock(document, blockId);
  return block
    ? planProps({ blockId }, block.props, props, (merged) =>
        validateProps(block, merged)
      )
    : rejected(`No Block with ID "${blockId}"`);
};

const planUpdateRowProps = (
  document: BlocksDocument,
  rowId: string,
  props: Record<string, unknown>
): CommandPlan => {
  const row = findRow(document, rowId);
  return row
    ? planProps({ rowId }, row.props, props, (merged) =>
        parseProps(rowPropsSchema, merged, `Row "${rowId}"`)
      )
    : rejected(`No Row with ID "${rowId}"`);
};

const planUpdateEmailSettings = (
  document: BlocksDocument,
  settings: Record<string, unknown>
): CommandPlan =>
  planProps({ emailSettings: true }, document.settings, settings, (merged) =>
    parseProps(
      "language" in settings ? newLanguageSettingsSchema : emailSettingsSchema,
      merged,
      "the email's settings"
    )
  );

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
  // Not a copy of the defaults, as inserting the Block copies it.
  const block = { id: createId(), props: definition.defaults, type: blockType };
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

const planMoveBlock = (
  document: BlocksDocument,
  blockId: string,
  columnId: string,
  index: number
): CommandPlan => {
  const position = findBlockPosition(document, blockId);
  if (!position) {
    return rejected(`No Block with ID "${blockId}"`);
  }
  const column = findColumn(document, columnId);
  if (!column) {
    return rejected(`No Column with ID "${columnId}"`);
  }
  const from = { columnId: position.columnId, index: position.index };
  const sameColumn = from.columnId === columnId;
  const length = column.blocks.length - (sameColumn ? 1 : 0);
  if (index > length) {
    return rejected(
      `Index ${index} is past the end of Column "${columnId}", which would have ${length} other Blocks`
    );
  }
  if (sameColumn && from.index === index) {
    return unchanged(`Block "${blockId}" is already at index ${index}`);
  }
  return {
    ok: true,
    operations: [{ blockId, from, to: { columnId, index }, type: "move" }],
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

/**
 * Plans a new single-Column Row and what `planBlock` puts in its Column, as one
 * step, so a rejected Block leaves no empty Row behind.
 */
const planInNewRow = (
  document: BlocksDocument,
  rowIndex: number,
  planBlock: (withRow: BlocksDocument, columnId: string) => CommandPlan
): CommandPlan => {
  const rowPlan = planInsertRow(document, "100", rowIndex);
  if (!rowPlan.ok) {
    return rowPlan;
  }
  const withRow = structuredClone(document);
  for (const operation of rowPlan.operations) {
    applyOperation(withRow, operation);
  }
  const columnId = withRow.rows[rowIndex]?.columns[0]?.id as string;
  const blockPlan = planBlock(withRow, columnId);
  return blockPlan.ok
    ? {
        ...blockPlan,
        operations: [...rowPlan.operations, ...blockPlan.operations],
      }
    : blockPlan;
};

/**
 * A Block alone in a one-Column Row already has a Row of its own, so a new Row
 * right before or after that one would only leave it empty.
 */
const planMoveBlockToNewRow = (
  document: BlocksDocument,
  blockId: string,
  rowIndex: number
): CommandPlan => {
  const from = findBlockPosition(document, blockId);
  const row = from && document.rows[from.rowIndex];
  if (
    from &&
    row?.columns.length === 1 &&
    row.columns[0]?.blocks.length === 1 &&
    (rowIndex === from.rowIndex || rowIndex === from.rowIndex + 1)
  ) {
    return unchanged(`Block "${blockId}" is already alone in its Row`);
  }
  return planInNewRow(document, rowIndex, (withRow, columnId) =>
    planMoveBlock(withRow, blockId, columnId, 0)
  );
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

const planMoveRow = (
  document: BlocksDocument,
  rowId: string,
  index: number
): CommandPlan => {
  const from = document.rows.findIndex(({ id }) => id === rowId);
  if (from === -1) {
    return rejected(`No Row with ID "${rowId}"`);
  }
  const length = document.rows.length - 1;
  if (index > length) {
    return rejected(
      `Index ${index} is past the end of the email, which would have ${length} other Rows`
    );
  }
  if (from === index) {
    return unchanged(`Row "${rowId}" is already at index ${index}`);
  }
  return {
    ok: true,
    operations: [{ from: { index: from }, rowId, to: { index }, type: "move" }],
  };
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
  const row = findRow(document, rowId);
  if (!row) {
    return rejected(`No Row with ID "${rowId}"`);
  }
  if (rowLayoutOf(row) === layout) {
    return unchanged(`Row "${rowId}" already has the layout "${layout}"`);
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
    case "updateBlockProps": {
      return planUpdateBlockProps(document, output.blockId, output.props);
    }
    case "updateRowProps": {
      return planUpdateRowProps(document, output.rowId, output.props);
    }
    case "updateEmailSettings": {
      return planUpdateEmailSettings(document, output.settings);
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
    case "moveBlock": {
      return planMoveBlock(
        document,
        output.blockId,
        output.columnId,
        output.index
      );
    }
    case "moveBlockToNewRow": {
      return planMoveBlockToNewRow(document, output.blockId, output.rowIndex);
    }
    case "insertBlockInNewRow": {
      return planInNewRow(document, output.rowIndex, (withRow, columnId) =>
        planInsertBlock(withRow, output.blockType, columnId, 0)
      );
    }
    case "insertRow": {
      return planInsertRow(document, output.layout, output.index);
    }
    case "removeRow": {
      return planRemoveRow(document, output.rowId);
    }
    case "moveRow": {
      return planMoveRow(document, output.rowId, output.index);
    }
    case "setRowLayout": {
      return planSetRowLayout(document, output.layout, output.rowId);
    }
    default: {
      throw new Error("Unknown Command");
    }
  }
};
