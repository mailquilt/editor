import { KEPT_SPACE_OR_MERGE_TAG } from "./text-patterns.js";

// The one place the renderer escapes what it writes into MJML (ADR 0004).

/**
 * A line break is escaped too, so the pass over MJML's HTML can tell it from
 * MJML's layout. In text it still shows as a space, and browsers leave one out
 * of a link or image address. So is each space HTML doesn't collapse, such as a
 * no-break space, as MJML trims every kind of space from the ends of a Button's
 * label. A Merge Tag's spaces stay as typed, so it's still filled in.
 */
export const escapeText = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "&#10;")
    .replaceAll(KEPT_SPACE_OR_MERGE_TAG, (match) =>
      match.length === 1 ? `&#${match.codePointAt(0) as number};` : match
    );

export const escapeAttribute = (value: string) =>
  escapeText(value).replaceAll('"', "&quot;");
