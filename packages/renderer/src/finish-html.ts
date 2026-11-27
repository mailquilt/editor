// The pass over MJML's HTML: what MJML can't be told to do while it renders.

/** Marks a Column that shares its Row, for `limitColumnWidths`. */
export const SHARED_COLUMN = "mq-column";

/** Marks a Column holding a Block with rounded corners, for `roundBoxes`. */
export const ROUNDED_COLUMN = "mq-round";

/** Hides a Row or Block below the phone width, where the email keeps its `<style>`. */
export const HIDDEN_ON_PHONES = "mq-hide-phone";

/** What shows a Row, or a Block's row of the table, only below the phone width. */
export const SHOWN_ON_PHONES = "mq-show-phone";
export const SHOWN_ON_PHONES_BLOCK = "mq-show-phone-block";

/**
 * The start of each class that gives something its Phone values, numbered in
 * the order they're written.
 */
export const PHONE_VALUES = "mq-phone-";

/** The start of the markers around what only phones show, for `showOnPhonesOnly`. */
export const PHONE_ONLY = "mq-phone-only-";

/** A Column's classes after `mq-column`, which the passes below don't need. */
const PHONE_CLASS = String.raw`(?: ${PHONE_VALUES}\d+)?`;

/**
 * The start of a marked Column's tag, up to its `width:100%`. It starts at the
 * `<`, which text never has unescaped, so a label or preheader that reads the
 * same is left alone.
 */
const SHARED_COLUMN_WIDTH = new RegExp(
  String.raw`(<div class="mj-column-per-(\d+)(?:-(\d+))? mj-outlook-group-fix (?:${ROUNDED_COLUMN} )?${SHARED_COLUMN}${PHONE_CLASS}" style="[^"]*)width:100%;`,
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
 * The table a marked Column's Blocks are in: the first in it, or inside the
 * cell its padding or border adds, up to its style's first property.
 */
const ROUNDED_COLUMN_TABLE = new RegExp(
  String.raw`(<div class="mj-column-per-[\d-]+ mj-outlook-group-fix ${ROUNDED_COLUMN}(?: ${SHARED_COLUMN})?${PHONE_CLASS}" style="[^"]*" >(?:<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" ><tbody><tr><td  style="[^"]*">)?<table border="0" cellpadding="0" cellspacing="0" role="presentation" style=")`,
  "gu"
);

/**
 * A cell's rounded corners only show in a table whose borders are separate,
 * and the email's styles collapse every table's, so the table holding a
 * rounded Box's cell keeps them separate. With no spacing between cells, it
 * looks the same.
 */
const roundBoxes = (html: string) =>
  html.replaceAll(ROUNDED_COLUMN_TABLE, "$1border-collapse:separate;");

/**
 * The start of a marked Block's cell, up to its style's first property. Like
 * `SHARED_COLUMN_WIDTH`, it starts at the `<`, so text that reads the same is
 * left alone.
 */
const BOXED_BLOCK_STYLE = new RegExp(
  // A Spacer's cell has no align.
  String.raw`(<td(?: align="(?:left|center|right)")? class="${BOXED_BLOCK}(?: mq-[\w-]+)*" style=")`,
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

/** Marks a Video with a line under its picture, for `addVideoLines`. */
export const VIDEO_LINE = "mq-video";

/**
 * A marked Video's cell, up to the end of its picture's row of MJML's image
 * table. Like `SHARED_COLUMN_WIDTH`, it starts at the `<`, so text that reads
 * the same is left alone, and the picture's link is the first `</a>` in it.
 */
const VIDEO_PICTURE = new RegExp(
  String.raw`<td align="center" class="(?:${BOXED_BLOCK} )?${VIDEO_LINE}(?: mq-[\w-]+)*" style="[^"]*" >.*?</a></td></tr>`,
  "gsu"
);

/**
 * Each Video's line goes under its picture, in a row of its own in MJML's
 * image table, which is the picture's width, so the line is centred under
 * it. They're given in the order MJML writes the marked Blocks.
 */
const addVideoLines = (html: string, lines: readonly string[]) => {
  let index = 0;
  return html.replaceAll(VIDEO_PICTURE, (picture: string) => {
    const line = lines[index] as string;
    index += 1;
    return `${picture}${line}`;
  });
};

/** What's between the markers around something only phones show. */
const PHONE_ONLY_MARKED = new RegExp(
  String.raw`<!--${PHONE_ONLY}(?<kind>row|block)-->(?<inside>.*?)<!--/${PHONE_ONLY}\k<kind>-->`,
  "gsu"
);

/** Each of MJML's parts for Outlook on Windows. */
const FOR_OUTLOOK = /<!--\[if mso \| IE\]>.*?<!\[endif\]-->/gsu;

/**
 * What only phones show is hidden inline, and shown by the phone media query.
 * Outlook on Windows reads no media query, so it's left out there by a
 * conditional comment, which can't hold another, so MJML's parts for Outlook
 * inside it go. A Row is wrapped in a `<div>` of its own; a Block's row of
 * its Column's table is hidden itself. A Block that's in a Row only phones
 * show is already left out of Outlook. Like `SHARED_COLUMN_WIDTH`, the
 * markers start at `<`, so text that reads the same is left alone.
 */
const showOnPhonesOnly = (html: string, inOutlook = true): string =>
  html.replaceAll(PHONE_ONLY_MARKED, (...match) => {
    const { inside, kind } = match.at(-1) as { inside: string; kind: string };
    const shown =
      kind === "row"
        ? `<div class="${SHOWN_ON_PHONES}" style="display:none;max-height:0;overflow:hidden;">${showOnPhonesOnly(inside.replaceAll(FOR_OUTLOOK, ""), false)}</div>`
        : inside
            .replaceAll(FOR_OUTLOOK, "")
            .replace(
              /^<tr>/u,
              `<tr class="${SHOWN_ON_PHONES_BLOCK}" style="display:none;">`
            );
    return inOutlook ? `<!--[if !mso]><!-->${shown}<!--<![endif]-->` : shown;
  });

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
 * MJML's HTML, made small, with each shared Column's desktop width, each
 * Video's line and each Block's border and corners.
 */
export const finishHtml = (
  html: string,
  sharedRowWidths: readonly number[],
  boxes: readonly string[] = [],
  videoLines: readonly string[] = []
) =>
  showOnPhonesOnly(
    roundBoxes(
      addBoxes(
        addVideoLines(
          limitColumnWidths(withoutLayout(html), sharedRowWidths),
          videoLines
        ),
        boxes
      )
    )
  );
