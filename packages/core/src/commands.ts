import * as v from "valibot";

import { blockDefinitions, validateProps } from "./blocks.js";
import { commandSchema } from "./command-schema.js";
import type { NewColumn } from "./command-schema.js";
import { createId } from "./document.js";
import type { Block, BlocksDocument, Column, Row } from "./document.js";
import {
  emailSettingsSchema,
  newLanguageSettingsSchema,
} from "./email-settings.js";
import { isSameDocument } from "./is-same-document.js";
import {
  findBlock,
  findBlockPosition,
  findColumn,
  findRow,
  findRowIndex,
  noSuchItem,
} from "./operations.js";
import type { Operation, PropsTarget } from "./operations.js";
import { LAYOUT_WIDTHS, rowLayoutOf } from "./row-layouts.js";
import type { RowLayout } from "./row-layouts.js";
import { rowPropsSchema } from "./row-settings.js";
import { describeIssues, parseProps } from "./validation.js";

/** Why a Command was refused, for a host to tell one refusal from another. */
export type RefusalCode =
  /** It isn't a Command, or one of its fields isn't what that Command takes. */
  | "invalidCommand"
  /** The changed props or settings aren't ones that can be saved. */
  | "invalidProps"
  | "noSuchBlock"
  | "noSuchColumn"
  | "noSuchRow"
  | "unknownBlockType"
  /** An index past the end of the Column or the email. */
  | "indexPastEnd"
  /** The email is already as the Command asks. */
  | "unchanged";

/** What an accepted Command does to the document. */
type CommandPlan =
  | { ok: true; operations: Operation[]; createdId?: string }
  | { ok: false; code: RefusalCode; reason: string };

const refused = (code: RefusalCode, reason: string) => ({
  code,
  ok: false as const,
  reason,
});

const noSuch = (kind: "Block" | "Column" | "Row", id: string) =>
  refused(`noSuch${kind}`, noSuchItem(kind, id));

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
    return refused("invalidProps", validated.reason);
  }
  if (isSameDocument(validated.props, current)) {
    return refused("unchanged", "Nothing would change");
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
    : noSuch("Block", blockId);
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
    : noSuch("Row", rowId);
};

const planUpdateEmailSettings = (
  document: BlocksDocument,
  settings: Record<string, unknown>
): CommandPlan =>
  planProps({ emailSettings: true }, document.settings, settings, (merged) =>
    parseProps(
      // A saved language sent back unchanged keeps its pass.
      "language" in settings && settings.language !== document.settings.language
        ? newLanguageSettingsSchema
        : emailSettingsSchema,
      merged,
      "the email's settings"
    )
  );

/**
 * A new Block of a type, with a new ID, and `props` or else the type's
 * defaults. Not a copy of either, as inserting the Block copies it. `owner`
 * names it in a refusal, as it has no ID yet that a host would know.
 */
const newBlock = (
  blockType: string,
  props: Record<string, unknown> | undefined,
  owner: string
) => {
  const definition = blockDefinitions.get(blockType);
  if (!definition) {
    return refused("unknownBlockType", `Unknown Block type "${blockType}"`);
  }
  const validated =
    props === undefined
      ? { ok: true as const, props: definition.defaults }
      : parseProps(definition.schema, props, owner);
  if (!validated.ok) {
    return refused("invalidProps", validated.reason);
  }
  // The cast is safe, as the definition was found by this type.
  const block = { id: createId(), props: validated.props, type: blockType };
  return { block: block as Block, ok: true as const };
};

const planInsertBlock = (
  document: BlocksDocument,
  block: Block,
  columnId: string,
  index: number
): CommandPlan => {
  const column = findColumn(document, columnId);
  if (!column) {
    return noSuch("Column", columnId);
  }
  if (index > column.blocks.length) {
    return refused(
      "indexPastEnd",
      `Index ${index} is past the end of Column "${columnId}", which has ${column.blocks.length} Blocks`
    );
  }
  return {
    createdId: block.id,
    ok: true,
    operations: [{ at: { columnId, index }, block, type: "insert" }],
  };
};

