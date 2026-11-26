import type { Place } from "./editor-places.js";
import type { Direction } from "./positions.js";
import type { StringId } from "./strings.js";
import type { Text } from "./text.js";

/**
 * Every key the editor answers to, in each key scope: what the key does there,
 * and whether the press stops there. Handlers ask `keyFor` and hold no rules of
 * their own.
 */

/**
 * A key scope: where in the editor a key is answered. That's the innermost
 * place around the key, in `editor-places.ts`, that has keys here, or a state
 * inside one, such as a Block's text with the Merge Tag picker open.
 */
export type KeyScope = keyof typeof KEY_SCOPES;

/**
 * The key scopes where a key is heard before it reaches any place in the
 * editor, by the module that's listening then.
 */
type HeardFirst =
  /** Anywhere on the page while a Block or Row is dragged. */
  | "drag"
  /** Anywhere on the page while the focused control's tooltip shows. */
  | "focusedTooltip"
  /** Anywhere on the page while a hovered control's tooltip shows. */
  | "hoveredTooltip"
  /** A held key repeating somewhere other than where it was pressed. */
  | "heldElsewhere";

/** What a key heard first does. */
type HeardFirstAction = "cancelDrag" | "closeTooltip" | "ignore";

/** What a key does in the editor. */
export type Action =
  | "addFirstMatch"
  | "backToBlock"
  | "backToText"
  | "cancelLink"
  | "closeAdd"
  | "closeMenu"
  | "closeMergeTagPicker"
  | "closeMore"
  | "closePopover"
  | "closePreview"
  | "closeRowsAdd"
  | "closeStylePopover"
  | "copyBlock"
  | "copyRow"
  | "cutBlock"
  | "cutRow"
  | "deleteBlock"
  | "deleteRow"
  | "discardDraft"
  | "duplicateBlock"
  | "duplicateRow"
  | "editText"
  | "firstButton"
  | "focusFormatBar"
  /** Nothing, but the browser doesn't go back or forward a page. */
  | "keepPage"
  | "lastButton"
  | "leaveToolbar"
  | "moveBlock"
  | "moveRow"
  | "nextButton"
  | "nextFont"
  | "nudgeColor"
  | "nextControl"
  | "nextMergeTag"
  | "openAddPanel"
  | "openLinkField"
  | "paste"
  | "pasteAfterRow"
  | "pickFont"
  | "pickMergeTag"
  | "previousButton"
  | "previousControl"
  | "previousFont"
  | "previousMergeTag"
  | "redo"
  | "selectBlock"
  | "toAddResults"
  | "typeInField"
  | "undo"
  | "unselectRow";

/** The browser's clipboard events, which its keys and its Edit menu fire. */
export type ClipboardEventType = "copy" | "cut" | "paste";

/** The actions done on a clipboard event, rather than the key's press. */
export type ClipboardAction = Extract<
  Action,
  "copyBlock" | "copyRow" | "cutBlock" | "cutRow" | "paste" | "pasteAfterRow"
>;

/** The actions of the arrow keys, which go one way. */
export type DirectedAction =
  | "moveBlock"
  | "moveRow"
  | "nudgeColor"
  | "selectBlock";

/** What happens to a press besides its action. */
interface Effect {
  /** The browser still does its own thing with the key, such as Tab moving focus. */
  keepsDefault: boolean;
  /** The press goes no further: no other handler, nor the host page, hears it. */
  stops: boolean;
}

/** What the editor does with a press, and for an arrow key, which way. */
export type Binding<Of extends string = Action> = Effect &
  (
    | { action: Exclude<Of, DirectedAction>; direction?: undefined }
    | { action: Extract<Of, DirectedAction>; direction: Direction }
  );

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

