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

// As ProseMirror decides it for Bold and the other text keys, so they all agree.
// A server importing the editor may have no navigator.
const IS_MAC =
  typeof navigator === "object" &&
  /Mac|iPhone|iPod|iPad/u.test(navigator.platform);
/** How a shortcut with Ctrl, or Command on Apple devices, is written. */
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl+";
/** The same key, as `aria-keyshortcuts` names it. */
export const MOD_SHORTCUT = IS_MAC ? "Meta" : "Control";
export const UNDO_KEYS = `${MOD_KEY}Z`;
export const LINE_BREAK_KEYS = IS_MAC ? "⇧↩" : "Shift+Enter";
export const REDO_KEYS = IS_MAC ? "⇧⌘Z" : "Ctrl+Y";
export const UNDO_SHORTCUTS = `${MOD_SHORTCUT}+Z`;
export const REDO_SHORTCUTS = IS_MAC
  ? "Meta+Shift+Z"
  : "Control+Y Control+Shift+Z";

/**
 * Command on Apple devices, and Ctrl elsewhere. Not either, because on a Mac
 * Ctrl+K and Ctrl+Y delete to the end of the line and put it back.
 */
const hasModKey = (event: KeyboardEvent) =>
  IS_MAC ? event.metaKey : event.ctrlKey;

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

/**
 * Arrow keys, Home and End go along a toolbar's own buttons, either way up. With
 * a modifier they're left alone, as Alt+↑ is a shortcut to move a Block. Tab
 * leaves from the toolbar's one stop, wherever the arrow keys got to, so
 * Shift+Tab doesn't land back on that stop.
 */
export const onToolbarArrowKeys = (event: KeyboardEvent) => {
  const toolbar = event.currentTarget as HTMLElement;
  const buttons = [
    ...toolbar.querySelectorAll<HTMLButtonElement>(
      ":scope > button:not(:disabled)"
    ),
  ];
  const index = buttons.indexOf(event.target as HTMLButtonElement);
  if (index === -1) {
    return;
  }
  if (event.key === "Tab") {
    // Focus moves on from wherever it is once this returns.
    buttons.find((button) => button.tabIndex === 0)?.focus();
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }
  const last = buttons.length - 1;
  const previous = index === 0 ? last : index - 1;
  const following = index === last ? 0 : index + 1;
  const next: number | undefined = {
    ArrowDown: following,
    ArrowLeft: previous,
    ArrowRight: following,
    ArrowUp: previous,
    End: last,
    Home: 0,
  }[event.key];
  if (next !== undefined) {
    event.preventDefault();
    buttons[next]?.focus();
  }
};

/** Layouts without Latin letters report their own, so use the key's position. */
const shortcutKey = (event: KeyboardEvent) =>
  /^[a-z]$/iu.test(event.key)
    ? event.key.toLowerCase()
    : event.code.replace("Key", "").toLowerCase();

/** WebKit can end a composition first, and then report the key as 229. */
export const isComposing = (event: KeyboardEvent) =>
  event.isComposing || event.keyCode === 229;

export const isLinkShortcut = (event: KeyboardEvent) =>
  !(isComposing(event) || event.altKey || event.shiftKey) &&
  hasModKey(event) &&
  shortcutKey(event) === "k";

export const historyShortcut = (event: KeyboardEvent) => {
  if (isComposing(event) || event.altKey || !hasModKey(event)) {
    return;
  }
  const key = shortcutKey(event);
  if (key === "z") {
    return event.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && !IS_MAC && !event.shiftKey) {
    return "redo";
  }
};

export const historyInput = (event: InputEvent) => {
  if (event.inputType === "historyUndo") {
    return "undo";
  }
  if (event.inputType === "historyRedo") {
    return "redo";
  }
};
