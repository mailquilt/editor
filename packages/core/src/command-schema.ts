import * as v from "valibot";

import { ROW_LAYOUTS } from "./row-layouts.js";
import type { RowLayout } from "./row-layouts.js";
import { isPlainObject } from "./value-schemas.js";

const indexSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

const layoutSchema = v.picklist(ROW_LAYOUTS);

/**
 * A Block's, Row's or the email's properties or Email style, or changes to
 * them. Not v.record, which accepts an array and silently drops a key such as
 * "constructor". An undefined is left out, as the key would be gone once the
 * Command is JSON.
 */
const changesSchema = v.pipe(
  v.custom<Record<string, unknown>>(isPlainObject, "Expected an object"),
  v.transform((changes) =>
    Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined)
    )
  )
);

/** A new Block's content, for `insertRow`. Core gives it an ID. */
export interface NewBlock {
  type: string;
  /** Its props, or else its type's defaults. */
  props?: Record<string, unknown>;
}

/** A new Column's content, for `insertRow`. Its width comes from the layout. */
export interface NewColumn {
  blocks: NewBlock[];
  /** Its props, or else none. */
  props?: Record<string, unknown>;
}

/** A request to change an email. It can be refused. */
export type Command =
  | {
      type: "updateBlockProps";
      blockId: string;
      props: Record<string, unknown>;
    }
  | { type: "updateRowProps"; rowId: string; props: Record<string, unknown> }
  | {
      type: "updateColumnProps";
      columnId: string;
      props: Record<string, unknown>;
    }
  | { type: "updateEmailSettings"; settings: Record<string, unknown> }
  /** Changes the fields of the email's Email style that `style` names. */
  | { type: "updateEmailStyle"; style: Record<string, unknown> }
  | {
      type: "insertBlock";
      blockType: string;
      columnId: string;
      index: number;
      /** The new Block's props, or else its type's defaults. */
      props?: Record<string, unknown>;
    }
  | { type: "removeBlock"; blockId: string }
  | {
      type: "moveBlock";
      blockId: string;
      columnId: string;
      /** Where the Block goes once it has left its current place. */
      index: number;
    }
  | { type: "moveBlockToNewRow"; blockId: string; rowIndex: number }
  | {
      type: "insertBlockInNewRow";
      blockType: string;
      rowIndex: number;
      /** The new Block's props, or else its type's defaults. */
      props?: Record<string, unknown>;
    }
  | {
      type: "insertRow";
      index: number;
      /** Its Columns' widths come from it. */
      layout: RowLayout;
      /** The new Row's props, or else none. */
      props?: Record<string, unknown>;
      /** One for each of the layout's Columns, or else each is empty. */
      columns?: NewColumn[];
    }
  | { type: "removeRow"; rowId: string }
  | {
      type: "moveRow";
      /** Where the Row goes once it has left its current place. */
      index: number;
      rowId: string;
    }
  | { type: "setRowLayout"; layout: RowLayout; rowId: string };

// Written out above, so hosts see Commands rather than the library's types.
export const commandSchema = v.variant("type", [
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
    columnId: v.string(),
    props: changesSchema,
    type: v.literal("updateColumnProps"),
  }),
  v.strictObject({
    settings: changesSchema,
    type: v.literal("updateEmailSettings"),
  }),
  v.strictObject({
    style: changesSchema,
    type: v.literal("updateEmailStyle"),
  }),
  v.strictObject({
    blockType: v.string(),
    columnId: v.string(),
    index: indexSchema,
    props: v.optional(changesSchema),
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
    props: v.optional(changesSchema),
    rowIndex: indexSchema,
    type: v.literal("insertBlockInNewRow"),
  }),
  v.strictObject({
    columns: v.optional(
      v.array(
        v.strictObject({
          blocks: v.array(
            v.strictObject({
              props: v.optional(changesSchema),
              type: v.string(),
            })
          ),
          props: v.optional(changesSchema),
        })
      )
    ),
    index: indexSchema,
    layout: layoutSchema,
    props: v.optional(changesSchema),
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
