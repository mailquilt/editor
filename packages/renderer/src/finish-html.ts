// The pass over MJML's HTML: what MJML can't be told to do while it renders.

/** Marks a Column that shares its Row, for `limitColumnWidths`. */
export const SHARED_COLUMN = "mq-column";

/**
 * The start of a marked Column's tag, up to its `width:100%`. It starts at the
 * `<`, which text never has unescaped, so a label or preheader that reads the
 * same is left alone.
 */
const SHARED_COLUMN_WIDTH = new RegExp(
  String.raw`(<div class="mj-column-per-(\d+)(?:-(\d+))? mj-outlook-group-fix ${SHARED_COLUMN}" style="[^"]*)width:100%;`,
  "gu"
);

/**
 * MJML gives a Column its desktop width only inside a media query, and
 * `width:100%` inline. GMX, Web.de, T-Online and Libero drop the media query,
 * so Columns that share a Row stacked on a desktop. Each one gets its desktop
 * width inline as a `max-width` in pixels, which a phone media query lifts so
 * they still stack there (ADR 0005). It's a share of the room its Row leaves
 * inside its padding, given for each marked Column in the order MJML writes
 * them. Rounded down, so the Columns never add up to more than that and wrap.
 * It reads MJML's exact class and style text, which is why `mjml-browser` is
 * pinned to one version.
 */
const limitColumnWidths = (html: string, rowWidths: readonly number[]) => {
  let index = 0;
  return html.replaceAll(
    SHARED_COLUMN_WIDTH,
    (_match, start: string, whole: string, fraction = "") => {
      const rowWidth = rowWidths[index] as number;
      index += 1;
      return `${start}width:100%;max-width:${Math.floor(rowWidth * Number(`${whole}.${fraction}`)) / 100}px;`;
    }
  );
};

/** Marks a Block whose Box has a border or corners, for `addBoxes`. */
export const BOXED_BLOCK = "mq-box";

/**
 * The start of a marked Block's cell, up to its style's first property. Like
 * `SHARED_COLUMN_WIDTH`, it starts at the `<`, so text that reads the same is
 * left alone.
 */
const BOXED_BLOCK_STYLE = new RegExp(
  // A Spacer's cell has no align.
  String.raw`(<td(?: align="(?:left|center|right)")? class="${BOXED_BLOCK}" style=")`,
  "gu"
);

/**
 * A Block's border and corners, which MJML has no attribute for, go on the
 * cell that has its padding and background, given in the order MJML writes
 * the marked Blocks. Outlook on Windows draws the corners square.
 */
const addBoxes = (html: string, boxes: readonly string[]) => {
  let index = 0;
  return html.replaceAll(BOXED_BLOCK_STYLE, (start: string) => {
    const box = boxes[index] as string;
    index += 1;
    return `${start}${box}`;
  });
};

/**
 * MJML indents its HTML, which is over a quarter of an email's size. Gmail
 * cuts off an email it counts as over 102 KB. The email's own line breaks are
 * escaped, so whitespace with one is only MJML's layout: none between tags,
 * and a space elsewhere. Only HTML's own whitespace, as `\s` would take a
 * no-break space too. Each run is read once, however long.
 */
const withoutLayout = (html: string) =>
  html.replaceAll(/[\t\n\f\r ]+/gu, (space, offset: number) => {
    if (!space.includes("\n")) {
      return space;
    }
    return html[offset - 1] === ">" && html[offset + space.length] === "<"
      ? ""
      : " ";
  });

/**
 * MJML's HTML, made small, with each shared Column's desktop width and each
 * Block's border and corners.
 */
export const finishHtml = (
  html: string,
  sharedRowWidths: readonly number[],
  boxes: readonly string[] = []
) => addBoxes(limitColumnWidths(withoutLayout(html), sharedRowWidths), boxes);
