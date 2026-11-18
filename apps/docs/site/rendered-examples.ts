// The example emails, rendered when the site is built by the same renderer a
// server would use, and filled with sample values for their previews. The
// Examples page and each example's own page show them.
import { loadDocument } from "@mailquilt/core";
import { MERGE_TAG } from "@mailquilt/core/internal";
import { renderEmail } from "@mailquilt/renderer";

import { examples } from "./examples";

/** What a sending service does: puts a reader's own values where the tags are. */
const fill = (html: string, values: Record<string, string | undefined>) => {
  let filled = html;
  for (const [tag, value] of Object.entries(values)) {
    if (value !== undefined) {
      filled = filled.replaceAll(`{{${tag}}}`, value);
    }
  }
  return filled;
};

const dataUrl = (type: string, text: string) =>
  `data:${type};charset=utf-8,${encodeURIComponent(text)}`;

export const renderedExamples = await Promise.all(
  examples.map(async ({ document, sample, ...example }) => {
    const loaded = loadDocument(document);
    if (!loaded.ok) {
      throw new Error(
        `The ${example.name} example doesn't load: ${loaded.reason}`
      );
    }
    const json = JSON.stringify(document, null, 2);
    const html = await renderEmail(document);
    const tags = [...new Set(json.match(new RegExp(MERGE_TAG.source, "gu")))];
    // Left unfilled, a tag would show in the preview as its own name.
    const unfilled = tags.filter((tag) => !(tag.slice(2, -2) in sample));
    if (unfilled.length > 0) {
      throw new Error(
        `The ${example.name} example has no sample value for ${unfilled.join(", ")}`
      );
    }
    return {
      ...example,
      document,
      download: dataUrl("application/json", json),
      html,
      htmlDownload: dataUrl("text/html", html),
      preview: fill(html, sample),
      tags,
    };
  })
);

export type RenderedExample = (typeof renderedExamples)[number];
