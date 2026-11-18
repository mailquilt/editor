/**
 * Every key the editor answers to, for each place it can be pressed: what the
 * key does there, and whether the press stops there. Handlers ask `keyFor` and
 * hold no rules of their own.
 */

export type Direction = "down" | "left" | "right" | "up";

/** Where a key is pressed. */
export type Place =
  /** On a Block itself. */
  | "block"
  /** In a Block's text, after ProseMirror has passed on the key. */
  | "text"
  /** The selected Block's toolbar. */
  | "blockToolbar"
  /** The format bar beside the text being edited. */
  | "formatBar"
  /** The link field, in the format bar. */
  | "linkField"
  /** A Row's toolbar. */
  | "rowToolbar"
  /** Elsewhere in the email, such as an empty Column's buttons. */
  | "email"
  /** The side panel's tabs. */
  | "panelTabs"
  /** A settings field holding typed text that isn't applied yet. */
  | "settingsDraft"
  /** Anywhere else in the editor, such as the side panel or floating toolbar. */
  | "editor"
  /** The Preview dialog. */
  | "preview"
  /** Anywhere on the page while a Block or Row is dragged, heard first. */
  | "drag"
  /** Anywhere on the page while the focused control's tooltip shows, heard first. */
  | "focusedTooltip"
  /** Anywhere on the page while a hovered control's tooltip shows, heard first. */
  | "hoveredTooltip"
  /** A held key repeating somewhere other than where it was pressed, heard first. */
  | "heldElsewhere";

/** What a key does. */
export type Action =
  | "backToBlock"
  | "backToText"
  | "cancelDrag"
  | "cancelLink"
  | "closePreview"
  | "closeTooltip"
  | "discardDraft"
  | "editText"
  | "firstButton"
  | "focusFormatBar"
  | "ignore"
  /** Nothing, but the browser doesn't go back or forward a page. */
  | "keepPage"
  | "lastButton"
  | "leaveToolbar"
  | "moveBlock"
  | "moveRow"
  | "nextButton"
  | "openLinkField"
  | "previousButton"
  | "redo"
  | "selectBlock"
  | "typeInField"
  | "undo";

/** What the editor does with a press. */
export interface Binding {
  action: Action;
  /** For an arrow key, which way. */
  direction?: Direction;
  /** The browser still does its own thing with the key, such as Tab moving focus. */
  keepsDefault: boolean;
  /** The press goes no further: no other handler, nor the host page, hears it. */
  stops: boolean;
}

/** What `keyFor` reads of a key press, so a test can make one. */
export type KeyPress = Pick<
  KeyboardEvent,
  | "altKey"
  | "code"
  | "ctrlKey"
  | "isComposing"
  | "key"
  | "keyCode"
  | "metaKey"
  | "shiftKey"
>;

interface Entry {
  action: Action;
  /** Matches with Shift, Ctrl, Alt or ⌘ held too. */
  anyModifiers?: boolean;
  direction?: Direction;
  keepsDefault?: boolean;
  /**
   * Names such as "Alt-ArrowUp" or "Shift-Mod-z", where Mod is ⌘ on Apple
   * devices and Ctrl elsewhere. A press matches with exactly those modifiers.
   * "any" is every key, even one an input method handled.
   */
  keys: readonly string[] | "any";
  /** Only on Apple devices, or only elsewhere. */
  platform?: "apple" | "other";
  stops: boolean;
  /** Does nothing while a Block or Row is dragged, as it would change them. */
  waitsForDrag?: boolean;
}

const ARROW_KEYS = {
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
} as const satisfies Record<Direction, string>;

/** One entry for each arrow key, with `prefix` such as "Alt-". */
const arrows = (
  prefix: string,
  entry: Omit<Entry, "direction" | "keys">
): Entry[] =>
  Object.entries(ARROW_KEYS).map(([direction, key]) => ({
    ...entry,
    direction: direction as Direction,
    keys: [`${prefix}${key}`],
  }));

/** Undo and redo for the whole editor, in place of the browser's own. */
const HISTORY: Entry[] = [
  { action: "undo", keys: ["Mod-z"], stops: true },
  { action: "redo", keys: ["Shift-Mod-z"], stops: true },
  { action: "redo", keys: ["Mod-y"], platform: "other", stops: true },
];

/**
 * Browsers use this one to focus their search or address bar, and a host page
 * may use it for its own search.
 */
