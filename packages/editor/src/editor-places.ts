/**
 * The places in the editor that key handling, focus, presses and drags find,
 * each declared here once. An element is one by its `data-place`, and code finds
 * the editor's own elements only through this module, never by a class, which
 * is for styles. An element takes its `data-place` from `place`, so every name
 * is one of these, and a place with keys of its own has them in the key map
 * under its name, which has to be one of these too.
 */
const PLACES = {
  /** The button in an empty Column that opens the picker there. */
  addBlocks: {},
  /** The Add panel, of Block types and empty Rows. */
  addPanel: {},
  /** The picker that adds a Block at a place on the Canvas. */
  addPicker: {},
  /** The search in the Add panel or the picker. */
  addSearch: {},
  /**
   * A group of the Add panel's or the picker's tiles. A press keeps focus
   * where it is, such as in a Block's text, as a press that starts a drag
   * from a tile and ends back on it adds nothing.
   */
  addTiles: { press: "keepsFocus" },
  /** A Block on the canvas. Its `data-block-id` names it. */
  block: {},
  /** A popover from a button in the Selection bar, with settings in it. */
  barPopover: {},
  /** The menu from the Selection bar's chip, of what's around the selection. */
  barMenu: {},
  /**
   * A field in the Selection bar that's typed in, such as a Button's link. The
   * arrow keys go on to the bar's other controls from either end of its text.
   */
  barField: {},
  /** The Selection bar while a Block is selected. */
  blockBar: { press: "keepsFocus" },
  /** A Column. Its `data-column-id` names it. */
  column: {},
  /**
   * A button in More's Box that opens a popover, as the bar's do. A press
   * keeps focus where it is, as on the bar.
   */
  boxOpener: { press: "keepsFocus" },
  /** The Selection bar while a Column is selected. */
  columnBar: { press: "keepsFocus" },
  /**
   * Buttons that act on the email or what's selected, in the top bar or its
   * menu on a phone, and aren't in a toolbar or the Selection bar.
   */
  controls: { press: "keepsFocus" },
  /** A drag handle, on a Block. */
  dragHandle: { press: "grabs" },
  /** The line that shows where a drop would land. */
  dropIndicator: {},
  /** The editor's frame, with the top bar and the Modes, beside the Preview. */
  editor: {},
  /** The email on the canvas. */
  email: {},
  /** The floating toolbar. */
  emailTools: { press: "keepsFocus" },
  /**
   * The Merge Tag picker under a field that holds text or a URL. Focus stays
   * in the field, so a press picks a tag without taking it, or committing the
   * field, in the Selection bar or More too.
   */
  fieldMergeTagPicker: { press: "asBrowser" },
  /** The format bar beside the text being edited. */
  formatBar: { ofText: true, press: "keepsFocus" },
  /** The link field, in the format bar. */
  linkField: { ofText: true },
  /**
   * The toolbar of an item in a list field, in the settings, which moves or
   * removes it.
   */
  listItemTools: { press: "keepsFocus" },
  /**
   * The Merge Tag picker, at the cursor in the text being edited. Focus stays
   * in the text, so a press picks a tag without taking it.
   */
  mergeTagPicker: { ofText: true, press: "keepsFocus" },
  /** Undo and Redo, in the top bar. Each has its `data-action`. */
  history: { press: "keepsFocus" },
  /** The Modes, Edit, Style and Check, in the top bar. */
  modes: {},
  /**
   * The Selection bar's More panel: the settings that don't fit the bar, and
   * the less common actions.
   */
  morePanel: { press: "keepsFocus" },
  /** Check's panel of Problems, and what passed. */
  checkPanel: {},
  /** Check's tabs, Inbox, Plain text and HTML, one Tab stop. */
  checkViews: {},
  /** The Problem a fix button opened Edit for, under the field to fix. */
  fixNote: {},
  /** A + between two Blocks, which opens the picker there. */
  insertPoint: { press: "keepsFocus" },
  /**
   * A tile in the Add panel, which a drag adds. Its `data-block-type` or
   * `data-row-layout` names it.
   */
  paletteItem: {},
  /** The email in Check's inbox, at desktop or phone width. */
  inbox: {},
  /** A Row with its tag. Its `data-row-id` names it. */
  row: {},
  /** The Selection bar while a Row is selected. */
  rowBar: { press: "keepsFocus" },
  /** The tag that selects a Row, and drags it. */
  rowTag: { press: "grabs" },
  /**
   * The Rows list beside the Canvas. A press keeps focus where it is, until
   * what it does moves it, as a press on a Row there may start a drag.
   */
  rowsList: { press: "keepsFocus" },
  /**
   * The Rows list's Rows, each a button that selects its Row, by its
   * `data-row-id`, and drags it. One stop for Tab, with arrow keys between them.
   */
  rowsItems: {},
  /** On a phone, the Rows list as a sheet, from the top bar's menu. */
  rowsSheet: {},
  /** On a phone, the top bar's menu, a sheet of what the top bar has no room for. */
  topMenu: {},
  /** On a phone, the top bar's button that opens its menu. */
  topMenuButton: {},
  /** The layouts from the Rows list's +, which add an empty Row. */
  rowsAdd: {},
  /** The layouts on an email with no Rows, which add its first. */
  startLayouts: {},
  /** The line in the Rows list that shows where a dragged Row would land. */
  rowsDropIndicator: {},
  /** A Row's picture in the Rows list, which is sized as it's drawn. */
  rowPicture: {},
  /** A Starter email's picture on the start screen, scaled to its card. */
  starterPicture: {},
  /** The Selection bar with nothing selected, which has the email's settings. */
  emailBar: { press: "keepsFocus" },
  /** Settings fields, in a popover from the Selection bar or its More panel. */
  settings: {},
  /** A settings field holding typed text that isn't applied yet. */
  settingsDraft: {},
  /** A switch in the Selection bar holding a change that was refused. */
  barSwitchDraft: {},
  /** A Block's text, made by ProseMirror. */
  text: {},
  /** The Style Mode's panel, of the email's Email style. */
  stylePanel: {},
  /** A popover from the Style panel, with a color, size or font to pick. */
  stylePopover: {},
  /** The square in a color popover that picks a color's shade. */
  colorArea: {},
  /** The search in a font popover, which picks from the fonts under it. */
  fontSearch: {},
  /** The editor's one tooltip. */
  tooltip: {},
  /** The workspace around the email. */
  workspace: {},
} satisfies Record<string, Traits>;

