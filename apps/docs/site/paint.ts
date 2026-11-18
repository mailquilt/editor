// Colors JSON and HTML for the pages that show an email's document and its
// export. Used when the site is built and again in the browser, as people edit.

import { MERGE_TAG } from "@mailquilt/core/internal";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const escapeHtml = (text: string) =>
  text.replaceAll(/[&<>]/gu, (character) => ESCAPES[character] ?? character);

/** Merge Tags stand out, because the point is that they come through untouched. */
const paintMergeTags = (html: string) =>
  html.replaceAll(
    new RegExp(MERGE_TAG.source, "gu"),
    (tag) => `<span class="t">${tag}</span>`
  );

/** A document as indented JSON, in markup that `.site-code` colors. */
export const paintJson = (document: unknown) =>
  paintMergeTags(
    escapeHtml(JSON.stringify(document, null, 2)).replaceAll(
      /"(?:[^"\\]|\\.)*"(?<colon>\s*:)?/gu,
      (text, colon: string | undefined) =>
        colon === undefined
          ? `<span class="s">${text}</span>`
          : `<span class="k">${text.slice(0, -colon.length)}</span>${colon}`
    )
  );

/** An email's HTML, in markup that `.site-code` colors. */
export const paintHtml = (html: string) =>
  paintMergeTags(
    escapeHtml(html).replaceAll(
      /(?<open>&lt;\/?)(?<name>[A-Za-z][\w:-]*)/gu,
      '$<open><span class="k">$<name></span>'
    )
  );