const planRemoveBlock = (
  document: BlocksDocument,
  blockId: string
): CommandPlan => {
  const position = findBlockPosition(document, blockId);
  if (!position) {
    return noSuch("Block", blockId);
  }
  const { block, columnId, index } = position;
  return {
    ok: true,
    operations: [{ at: { columnId, index }, block, type: "remove" }],
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
    return noSuch("Block", blockId);
  }
  const column = findColumn(document, columnId);
  if (!column) {
    return noSuch("Column", columnId);
  }
  const from = { columnId: position.columnId, index: position.index };
  const sameColumn = from.columnId === columnId;
  const length = column.blocks.length - (sameColumn ? 1 : 0);
  if (index > length) {
    return refused(
      "indexPastEnd",
      `Index ${index} is past the end of Column "${columnId}", which would have ${length} other Blocks`
    );
  }
  if (sameColumn && from.index === index) {
    return refused(
      "unchanged",
      `Block "${blockId}" is already at index ${index}`
    );
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

const newRow = (columns: Column[]): Row => ({
  columns,
  id: createId(),
  props: {},
});

/**
 * A new Row with a layout's Columns, each holding the Blocks `columns` gives
 * it, and `props` or else none. Every ID in it is new.
 */
const planNewRow = (
  layout: RowLayout,
  props: Record<string, unknown> | undefined,
  columns: NewColumn[] | undefined
) => {
  const widths = LAYOUT_WIDTHS[layout];
  if (columns !== undefined && columns.length !== widths.length) {
    return refused(
      "invalidCommand",
      `Invalid Command: the layout "${layout}" has ${widths.length} Columns, not ${columns.length}`
    );
  }
  const validated =
    props === undefined
      ? { ok: true as const, props: {} }
      : parseProps(rowPropsSchema, props, "the new Row");
  if (!validated.ok) {
    return refused("invalidProps", validated.reason);
  }
  const row: Row = { ...newRow([]), props: validated.props };
  for (const [columnIndex, width] of widths.entries()) {
    const column = newColumn(width);
    for (const [index, block] of (
      columns?.[columnIndex]?.blocks ?? []
    ).entries()) {
      const made = newBlock(
        block.type,
        block.props,
        `Block ${index + 1} of Column ${columnIndex + 1} in the new Row`
      );
      if (!made.ok) {
        return made;
      }
      column.blocks.push(made.block);
    }
    row.columns.push(column);
  }
  return { ok: true as const, row };
};

const planInsertRow = (
  document: BlocksDocument,
  row: Row,
  index: number
): CommandPlan =>
  index > document.rows.length
    ? refused(
        "indexPastEnd",
        `Index ${index} is past the end of the email, which has ${document.rows.length} Rows`
      )
    : {
        createdId: row.id,
        ok: true,
        operations: [{ at: { index }, row, type: "insert" }],
      };

/**
 * Plans a new single-Column Row and what `planBlock` puts in its Column, as one
 * step, so a refused Block leaves no empty Row behind.
 */
const planInNewRow = (
  document: BlocksDocument,
  rowIndex: number,
  planBlock: (withRow: BlocksDocument, columnId: string) => CommandPlan
): CommandPlan => {
  const column = newColumn(100);
  const row = newRow([column]);
  const rowPlan = planInsertRow(document, row, rowIndex);
  if (!rowPlan.ok) {
    return rowPlan;
  }
  // Not a copy, as planning only reads the email.
  const withRow = {
    ...document,
    rows: document.rows.toSpliced(rowIndex, 0, row),
  };
  const blockPlan = planBlock(withRow, column.id);
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
  // Before the new Row's place, so a missing Block is named as that.
  if (!from) {
    return noSuch("Block", blockId);
  }
  const row = document.rows[from.rowIndex];
  if (
    row?.columns.length === 1 &&
    row.columns[0]?.blocks.length === 1 &&
    (rowIndex === from.rowIndex || rowIndex === from.rowIndex + 1)
  ) {
    return refused(
      "unchanged",
      `Block "${blockId}" is already alone in its Row`
    );
  }
  return planInNewRow(document, rowIndex, (withRow, columnId) =>
    planMoveBlock(withRow, blockId, columnId, 0)
  );
};

const planRemoveRow = (
  document: BlocksDocument,
  rowId: string
): CommandPlan => {
  const index = findRowIndex(document, rowId);
  const row = document.rows[index];
  return row
    ? { ok: true, operations: [{ at: { index }, row, type: "remove" }] }
    : noSuch("Row", rowId);
};

const planMoveRow = (
  document: BlocksDocument,
  rowId: string,
  index: number
): CommandPlan => {
  const from = findRowIndex(document, rowId);
  if (from === -1) {
    return noSuch("Row", rowId);
  }
  const length = document.rows.length - 1;
  if (index > length) {
    return refused(
      "indexPastEnd",
      `Index ${index} is past the end of the email, which would have ${length} other Rows`
    );
  }
  if (from === index) {
    return refused("unchanged", `Row "${rowId}" is already at index ${index}`);
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
    return noSuch("Row", rowId);
  }
  if (rowLayoutOf(row) === layout) {
    return refused(
      "unchanged",
      `Row "${rowId}" already has the layout "${layout}"`
    );
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
      at: { index: widths.length, rowId },
      column: { ...column, blocks: [] },
      type: "remove",
    });
  }

  for (const [index, width] of widths.entries()) {
    const column = kept[index];
    if (!column) {
      operations.push({
        at: { index, rowId },
        column: newColumn(width),
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
    return refused(
      "invalidCommand",
      `Invalid Command: ${describeIssues(parsed.issues)}`
    );
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
      const made = newBlock(output.blockType, output.props, "the new Block");
      return made.ok
        ? planInsertBlock(document, made.block, output.columnId, output.index)
        : made;
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
      // Before the new Row's place, as moveBlockToNewRow checks its Block.
      const made = newBlock(output.blockType, output.props, "the new Block");
      return made.ok
        ? planInNewRow(document, output.rowIndex, (withRow, columnId) =>
            planInsertBlock(withRow, made.block, columnId, 0)
          )
        : made;
    }
    case "insertRow": {
      const made = planNewRow(output.layout, output.props, output.columns);
      return made.ok ? planInsertRow(document, made.row, output.index) : made;
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
