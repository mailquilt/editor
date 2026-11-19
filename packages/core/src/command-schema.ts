import * as v from "valibot";

import { ROW_LAYOUTS } from "./row-layouts.js";
import type { RowLayout } from "./row-layouts.js";

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

/** A request to change an email. It can be refused. */
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
