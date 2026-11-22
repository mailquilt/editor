/**
 * The places in the editor that key handling, focus, presses and drags find,
 * each declared here once. An element is one by its `data-place`, and code finds
 * the editor's own elements only through this module, never by a class, which
 * is for styles. An element takes its `data-place` from `place`, so every name
 * is one of these, and a place with keys of its own has them in the key map
 * under its name, which has to be one of these too.
 */
const PLACES = {
  /** The toolbar in an empty Column, with a button to add each type of Block. */
  addBlocks: {},
  /** A Block on the canvas. Its `data-block-id` names it. */
  block: {},
  /** The selected Block's toolbar. */
  blockToolbar: { press: "keepsFocus" },
  /** A Column. Its `data-column-id` names it. */
  column: {},
  /**
   * Buttons that act on the email or what's selected, in the Side panel or the
   * notice, and aren't in a toolbar.
   */
  controls: { press: "keepsFocus" },
  /** A drag handle, on a Block or in a toolbar. */
  dragHandle: { press: "grabs" },
  /** The line that shows where a drop would land. */
  dropIndicator: {},
  /** The editor's frame, beside the Preview and the narrow notice. */
  editor: {},
  /** The email on the canvas. */
  email: {},
  /** The floating toolbar. */
  emailTools: { press: "keepsFocus" },
  /**
   * The Merge Tag picker under a field that holds text or a URL. Focus stays
   * in the field, so a press picks a tag without taking it.
   */
  fieldMergeTagPicker: {},
  /** The format bar beside the text being edited. */
  formatBar: { ofText: true, press: "keepsFocus" },
  /** The link field, in the format bar. */
  linkField: { ofText: true },
  /**
   * The Merge Tag picker, at the cursor in the text being edited. Focus stays
   * in the text, so a press picks a tag without taking it.
   */
  mergeTagPicker: { ofText: true, press: "keepsFocus" },
  /** The notice shown instead of the editor when there's no room to edit. */
  notice: {},
  /**
   * An item in the palette or the Rows tab, which a drag adds. Its
   * `data-block-type` or `data-row-layout` names it.
   */
  paletteItem: {},
  /** The Side panel's tabs. */
  panelTabs: {},
  /** The Preview dialog. */
  preview: {},
  /** A Row with its tag and toolbar. Its `data-row-id` names it. */
  row: {},
  /** The tag that selects a Row, and drags it. */
  rowTag: { press: "grabs" },
  /** A Row's toolbar. */
  rowToolbar: { press: "keepsFocus" },
  /** The settings fields the Side panel shows. */
  settings: {},
  /** A settings field holding typed text that isn't applied yet. */
  settingsDraft: {},
  /** The Side panel. */
  sidePanel: {},
  /** A Block's text, made by ProseMirror. */
  text: {},
  /** The editor's one tooltip. */
  tooltip: {},
  /** The workspace around the email. */
  workspace: {},
} satisfies Record<string, Traits>;

/**
 * What a press with the pointer does to focus there, beyond what the browser
 * does. Each leaves focus and the selection where they are. A place that
 * `grabs` starts a drag, and one that `keepsFocus` acts on what's selected,
 * though a field in it still takes focus.
 */
type Press = "grabs" | "keepsFocus";

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