interface EntryOptions {
  /** Matches with Shift, Ctrl, Alt or ⌘ held too. */
  anyModifiers?: boolean;
  /**
   * The key's action is done on the browser's clipboard event that the key
   * fires, as the Edit menu's is, and the key keeps its default to fire it.
   */
  clipboard?: ClipboardEventType;
  keepsDefault?: boolean;
  /**
   * Only when the editor has what it acts on: a Block with text selected, a
   * Row selected, or a step to undo or redo. Otherwise the press reaches the
   * host page.
   */
  needs?: "canRedo" | "canUndo" | "selectedRow" | "selectedText";
  /** Only on devices other than Apple's. */
  platform?: "other";
  stops: boolean;
  /** Does nothing while a Block or Row is dragged, as it would change them. */
  waitsForDrag?: boolean;
}

/**
 * Keys are names such as "Alt-ArrowUp" or "Shift-Mod-z", where Mod is ⌘ on
 * Apple devices and Ctrl elsewhere. A press matches with exactly those
 * modifiers. "any" is every key, even one an input method handled.
 */
type Entry<Of extends string = Action> = EntryOptions &
  (
    | {
        action: Exclude<Of, DirectedAction>;
        direction?: undefined;
        keys: readonly string[] | "any";
      }
    | {
        action: Extract<Of, DirectedAction>;
        direction: Direction;
        keys: readonly string[];
      }
  );

// oxlint-disable-next-line sort-keys -- In the order they're named in.
const ARROW_KEYS = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
} as const satisfies Record<Direction, string>;

/** One entry for each arrow key, with `prefix` such as "Alt-". */
const arrows = (
  prefix: string,
  entry: EntryOptions & { action: DirectedAction }
): Entry[] =>
  Object.entries(ARROW_KEYS).map(([direction, key]) => ({
    ...entry,
    direction: direction as Direction,
    keys: [`${prefix}${key}`],
  }));

/** Undo and redo for the whole editor, instead of the browser's own. */
const HISTORY: Entry[] = [
  { action: "undo", keys: ["Mod-z"], needs: "canUndo", stops: true },
  // Where both redo, Ctrl+Y is the one named first.
  {
    action: "redo",
    keys: ["Mod-y"],
    needs: "canRedo",
    platform: "other",
    stops: true,
  },
  { action: "redo", keys: ["Shift-Mod-z"], needs: "canRedo", stops: true },
];

/**
 * Browsers use this one to focus their search or address bar, and a host page
 * may use it for its own search, so it reaches the page where it does nothing.
 */
