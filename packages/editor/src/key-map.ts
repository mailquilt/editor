/**
 * Every key the editor answers to, for each place it can be pressed: what the
 * key does there, and whether the press stops there. Handlers ask `keyFor` and
 * hold no rules of their own.
 */

export type Direction = "down" | "left" | "right" | "up";

/** Where in the editor a key is pressed, each a place in `editor-places.ts`. */
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
  /** The Preview dialog, and the email in it. */
  | "preview"
  /** The notice shown in place of the editor when there's no room to edit. */
  | "notice";

/**
 * Where a key is heard before it reaches any place in the editor, by the
 * module that's listening then.
 */
export type HeardFirst =
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
  | "backToBlock"
  | "backToText"
  | "cancelLink"
  | "closePreview"
  | "discardDraft"
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
  | "openLinkField"
  | "previousButton"
  | "redo"
  | "selectBlock"
  | "typeInField"
  | "undo";

/** The actions of the arrow keys, which go one way. */
export type DirectedAction = "moveBlock" | "moveRow" | "selectBlock";

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
  keepsDefault?: boolean;
  /** Only with a Block that has text selected, as it acts on that text. */
  needsText?: boolean;
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

const ARROW_KEYS = {
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
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

/** Undo and redo for the whole editor, in place of the browser's own. */
const HISTORY: Entry[] = [
  { action: "undo", keys: ["Mod-z"], stops: true },
  // Where both redo, Ctrl+Y is the one named first.
  { action: "redo", keys: ["Mod-y"], platform: "other", stops: true },
  { action: "redo", keys: ["Shift-Mod-z"], stops: true },
];

/**
 * Browsers use this one to focus their search or address bar, and a host page
 * may use it for its own search, so it reaches the page where it does nothing.
 */
const OPEN_LINK: Entry = {
  action: "openLinkField",
  keys: ["Mod-k"],
  needsText: true,
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
 * they move the cursor by word. Where they do nothing else, they still don't,
 * anywhere in the editor.
 */
const KEEP_PAGE: Entry = {
  action: "keepPage",
  keys: ["Alt-ArrowLeft", "Alt-ArrowRight"],
  platform: "other",
  stops: false,
};

/** An Escape that does none of these reaches the host page, so its dialog can close. */
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
    { ...KEEP_PAGE, stops: true },
    { action: "typeInField", keepsDefault: true, keys: "any", stops: true },
  ],
  rowToolbar: [
    ...arrows("Alt-", { action: "moveRow", stops: false, waitsForDrag: true }),
    KEEP_PAGE,
    ...TOOLBAR,
    OPEN_LINK,
    ...HISTORY,
  ],
  email: [KEEP_PAGE, OPEN_LINK, ...HISTORY],
  panelTabs: [...TOOLBAR, KEEP_PAGE, ...HISTORY],
  // The field has its own undo, as the link field does.
  settingsDraft: [escape("discardDraft"), KEEP_PAGE],
  editor: [KEEP_PAGE, ...HISTORY],
  // The browser closes the dialog. Stopping the press keeps a host's own
  // dialog around the editor open.
  preview: [escape("closePreview", { keepsDefault: true }), KEEP_PAGE],
  notice: [KEEP_PAGE],
};

// oxlint-disable-next-line sort-keys -- In the order of HeardFirst.
const HEARD_FIRST: Record<HeardFirst, readonly Entry<HeardFirstAction>[]> = {
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
  | "deleteForward"
  | "italic"
  | "lineBreak"
  | "newParagraph"
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
 * so Ctrl is Ctrl on every device. The text's other keys, such as Backspace and
 * select all, are ProseMirror's base keys, and do what they do there.
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
  // Only from all the text selected, which some browsers leave alone.
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

/** Keeps the browser from acting on a press, and stops it, as `binding` says. */
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
  /** A Block or Row is being dragged. */
  dragging: boolean;
  /** The selected Block has text. */
  selectedText: boolean;
}

const applies = (
  entry: EntryOptions & { keys: readonly string[] | "any" },
  press: KeyPress,
  { apple, dragging, selectedText }: Context
) => {
  if (entry.keys === "any") {
    return true;
  }
  // An input method's key does nothing in the editor.
  if (
    isComposing(press) ||
    (dragging && entry.waitsForDrag) ||
    (!selectedText && entry.needsText) ||
    !isOnPlatform(entry, apple)
  ) {
    return false;
  }
  return entry.keys.some((name) => matches(name, press, entry, apple));
};

/** Whether a place in the editor has keys of its own here. */
export const hasKeys = (place: string): place is Place =>
  Object.hasOwn(KEY_MAP, place);

/** What the first of `entries` that matches a press does, if one does. */
const bindingIn = <Of extends string>(
  entries: readonly Entry<Of>[],
  press: KeyPress,
  { apple = IS_MAC, dragging = false, selectedText = false }: Partial<Context>
): Binding<Of> | undefined => {
  const entry = entries.find((each) =>
    applies(each, press, { apple, dragging, selectedText })
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

/** What a press in `place` does, or undefined if it isn't the editor's. */
export const keyFor = (
  place: Place,
  press: KeyPress,
  context: Partial<Context> = {}
) => bindingIn(KEY_MAP[place], press, context);

/** What a press heard first does, or undefined if it goes on as usual. */
export const keyHeardFirst = (place: HeardFirst, press: KeyPress) =>
  bindingIn(HEARD_FIRST[place], press, {});

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
      ? `${has("Alt") ? "Alt+" : ""}${has("Shift") ? "⇧" : ""}${has("Mod") ? "⌘" : ""}${shown}`
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

/** How the keys for `action` in `place` are named, from the key map. */
export const keyLabel = (
  place: Place,
  action: Action,
  { apple = IS_MAC, direction }: { apple?: boolean; direction?: Direction } = {}
) =>
  nameAll(
    KEY_MAP[place]
      .filter(
        (entry) =>
          entry.action === action &&
          entry.direction === direction &&
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
