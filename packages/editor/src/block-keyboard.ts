import { findBlockPosition } from "@mailquilt/core";
import type { BlocksDocument, Command, RowLayout } from "@mailquilt/core";

import type { DragSource, DropPlace } from "./block-dragging.js";

export type Direction = "down" | "left" | "right" | "up";

const ARROW_KEYS: Record<string, Direction> = {
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
};

/** The direction of an arrow key, pressed alone or with only Alt. */
export const arrowDirection = (event: KeyboardEvent): Direction | undefined =>
  event.ctrlKey || event.metaKey || event.shiftKey
    ? undefined
    : ARROW_KEYS[event.key];

const IS_MAC = /Mac|iPhone|iPad/u.test(navigator.userAgent);
/** How a shortcut with Ctrl, or Command on Apple devices, is written. */
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl+";
export const UNDO_KEYS = `${MOD_KEY}Z`;
export const REDO_KEYS = IS_MAC ? "⇧⌘Z" : "Ctrl+Y";
export const UNDO_SHORTCUTS = "Control+Z Meta+Z";
export const REDO_SHORTCUTS = "Control+Y Control+Shift+Z Meta+Shift+Z";

export const MOVE_BUTTONS: {
  direction: Direction;
  keys: string;
  shortcut: string;
}[] = [
  { direction: "up", keys: "Alt+↑", shortcut: "Alt+ArrowUp" },
  { direction: "down", keys: "Alt+↓", shortcut: "Alt+ArrowDown" },
  { direction: "left", keys: "Alt+←", shortcut: "Alt+ArrowLeft" },
  { direction: "right", keys: "Alt+→", shortcut: "Alt+ArrowRight" },
];

type MoveButton = (typeof MOVE_BUTTONS)[number];

/** A Block's up and down, which also move a Row. */
export const ROW_MOVE_BUTTONS = MOVE_BUTTONS.filter(
  (button): button is MoveButton & { direction: "down" | "up" } =>
    button.direction === "up" || button.direction === "down"
);

const TOOLBAR_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
]);

/**
 * Arrow keys, Home and End go along a toolbar's own buttons, either way up. With
 * a modifier they're left alone, as Alt+↑ is a shortcut to move a Block.
 */
export const onToolbarArrowKeys = (event: KeyboardEvent) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }
  const toolbar = event.currentTarget as HTMLElement;
  const buttons = [
    ...toolbar.querySelectorAll<HTMLButtonElement>(
      ":scope > button:not(:disabled)"
    ),
  ];
  const index = buttons.indexOf(event.target as HTMLButtonElement);
  if (!TOOLBAR_KEYS.has(event.key) || index === -1) {
    return;
  }
  event.preventDefault();
  const last = buttons.length - 1;
  const previous = index === 0 ? last : index - 1;
  const following = index === last ? 0 : index + 1;
  const next = {
    ArrowDown: following,
    ArrowLeft: previous,
    ArrowRight: following,
    ArrowUp: previous,
    End: last,
    Home: 0,
  }[event.key];
  buttons[next ?? index]?.focus();
};

/** Layouts without Latin letters report their own, so use the key's position. */
const shortcutKey = (event: KeyboardEvent) =>
  /^[a-z]$/iu.test(event.key)
    ? event.key.toLowerCase()
    : event.code.replace("Key", "").toLowerCase();

export const isLinkShortcut = (event: KeyboardEvent) =>
  !(event.isComposing || event.altKey || event.shiftKey) &&
  (event.metaKey || event.ctrlKey) &&
  shortcutKey(event) === "k";

export const historyShortcut = (event: KeyboardEvent) => {
  if (event.isComposing || event.altKey) {
    return;
  }
  const key = shortcutKey(event);
  if (key === "z" && (event.metaKey || event.ctrlKey)) {
    return event.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) {
    return "redo";
  }
};

/** WebKit can end a composition first, and then report the key as 229. */
export const isComposing = (event: KeyboardEvent) =>
  event.isComposing || event.keyCode === 229;

