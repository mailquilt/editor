// The example emails, rendered when the site is built by the same renderer a
// server would use, and filled with sample values for their previews. The
// Examples page and each example's own page show them.
import { loadDocument } from "@mailquilt/core";
import { MERGE_TAG } from "@mailquilt/core/internal";
import { renderEmail } from "@mailquilt/renderer";

// The one the sending page teaches, which escapes each value as it fills it.
import { fillMergeTags } from "../docs/_code/fill-merge-tags.js";
import { examples } from "./examples";

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
    // From the export, where every tag is written as {{name}}, and filled.
    const tags = [...new Set(html.match(new RegExp(MERGE_TAG.source, "gu")))];
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
      preview: fillMergeTags(html, sample),
      tags,
    };
  })
);

export type RenderedExample = (typeof renderedExamples)[number];