const OPEN_LINK: Entry = {
  action: "openLinkField",
  keys: ["Mod-k"],
  stops: true,
};

/**
 * Arrow keys, Home and End go along a toolbar's own buttons, either way up. Tab
 * leaves from the toolbar's one stop, wherever the arrow keys got to, so
 * Shift+Tab doesn't land back on that stop.
 */
const TOOLBAR: Entry[] = [
  {
    action: "previousButton",
    keys: ["ArrowLeft", "ArrowUp"],
    stops: false,
  },
  {
    action: "nextButton",
    keys: ["ArrowDown", "ArrowRight"],
    stops: false,
  },
  { action: "firstButton", keys: ["Home"], stops: false },
  { action: "lastButton", keys: ["End"], stops: false },
  {
    action: "leaveToolbar",
    anyModifiers: true,
    keepsDefault: true,
    keys: ["Tab"],
    stops: false,
  },
];

/**
 * Alt+← and Alt+→ go back and forward a page, except on Apple devices, where
 * they move the cursor by word. Where they do nothing else, they still don't.
 */
const KEEP_PAGE: Entry = {
  action: "keepPage",
  keys: ["Alt-ArrowLeft", "Alt-ArrowRight"],
  platform: "other",
  stops: false,
};

/** An Escape that does none of these reaches the host page, so its dialog can close. */
const escape = (action: Action, entry: Partial<Entry> = {}): Entry => ({
  action,
  anyModifiers: true,
  keys: ["Escape"],
  stops: true,
  ...entry,
});

/**
 * The Blocks and Rows would change under a drag that's still going. With Alt+←
 * or Alt+→, a drag leaves the page where it is instead.
 */
const MOVE_BLOCK = arrows("Alt-", {
  action: "moveBlock",
  stops: false,
  waitsForDrag: true,
});

// oxlint-disable-next-line sort-keys -- In the order of Place.
const KEY_MAP: Record<Place, readonly Entry[]> = {
  block: [
    ...arrows("", { action: "selectBlock", stops: false, waitsForDrag: true }),
    ...MOVE_BLOCK,
    KEEP_PAGE,
    // Otherwise the new paragraph lands in the text that just took focus.
    {
      action: "editText",
      anyModifiers: true,
      keys: ["Enter"],
      stops: false,
      waitsForDrag: true,
    },
    OPEN_LINK,
    ...HISTORY,
  ],
  // ProseMirror answers TEXT_KEYS before these.
  text: [
    escape("backToBlock"),
    KEEP_PAGE,
    { action: "focusFormatBar", keys: ["Alt-F10"], stops: false },
    OPEN_LINK,
    ...HISTORY,
  ],
  blockToolbar: [
    escape("backToBlock"),
    ...MOVE_BLOCK,
    KEEP_PAGE,
    ...TOOLBAR,
    OPEN_LINK,
    ...HISTORY,
  ],
  formatBar: [
    escape("backToText"),
    ...TOOLBAR,
    KEEP_PAGE,
    OPEN_LINK,
    ...HISTORY,
  ],
  // The field has its own typing and undo.
  linkField: [
    escape("cancelLink"),
    { action: "typeInField", keepsDefault: true, keys: "any", stops: true },
  ],
  rowToolbar: [
    ...arrows("Alt-", { action: "moveRow", stops: false, waitsForDrag: true }),
    KEEP_PAGE,
    ...TOOLBAR,
    OPEN_LINK,
    ...HISTORY,
  ],
  email: [OPEN_LINK, ...HISTORY],
  panelTabs: [...TOOLBAR, ...HISTORY],
  // The field has its own undo, as the link field does.
  settingsDraft: [escape("discardDraft")],
  editor: HISTORY,
  // The browser closes the dialog. Stopping the press keeps a host's own
  // dialog around the editor open.
  preview: [escape("closePreview", { keepsDefault: true })],
  drag: [escape("cancelDrag")],
  // Closing a focused control's tooltip is all Escape does, as it would
  // otherwise also move focus. Over another control, it still does what it
  // does with no tooltip.
  focusedTooltip: [escape("closeTooltip", { keepsDefault: true })],
  hoveredTooltip: [
    escape("closeTooltip", { keepsDefault: true, stops: false }),
  ],
  // Enter that moved focus into a Block's text would otherwise keep
  // repeating there, adding empty paragraphs.
  heldElsewhere: [
    { action: "ignore", anyModifiers: true, keys: ["Enter"], stops: true },
  ],
};