export const historyInput = (event: InputEvent) => {
  if (event.inputType === "historyUndo") {
    return "undo";
  }
  if (event.inputType === "historyRedo") {
    return "redo";
  }
};

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

/**
 * The Block that arrow keys select next. Up and down follow reading order, which
 * reaches every Block. Left and right go to the nearest Column with Blocks in it,
 * as close as it has to the same position.
 */
export const neighbourBlockId = (
  document: BlocksDocument,
  blockId: string,
  direction: Direction
) => {
  if (direction === "up" || direction === "down") {
    const ids = blocksIn(document).map(({ id }) => id);
    return ids[ids.indexOf(blockId) + (direction === "down" ? 1 : -1)];
  }
  const place = locate(document, blockId);
  if (!place) {
    return;
  }
  const { columnIndex, row } = place;
  const columns =
    direction === "right"
      ? row.columns.slice(columnIndex + 1)
      : // oxlint-disable-next-line unicorn/no-array-reverse -- This package's ES2022 target has no toReversed, and slice made this a copy.
        row.columns.slice(0, columnIndex).reverse();
  const blocks = columns.find((column) => column.blocks.length > 0)?.blocks;
  return blocks?.[Math.min(place.index, blocks.length - 1)]?.id;
};

/**
 * The Command that moves a Block one step, or nothing if it can't go further. Up
 * and down leave a Column's end for the Row beyond, the same as dragging across,
 * then a Row of its own past the top or bottom of the email. A Block that already
 * has one stays, because every press would otherwise add an empty Row.
 */
export const moveCommand = (
  document: BlocksDocument,
  blockId: string,
  direction: Direction
): Command | undefined => {
  const place = locate(document, blockId);
  if (!place) {
    return;
  }
  const { column, columnIndex, index, row, rowIndex } = place;
  const moveTo = (columnId: string, at: number): Command => ({
    blockId,
    columnId,
    index: at,
    type: "moveBlock",
  });

  if (direction === "left" || direction === "right") {
    const target = row.columns[columnIndex + (direction === "right" ? 1 : -1)];
    return target && moveTo(target.id, Math.min(index, target.blocks.length));
  }

  const down = direction === "down";
  const nextIndex = index + (down ? 1 : -1);
  if (nextIndex >= 0 && nextIndex < column.blocks.length) {
    return moveTo(column.id, nextIndex);
  }
  const nextRow = document.rows[rowIndex + (down ? 1 : -1)];
  if (nextRow) {
    const target =
      nextRow.columns[Math.min(columnIndex, nextRow.columns.length - 1)];
    return target && moveTo(target.id, down ? 0 : target.blocks.length);
  }
  if (row.columns.length === 1 && column.blocks.length === 1) {
    return;
  }
  return {
    blockId,
    rowIndex: down ? document.rows.length : 0,
    type: "moveBlockToNewRow",
  };
};

/** The Command that moves a Row one step, or nothing at either end. */
export const moveRowCommand = (
  document: BlocksDocument,
  rowId: string,
  direction: "down" | "up"
): Command | undefined => {
  const index = document.rows.findIndex(({ id }) => id === rowId);
  const to = index + (direction === "up" ? -1 : 1);
  return index === -1 || to < 0 || to >= document.rows.length
    ? undefined
    : { index: to, rowId, type: "moveRow" };
};

/** The Command for a drop, which adds a Row if it landed outside any. */
export const dropCommand = (source: DragSource, place: DropPlace): Command => {
  if ("rowId" in source) {
    return {
      index: "rowIndex" in place ? place.rowIndex : 0,
      rowId: source.rowId,
      type: "moveRow",
    };
  }
  if ("rowLayout" in source) {
    return {
      index: "rowIndex" in place ? place.rowIndex : 0,
      layout: source.rowLayout as RowLayout,
      type: "insertRow",
    };
  }
  if ("blockId" in source) {
    return "columnId" in place
      ? { ...source, ...place, type: "moveBlock" }
      : { ...source, ...place, type: "moveBlockToNewRow" };
  }
  return "columnId" in place
    ? { ...source, ...place, type: "insertBlock" }
    : { ...source, ...place, type: "insertBlockInNewRow" };
};