/**
 * What a press with the pointer does to focus there, beyond what the browser
 * does. A place that `grabs` starts a drag, and one that `keepsFocus` acts on
 * what's selected, though a field in it still takes focus: each leaves focus
 * and the selection where they are. One `asBrowser`, in a place that does
 * otherwise, such as the Merge Tag picker under a field in the Selection bar,
 * does only what the browser does, and what the place does itself.
 */
type Press = "asBrowser" | "grabs" | "keepsFocus";

/** What a place is, beyond its name. */
interface Traits {
  /**
   * It belongs to the text being edited, beside it, as the format bar does. The
   * text goes on being edited while focus is in it, and focus goes back to the
   * text when it closes. A press in it doesn't show the Block's settings.
   */
  ofText?: true;
  press?: Press;
}

export type Place = keyof typeof PLACES;

/** The places that belong to the text being edited. */
const OF_TEXT = (Object.keys(PLACES) as Place[]).filter(
  (name) => "ofText" in PLACES[name]
);

/** The `data-place` of an element that's `name`. */
export const place = (name: Place) => name;

/** The copy that follows the pointer during a drag is no place. */
const NOT_GHOST = ":not([data-drag-ghost], [data-drag-ghost] *)";

const selectorOf = (places: readonly Place[]) =>
  places.map((name) => `[data-place="${name}"]${NOT_GHOST}`).join(", ");

const ANY_PLACE = `[data-place]${NOT_GHOST}`;

/** The innermost of `places` that `element` is in, or is. */
export const closestPlace = (element: Element, ...places: Place[]) =>
  element.closest<HTMLElement>(selectorOf(places));

/** Whether `element` is in a place that belongs to the text being edited. */
export const isOfText = (element: Element) =>
  closestPlace(element, ...OF_TEXT) !== null;

/** The first place called `name` in `root`, in document order. */
export const findPlace = (root: ParentNode, name: Place) =>
  root.querySelector<HTMLElement>(selectorOf([name]));

/** Every place called `name` in `root`, in document order. */
export const findPlaces = (root: ParentNode, name: Place) => [
  ...root.querySelectorAll<HTMLElement>(selectorOf([name])),
];

/** A Block on the canvas by its ID. */
export const findBlock = (root: ParentNode, blockId: string) =>
  root.querySelector<HTMLElement>(
    `${selectorOf(["block"])}[data-block-id="${CSS.escape(blockId)}"]`
  );

/** A Row on the canvas by its ID. */
export const findRow = (root: ParentNode, rowId: string) =>
  root.querySelector<HTMLElement>(
    `${selectorOf(["row"])}[data-row-id="${CSS.escape(rowId)}"]`
  );

/**
 * The innermost place `element` is in, or is, that `accepts` takes, such as
 * one with keys of its own.
 */
export const placeOf = <Accepted extends Place>(
  element: Element,
  accepts: (name: string) => name is Accepted
): Accepted | undefined => {
  for (
    let at = element.closest<HTMLElement>(ANY_PLACE);
    at;
    at = at.parentElement?.closest<HTMLElement>(ANY_PLACE) ?? null
  ) {
    const { place: name = "" } = at.dataset;
    if (accepts(name)) {
      return name;
    }
  }
  return undefined;
};

const hasPress = (name: string): name is Place =>
  Object.hasOwn(PLACES, name) && "press" in PLACES[name as Place];

/** What a press on `element` does, from the innermost place around it that says. */
export const pressOn = (element: Element): Press | undefined => {
  const name = placeOf(element, hasPress);
  const entry: Traits | undefined = name && PLACES[name];
  return entry?.press;
};