/**
 * In a Block's text, ProseMirror answers these first, by its own names for
 * keys. Mod-B is with Shift too, or the browser would format the text itself on
 * Windows and Linux. ← and → act only on all the text selected. The text's
 * other keys, such as Backspace, are ProseMirror's own.
 */
export const TEXT_KEYS = {
  ArrowLeft: "toStart",
  ArrowRight: "toEnd",
  "Mod-B": "bold",
  "Mod-Enter": "lineBreak",
  "Mod-I": "italic",
  "Mod-U": "underline",
  "Mod-b": "bold",
  "Mod-i": "italic",
  "Mod-u": "underline",
  "Shift-Enter": "lineBreak",
} as const;

export type TextAction = (typeof TEXT_KEYS)[keyof typeof TEXT_KEYS];

// As ProseMirror decides it for Bold and the other text keys, so they all agree.
// A server importing the editor may have no navigator.
const IS_MAC =
  typeof navigator === "object" &&
  /Mac|iPhone|iPod|iPad/u.test(navigator.platform);

/** WebKit can end a composition first, and then report the key as 229. */
const isComposing = (press: KeyPress) =>
  press.isComposing || press.keyCode === 229;

/**
 * Layouts without Latin letters report their own, so a letter is read from the
 * key's position. Anything else, such as Dvorak's ; where QWERTY has Z, keeps
 * its own name.
 */
const keyOf = ({ code, key }: KeyPress) => {
  if (/^[a-z]$/iu.test(key)) {
    return key.toLowerCase();
  }
  return /^Key[A-Z]$/u.test(code) && /^\p{L}$/u.test(key)
    ? code.slice(3).toLowerCase()
    : key;
};

/**
 * Command on Apple devices, and Ctrl elsewhere. Not either, because on a Mac
 * Ctrl+K and Ctrl+Y delete to the end of the line and put it back.
 */
const matches = (
  name: string,
  press: KeyPress,
  { anyModifiers = false }: Entry,
  apple: boolean
) => {
  const modifiers = name.split("-");
  const key = modifiers.pop();
  const mod = apple ? press.metaKey : press.ctrlKey;
  const other = apple ? press.ctrlKey : press.metaKey;
  if (key !== keyOf(press) || anyModifiers) {
    return key === keyOf(press);
  }
  return (
    press.altKey === modifiers.includes("Alt") &&
    press.shiftKey === modifiers.includes("Shift") &&
    mod === modifiers.includes("Mod") &&
    !other
  );
};

/** Keeps the browser from acting on a press, and stops it, as `binding` says. */
export const claim = (event: Event, { keepsDefault, stops }: Binding) => {
  if (!keepsDefault) {
    event.preventDefault();
  }
  if (stops) {
    event.stopPropagation();
  }
};

const applies = (
  entry: Entry,
  press: KeyPress,
  { apple, dragging }: { apple: boolean; dragging: boolean }
) => {
  if (entry.keys === "any") {
    return true;
  }
  // An input method's key does nothing in the editor.
  if (
    isComposing(press) ||
    (dragging && entry.waitsForDrag) ||
    (entry.platform !== undefined && (entry.platform === "apple") !== apple)
  ) {
    return false;
  }
  return entry.keys.some((name) => matches(name, press, entry, apple));
};

/**
 * What a press in `place` does, or undefined if it isn't the editor's. The
 * first entry for the place that matches answers.
 */
export const keyFor = (
  place: Place,
  press: KeyPress,
  {
    apple = IS_MAC,
    dragging = false,
  }: { apple?: boolean; dragging?: boolean } = {}
): Binding | undefined => {
  const entry = KEY_MAP[place].find((each) =>
    applies(each, press, { apple, dragging })
  );
  return (
    entry && {
      action: entry.action,
      ...(entry.direction && { direction: entry.direction }),
      keepsDefault: entry.keepsDefault ?? false,
      stops: entry.stops,
    }
  );
};

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

/** Undo and redo from the browser's own menu, or WebKit's, in a Block's text. */
export const historyInput = (event: InputEvent) => {
  if (event.inputType === "historyUndo") {
    return "undo";
  }
  if (event.inputType === "historyRedo") {
    return "redo";
  }
};