const OPEN_LINK: Entry = {
  action: "openLinkField",
  keys: ["Mod-k"],
  needs: "selectedText",
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

/** Tab leaves a toolbar, or the Selection bar, from its one stop. */
const LEAVE_TOOLBAR = TOOLBAR.filter(({ action }) => action === "leaveToolbar");

/**
 * In a field in the Selection bar with nothing typed: ← at the start of its
 * text and → at the end go on to the bar's control before or after it, and
 * otherwise move the cursor. Tab leaves the bar, as from any of its controls.
 */
const BAR_FIELD: Entry[] = [
  {
    action: "previousControl",
    keepsDefault: true,
    keys: ["ArrowLeft"],
    stops: false,
  },
  {
    action: "nextControl",
    keepsDefault: true,
    keys: ["ArrowRight"],
    stops: false,
  },
  ...LEAVE_TOOLBAR,
];

/**
 * Alt+← and Alt+→ go back and forward a page, except on Apple devices, where
 * they move the cursor by word. Where they do nothing else, they still don't,
 * anywhere in the editor.
 */
const KEEP_PAGE: Entry = {
  action: "keepPage",
  keys: ["Alt-ArrowLeft", "Alt-ArrowRight"],
  platform: "other",
  stops: false,
};

/**
 * Escape, with any modifiers, closing one thing and stopping there. An Escape
 * with nothing to close matches no entry, so it reaches the host page, and its
 * dialog can close.
 */
const escape = <Of extends string>(
  action: Of,
  entry: Partial<EntryOptions> = {}
) => ({
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

/**
 * Ctrl/⌘+D, as the Duplicate buttons. The browser would otherwise bookmark
 * the page.
 */
const duplicate = (action: "duplicateBlock" | "duplicateRow"): Entry => ({
  action,
  keys: ["Mod-d"],
  stops: true,
  waitsForDrag: true,
});

/**
 * Delete and Backspace, as the Delete buttons. Only on a Block or a Row's
 * toolbar, not on a Block's toolbar, and never in text or a field, where they're
 * the text's own.
 */
const remove = (action: "deleteBlock" | "deleteRow"): Entry => ({
  action,
  keys: ["Delete", "Backspace"],
  stops: true,
  waitsForDrag: true,
});

/**
 * Ctrl/⌘+C, X and V. The browser fires its clipboard event for them, as it
 * does from its Edit menu, and that event copies, cuts or pastes, so the press
 * keeps its default. Cut and paste change the email, so they wait for a drag.
 */
const clipboard = (
  event: ClipboardEventType,
  action: ClipboardAction
): Entry => ({
  action,
  clipboard: event,
  keepsDefault: true,
  keys: [{ copy: "Mod-c", cut: "Mod-x", paste: "Mod-v" }[event]],
  stops: true,
  waitsForDrag: event !== "copy",
});

const PASTE = clipboard("paste", "paste");

/**
 * `/` opens the Add panel, from the email and the Selection bar, though not
 * from text or a field, where it's typed. With Shift too, as on a German
 * keyboard, where `/` is Shift+7.
 */
const OPEN_ADD: Entry = {
  action: "openAddPanel",
  keys: ["/", "Shift-/"],
  stops: true,
  waitsForDrag: true,
};

/** Escape closes the Add panel or the picker, and focus goes back. */
const CLOSE_ADD = escape("closeAdd");

/**
 * What a key scope is within, which gives it the keys for there after its own.
 * Alt+← and Alt+→ keep the page from anywhere, as `KEEP_PAGE` says.
 */
type Within =
  /** In the email, where Ctrl/⌘+K, undo and redo work. */
  | "email"
  /** Elsewhere in the editor, such as the top bar, where undo and redo work. */
  | "editor"
  /** A field, with its own typing and undo. */
  | "field"
  /** A Block's text, whose own keys answer what this doesn't. */
  | "text"
  /** Outside the editor, such as the Preview. */
  | "outside";

// oxlint-disable-next-line sort-keys -- From the email outwards.
const KEYS_WITHIN: Record<Within, readonly Entry[]> = {
  email: [OPEN_LINK, ...HISTORY],
  editor: HISTORY,
  field: [],
  text: [],
  outside: [],
};

/** A key scope's keys. */
interface ScopeKeys {
  /** Every key goes no further, and one with no rule here is the field's own. */
  keepsEveryKey?: true;
  /** Its own keys, which come before those for what it's within. */
  keys: readonly Entry[];
  within: Within;
}

// oxlint-disable-next-line sort-keys -- From the email outwards.
const KEY_SCOPES = {
  block: {
    keys: [
      ...arrows("", {
        action: "selectBlock",
        stops: false,
        waitsForDrag: true,
      }),
      ...MOVE_BLOCK,
      // Otherwise the new paragraph lands in the text that just took focus.
      {
        action: "editText",
        anyModifiers: true,
        keys: ["Enter"],
        stops: false,
        waitsForDrag: true,
      },
      duplicate("duplicateBlock"),
      remove("deleteBlock"),
      clipboard("copy", "copyBlock"),
      clipboard("cut", "cutBlock"),
      PASTE,
      OPEN_ADD,
    ],
    within: "email",
  },
  /**
   * A Block's text, or a field that holds text or a URL, while the Merge Tag
   * picker is open, which is asked before their own keys. Focus stays where it
   * is, so this isn't a place. Text and fields add no keys of their own here.
   */
  pickerOpen: {
    keys: [
      { action: "previousMergeTag", keys: ["ArrowUp"], stops: true },
      { action: "nextMergeTag", keys: ["ArrowDown"], stops: true },
      { action: "pickMergeTag", keys: ["Enter", "Tab"], stops: true },
      escape("closeMergeTagPicker"),
    ],
    within: "text",
  },
  // ProseMirror answers TEXT_KEYS and its base keys first, and these never
  // act on a key it answered.
  text: {
    keys: [
      escape("backToBlock"),
      { action: "focusFormatBar", keys: ["Alt-F10"], stops: false },
    ],
    within: "email",
  },
  /**
   * The Selection bar is one stop for Tab, and the arrow keys go along its
   * controls. With a Block selected, its keys are the Block's toolbar's before
   * it: they move and duplicate the Block, and Escape goes back to it. A paste
   * goes after the Block, as on the Block.
   */
  blockBar: {
    keys: [
      escape("backToBlock"),
      ...MOVE_BLOCK,
      duplicate("duplicateBlock"),
      PASTE,
      OPEN_ADD,
      ...TOOLBAR,
    ],
    within: "email",
  },
  formatBar: { keys: [escape("backToText"), ...TOOLBAR], within: "email" },
  linkField: {
    keepsEveryKey: true,
    keys: [escape("cancelLink")],
    within: "field",
  },
  /** With a Row selected, the keys a Row's toolbar had, for that Row. */
  rowBar: {
    keys: [
      // A selected Row's Blocks aren't stops for Tab, so this is the way back
      // to them.
      escape("unselectRow"),
      // A Row moves only up and down, so Alt+← and Alt+→ only keep the page.
      ...arrows("Alt-", {
        action: "moveRow",
        stops: false,
        waitsForDrag: true,
      }).filter(({ direction }) => direction === "up" || direction === "down"),
      duplicate("duplicateRow"),
      remove("deleteRow"),
      clipboard("copy", "copyRow"),
      clipboard("cut", "cutRow"),
      // After this Row, as a paste with a Row selected goes.
      clipboard("paste", "pasteAfterRow"),
      OPEN_ADD,
      ...TOOLBAR,
    ],
    within: "email",
  },
  // With nothing selected, a paste goes at the end, as from the floating
  // toolbar.
  emailBar: { keys: [PASTE, OPEN_ADD, ...TOOLBAR], within: "editor" },
  // Undo and redo are the editor's, as in any settings field with nothing
  // typed, and Delete and Backspace are the field's.
  barField: { keys: BAR_FIELD, within: "editor" },
  barPopover: { keys: [escape("closePopover")], within: "editor" },
  barMenu: { keys: [escape("closeMenu"), ...TOOLBAR], within: "editor" },
  morePanel: { keys: [escape("closeMore")], within: "editor" },
  addBlocks: { keys: [OPEN_ADD], within: "email" },
  /**
   * In the Add panel's or the picker's search: Enter adds the first Block or
   * Row that matches, and ↓ goes to them. Undo and redo are the editor's, as
   * in a field in the Selection bar, so what was just added can be taken back.
   */
  addSearch: {
    keys: [
      CLOSE_ADD,
      { action: "addFirstMatch", keys: ["Enter"], stops: true },
      { action: "toAddResults", keys: ["ArrowDown"], stops: true },
    ],
    within: "editor",
  },
  /**
   * The Rows list's Rows, one stop for Tab, with arrow keys between them, as a
   * toolbar's. Alt+↑ and Alt+↓ move the Row with focus, and Alt+← and Alt+→
   * only keep the page.
   */
  rowsItems: {
    keys: [
      ...arrows("Alt-", {
        action: "moveRow",
        stops: false,
        waitsForDrag: true,
      }).filter(({ direction }) => direction === "up" || direction === "down"),
      OPEN_ADD,
      ...TOOLBAR,
    ],
    within: "editor",
  },
  /** The layouts on an email with no Rows, one stop for Tab. */
  startLayouts: { keys: [OPEN_ADD, ...TOOLBAR], within: "email" },
  /** The layouts from the Rows list's +. Escape closes them, back to the +. */
  rowsAdd: {
    keys: [escape("closeRowsAdd"), ...TOOLBAR],
    within: "editor",
  },
  // One stop for Tab, with arrow keys between them, as a toolbar's.
  addTiles: { keys: [CLOSE_ADD, OPEN_ADD, ...TOOLBAR], within: "editor" },
  addPicker: { keys: [CLOSE_ADD], within: "editor" },
  addPanel: { keys: [CLOSE_ADD], within: "editor" },
  // Where focus goes with nothing selected, such as after the last Block is
  // deleted, so a paste goes at the end.
  emailTools: { keys: [PASTE, OPEN_ADD], within: "editor" },
  // Elsewhere in the email.
  email: { keys: [], within: "email" },
  modes: { keys: TOOLBAR, within: "editor" },
  // Tab leaves the Selection bar from a field in it, and does nothing more
  // elsewhere.
  settingsDraft: {
    keys: [escape("discardDraft"), ...LEAVE_TOOLBAR],
    within: "field",
  },
  listItemTools: { keys: TOOLBAR, within: "editor" },
  /**
   * The Style panel's popovers. Escape closes one, and focus goes back to the
   * setting it's for. Undo and redo are the editor's, as in the Selection bar.
   */
  stylePopover: { keys: [escape("closeStylePopover")], within: "editor" },
  /** The arrow keys change a color's shade, and with Shift, ten times as much. */
  colorArea: {
    keys: [
      ...arrows("", { action: "nudgeColor", stops: true }),
      ...arrows("Shift-", { action: "nudgeColor", stops: true }),
      escape("closeStylePopover"),
    ],
    within: "editor",
  },
  /** ↑ and ↓ go along the fonts that match, and Enter picks the one they're on. */
  fontSearch: {
    keys: [
      { action: "previousFont", keys: ["ArrowUp"], stops: true },
      { action: "nextFont", keys: ["ArrowDown"], stops: true },
      { action: "pickFont", keys: ["Enter"], stops: true },
      escape("closeStylePopover"),
    ],
    within: "editor",
  },
  // Anywhere else in the editor, such as the top bar.
  editor: { keys: [], within: "editor" },
  // The browser closes the dialog. Stopping the press keeps a host's own
  // dialog around the editor open.
  preview: {
    keys: [escape("closePreview", { keepsDefault: true })],
    within: "outside",
  },
  notice: { keys: [], within: "outside" },
} satisfies Partial<Record<Place | "pickerOpen", ScopeKeys>>;

/** In a field that keeps every key, a key with no rule there. */
const TYPE_IN_FIELD: Entry = {
  action: "typeInField",
  keepsDefault: true,
  keys: "any",
  stops: true,
};

/** A key scope's own keys, then those for what it's within. */
const entriesOf = ({ keepsEveryKey, keys, within }: ScopeKeys) => {
  const entries = [...keys, ...KEYS_WITHIN[within], KEEP_PAGE];
  return keepsEveryKey
    ? [...entries.map((entry) => ({ ...entry, stops: true })), TYPE_IN_FIELD]
    : entries;
};

const KEY_MAP = {} as Record<KeyScope, readonly Entry[]>;
for (const [scope, keys] of Object.entries(KEY_SCOPES)) {
  KEY_MAP[scope as KeyScope] = entriesOf(keys);
}

// oxlint-disable-next-line sort-keys -- In the order of HeardFirst.
const HEARD_FIRST: Record<HeardFirst, readonly Entry<HeardFirstAction>[]> = {
  drag: [escape("cancelDrag")],
  // Closing a focused control's tooltip is all Escape does, as it would
  // otherwise also move focus, and the browser would close a host's dialog
  // around the editor. Over another control, it still does what it does with
  // no tooltip.
  focusedTooltip: [escape("closeTooltip")],
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
 * Read by the tests, which take the key scopes from here, and check the
 * keyboard page names every key, and no other.
 */
export { HEARD_FIRST, KEY_MAP, KEY_SCOPES };

// As ProseMirror decides it for Bold and the other text keys, so they all agree.
// A server importing the editor may have no navigator.
const IS_MAC =
  typeof navigator === "object" &&
  /Mac|iPhone|iPod|iPad/u.test(navigator.platform);

const isOnPlatform = (
  { platform }: { platform?: "apple" | "other" },
  apple: boolean
) => platform === undefined || (platform === "apple") === apple;

export type TextAction =
  | "bold"
  | "bulletList"
  | "deleteBackward"
  | "deleteForward"
  | "italic"
  | "lineBreak"
  | "newParagraph"
  | "orderedList"
  | "toEnd"
  | "toStart"
  | "underline";

interface TextEntry {
  action: TextAction;
  /**
   * Keys that work too, but aren't named in tooltips or aria-keyshortcuts,
   * such as Shift+Ctrl+B, which only keeps the browser on Windows and Linux
   * from formatting the text itself.
   */
  aliases?: readonly string[];
  keys: readonly string[];
  /** Only on Apple devices. */
  platform?: "apple";
}

/**
 * Every key a Block's text has a rule for, which ProseMirror answers first, with
 * the command in `text-commands.ts` that each one runs. Names are ProseMirror's,
 * so Ctrl is Ctrl on every device. The text's other keys, such as select all,
 * are ProseMirror's base keys, and do what they do there.
 */
export const TEXT_KEYS: readonly TextEntry[] = [
  { action: "bold", aliases: ["Shift-Mod-b"], keys: ["Mod-b"] },
  { action: "italic", aliases: ["Shift-Mod-i"], keys: ["Mod-i"] },
  { action: "underline", aliases: ["Shift-Mod-u"], keys: ["Mod-u"] },
  { action: "lineBreak", aliases: ["Mod-Enter"], keys: ["Shift-Enter"] },
  // Keeps the formatting, so typing on the new line carries on.
  { action: "newParagraph", keys: ["Enter"] },
  // In an empty paragraph, removes it, even the last one.
  { action: "deleteForward", aliases: ["Mod-Delete"], keys: ["Delete"] },
  // The keys ProseMirror gives Apple devices that delete forward too.
  {
    action: "deleteForward",
    aliases: ["Ctrl-d", "Ctrl-Alt-Backspace", "Alt-Delete", "Alt-d"],
    keys: [],
    platform: "apple",
  },
  // At the start of a List's item, makes it a paragraph, and at the start of
  // the paragraph after a List, joins it to the last item.
  {
    action: "deleteBackward",
    aliases: ["Mod-Backspace", "Shift-Backspace"],
    keys: ["Backspace"],
  },
  // The keys ProseMirror gives Apple devices that delete backward too.
  {
    action: "deleteBackward",
    aliases: ["Ctrl-h", "Alt-Backspace"],
    keys: [],
    platform: "apple",
  },
  // ProseMirror falls back to the key's code with Ctrl or ⌘ held, so these
  // work where Shift+8 or Shift+7 types something else.
  { action: "bulletList", keys: ["Shift-Mod-8"] },
  { action: "orderedList", keys: ["Shift-Mod-7"] },
  // Only from all the text selected, which WebKit on Linux leaves alone once a
  // link is in it.
  { action: "toStart", keys: ["ArrowLeft"] },
  { action: "toEnd", keys: ["ArrowRight"] },
];

/** ProseMirror writes Shift with a letter as the capital: Mod-B, not Shift-Mod-b. */
const proseMirrorName = (name: string) => {
  const modifiers = name.split("-");
  const key = modifiers.pop() ?? "";
  return /^[a-z]$/u.test(key) && modifiers.includes("Shift")
    ? [...modifiers.filter((each) => each !== "Shift"), key.toUpperCase()].join(
        "-"
      )
    : name;
};

/** The text's keys, by ProseMirror's names, with what each does. */
export const proseMirrorKeys = ({ apple = IS_MAC }: { apple?: boolean } = {}): [
  string,
  TextAction,
][] =>
  TEXT_KEYS.filter((entry) => isOnPlatform(entry, apple)).flatMap(
    ({ action, aliases = [], keys }) =>
      [...keys, ...aliases].map((name): [string, TextAction] => [
        proseMirrorName(name),
        action,
      ])
  );

/** WebKit can end a composition first, and then report the key as 229. */
const isComposing = (press: KeyPress) =>
  press.isComposing || press.keyCode === 229;

/**
 * Layouts without Latin letters report their own, so a letter is read from the
 * key's position. Anything else, such as Dvorak's ; where QWERTY has Z, keeps
 * its own name.
 */
const keyOf = ({ code, key }: KeyPress) => {
  if (/^[A-Za-z]$/u.test(key)) {
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
  { anyModifiers = false }: EntryOptions,
  apple: boolean
) => {
  const modifiers = name.split("-");
  const key = modifiers.pop();
  if (key !== keyOf(press)) {
    return false;
  }
  if (anyModifiers) {
    return true;
  }
  const mod = apple ? press.metaKey : press.ctrlKey;
  const other = apple ? press.ctrlKey : press.metaKey;
  return (
    press.altKey === modifiers.includes("Alt") &&
    press.shiftKey === modifiers.includes("Shift") &&
    mod === modifiers.includes("Mod") &&
    !other
  );
};

/** Keeps the browser from acting on a press, and stops it, as its effect says. */
export const claim = (event: Event, { keepsDefault, stops }: Effect) => {
  if (!keepsDefault) {
    event.preventDefault();
  }
  if (stops) {
    event.stopPropagation();
  }
};

/** What a press depends on besides where it is. */
interface Context {
  /** An Apple device, where Mod is ⌘. */
  apple: boolean;
  /** There's a step to redo. */
  canRedo: boolean;
  /** There's a step to undo. */
  canUndo: boolean;
  /** A Block or Row is being dragged. */
  dragging: boolean;
  /** A Row is selected. */
  selectedRow: boolean;
  /** The selected Block has text. */
  selectedText: boolean;
}

const applies = (
  entry: EntryOptions & { keys: readonly string[] | "any" },
  press: KeyPress,
  context: Context
) => {
  const { apple, dragging } = context;
  if (entry.keys === "any") {
    return true;
  }
  // An input method's key does nothing in the editor.
  if (
    isComposing(press) ||
    (dragging && entry.waitsForDrag) ||
    (entry.needs !== undefined && !context[entry.needs]) ||
    !isOnPlatform(entry, apple)
  ) {
    return false;
  }
  return entry.keys.some((name) => matches(name, press, entry, apple));
};

/** Whether a place in the editor has keys of its own here. */
export const hasKeys = (place: string): place is Extract<KeyScope, Place> =>
  Object.hasOwn(KEY_MAP, place);

/** What the first of `entries` that matches a press does, if one does. */
const bindingIn = <Of extends string>(
  entries: readonly Entry<Of>[],
  press: KeyPress,
  {
    apple = IS_MAC,
    canRedo = false,
    canUndo = false,
    dragging = false,
    selectedRow = false,
    selectedText = false,
  }: Partial<Context>
): Binding<Of> | undefined => {
  const entry = entries.find((each) =>
    applies(each, press, {
      apple,
      canRedo,
      canUndo,
      dragging,
      selectedRow,
      selectedText,
    })
  );
  if (!entry) {
    return undefined;
  }
  const effect = {
    keepsDefault: entry.keepsDefault ?? false,
    stops: entry.stops,
  };
  return entry.direction === undefined
    ? { action: entry.action, ...effect }
    : { action: entry.action, direction: entry.direction, ...effect };
};

/** What a press in `scope` does, or undefined if it isn't the editor's. */
export const keyFor = (
  scope: KeyScope,
  press: KeyPress,
  context: Partial<Context> = {}
) => bindingIn(KEY_MAP[scope], press, context);

/**
 * What the browser's clipboard event does in `scope`, from its keys or its Edit
 * menu, or undefined if it's left to the browser, as in text and fields.
 */
export const clipboardFor = (
  scope: KeyScope,
  type: ClipboardEventType,
  { dragging = false }: Partial<Pick<Context, "dragging">> = {}
) =>
  KEY_MAP[scope].find(
    (entry) => entry.clipboard === type && !(dragging && entry.waitsForDrag)
  )?.action as ClipboardAction | undefined;

/** What a press heard first does, or undefined if it goes on as usual. */
export const keyHeardFirst = (scope: HeardFirst, press: KeyPress) =>
  bindingIn(HEARD_FIRST[scope], press, {});

/** The keys `KeyLabel` names in words, and their texts. */
const KEY_TEXTS: Readonly<Record<string, StringId>> = {
  Alt: "key.alt",
  ArrowDown: "key.arrowDown",
  ArrowLeft: "key.arrowLeft",
  ArrowRight: "key.arrowRight",
  ArrowUp: "key.arrowUp",
  Backspace: "key.backspace",
  Ctrl: "key.ctrl",
  Delete: "key.delete",
  End: "key.end",
  Enter: "key.enter",
  Escape: "key.escape",
  Home: "key.home",
  Shift: "key.shift",
  Tab: "key.tab",
};

const KEY_WORD = new RegExp(
  `\\b(?:${Object.keys(KEY_TEXTS).join("|")})\\b`,
  "gu"
);

/**
 * Keys as a `KeyLabel` names them, with each key that has a name in words in
 * the editor's own, such as Ctrl for a German keyboard's Strg. A letter or a
 * symbol, such as ⌘ or ↑, stays as it is.
 */
export const keysInWords = (keys: string, text: Text) =>
  keys.replaceAll(KEY_WORD, (name) => text(KEY_TEXTS[name] as StringId));

/** A tooltip that names a control and its keys, such as "Undo (Ctrl+Z)". */
export const withKeys = (label: string, keys: string, text: Text) =>
  text("withKeys", { keys: keysInWords(keys, text), label });

/** How a key is named for people. */
export interface KeyLabel {
  /** As a tooltip shows it, such as "Ctrl+Z", or "⌘Z" on Apple devices. */
  keys: string;
  /** As `aria-keyshortcuts` names it, such as "Control+Z". */
  shortcuts: string;
}

const ARROW_SYMBOLS: Record<string, string> = {
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
};

const nameOne = (name: string, apple: boolean): KeyLabel => {
  const modifiers = name.split("-");
  const key = modifiers.pop() ?? "";
  const has = (modifier: string) => modifiers.includes(modifier);
  const base = key.length === 1 ? key.toUpperCase() : key;
  const shown = ARROW_SYMBOLS[key] ?? (apple && key === "Enter" ? "↩" : base);
  return {
    keys: apple
      ? `${has("Alt") ? "⌥" : ""}${has("Shift") ? "⇧" : ""}${has("Mod") ? "⌘" : ""}${shown}`
      : [
          has("Mod") && "Ctrl",
          has("Alt") && "Alt",
          has("Shift") && "Shift",
          shown,
        ]
          .filter(Boolean)
          .join("+"),
    shortcuts: [
      has("Mod") && (apple ? "Meta" : "Control"),
      has("Alt") && "Alt",
      has("Shift") && "Shift",
      base,
    ]
      .filter(Boolean)
      .join("+"),
  };
};

/** The first name for a tooltip, and every one for `aria-keyshortcuts`. */
const nameAll = (names: readonly string[], apple: boolean): KeyLabel => {
  const [first] = names;
  if (first === undefined) {
    throw new Error("The key map has no key to name");
  }
  return {
    keys: nameOne(first, apple).keys,
    shortcuts: names.map((name) => nameOne(name, apple).shortcuts).join(" "),
  };
};

/**
 * How the keys for `action` in `scope` are named, from the key map. For an
 * arrow key's action, `direction` names one way, or else they're all named.
 */
export const keyLabel = (
  scope: KeyScope,
  action: Action,
  { apple = IS_MAC, direction }: { apple?: boolean; direction?: Direction } = {}
) =>
  nameAll(
    KEY_MAP[scope]
      .filter(
        (entry) =>
          entry.action === action &&
          (direction === undefined || entry.direction === direction) &&
          isOnPlatform(entry, apple)
      )
      .flatMap(({ keys }) => (keys === "any" ? [] : keys)),
    apple
  );

/** How the keys for a text action are named. */
export const textKeyLabel = (
  action: TextAction,
  { apple = IS_MAC }: { apple?: boolean } = {}
) =>
  nameAll(
    TEXT_KEYS.filter(
      (entry) => entry.action === action && isOnPlatform(entry, apple)
    ).flatMap(({ keys }) => keys),
    apple
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
