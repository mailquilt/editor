/**
 * The places in the editor that key handling, focus, presses and drags find,
 * each declared here once. An element is one by its `data-place`, and code finds
 * the editor's own elements only through this module, never by a class, which
 * is for styles. A place with keys of its own has them in the key map under the
 * same name.
 */
const PLACES = {
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
  /** The format bar beside the text being edited. */
  formatBar: { press: "keepsFocus" },
  /** The link field, in the format bar. */
  linkField: {},
  /** The notice shown in place of the editor when there's no room to edit. */
  notice: {},
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
  /** The Side panel. */
  sidePanel: {},
  /** A Block's text, made by ProseMirror. */
  text: {},
  /** The editor's one tooltip. */
  tooltip: {},
  /** The workspace around the email. */
  workspace: {},
} satisfies Record<string, { press?: Press }>;

/**
 * What a press with the pointer does to focus there, beyond what the browser
 * does. Each leaves focus and the selection where they are. A place that
 * `grabs` starts a drag, and one that `keepsFocus` acts on what's selected,
 * though a field in it still takes focus.
 */
export type Press = "grabs" | "keepsFocus";

export type EditorPlace = keyof typeof PLACES;

/** The copy that follows the pointer during a drag is no place. */
const NOT_GHOST = ":not([data-drag-ghost], [data-drag-ghost] *)";

const selectorOf = (places: readonly EditorPlace[]) =>
  places.map((place) => `[data-place="${place}"]${NOT_GHOST}`).join(", ");

const ANY_PLACE = `[data-place]${NOT_GHOST}`;

/** The innermost of `places` that `element` is in, or is. */
export const closestPlace = (element: Element, ...places: EditorPlace[]) =>
  element.closest<HTMLElement>(selectorOf(places));

/** The first `place` in `root`, in document order. */
export const findPlace = (root: ParentNode, place: EditorPlace) =>
  root.querySelector<HTMLElement>(selectorOf([place]));

/** Every `place` in `root`, in document order. */
export const findPlaces = (root: ParentNode, place: EditorPlace) => [
  ...root.querySelectorAll<HTMLElement>(selectorOf([place])),
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
export const placeOf = <Accepted extends string>(
  element: Element,
  accepts: (place: string) => place is Accepted
): Accepted | undefined => {
  for (
    let at = element.closest<HTMLElement>(ANY_PLACE);
    at;
    at = at.parentElement?.closest<HTMLElement>(ANY_PLACE) ?? null
  ) {
    const { place = "" } = at.dataset;
    if (accepts(place)) {
      return place;
    }
  }
  return undefined;
};

const hasPress = (place: string): place is EditorPlace =>
  Object.hasOwn(PLACES, place) && "press" in PLACES[place as EditorPlace];

/** What a press on `element` does, from the innermost place around it that says. */
export const pressOn = (element: Element): Press | undefined => {
  const place = placeOf(element, hasPress);
  const entry: { press?: Press } | undefined = place && PLACES[place];
  return entry?.press;
};
