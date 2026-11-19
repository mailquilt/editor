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
 * they still stack there (ADR 0005). Rounded down, so the Columns never add up
 * to more than the email and wrap. It reads MJML's exact class and style text,
 * which is why `mjml-browser` is pinned to one version.
 */
const limitColumnWidths = (html: string, emailWidth: number) =>
  html.replaceAll(
    SHARED_COLUMN_WIDTH,
    (_match, start: string, whole: string, fraction = "") =>
      `${start}width:100%;max-width:${Math.floor(emailWidth * Number(`${whole}.${fraction}`)) / 100}px;`
  );

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

/** MJML's HTML, made small and with each shared Column's desktop width. */
export const finishHtml = (html: string, emailWidth: number) =>
  limitColumnWidths(withoutLayout(html), emailWidth);
