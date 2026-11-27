import { finishHtml } from "./finish-html.js";
import { toMjml } from "./to-mjml.js";
import type { RenderEmailOptions } from "./to-mjml.js";

/**
 * Renders a saved email as HTML for email clients. `document` can be any value,
 * such as JSON read from a database, because it's checked first: the promise
 * rejects with the reason if it isn't an email Mail Quilt accepts. MJML loads the
 * first time it's called. The Social Block's icons load from jsDelivr, unless
 * `socialIconsUrl` gives a folder of the Host app's own.
 */
export const renderEmail = async (
  document: unknown,
  options: RenderEmailOptions = {}
) => {
  // First, so that a refused document never loads MJML.
  const { boxes, mjml, sharedRowWidths, videoLines } = toMjml(
    document,
    options
  );
  // `mjml-browser` requires `cheerio` but doesn't list it, so this package does,
  // until https://github.com/mjmlio/mjml/issues/3158 is fixed.
  const { default: compile } = await import("mjml-browser");
  const { html } = await compile(mjml, {
    // MJML would otherwise load some fonts, such as Roboto, from Google. The
    // email's own web fonts are its mj-font elements.
    fonts: {},
    validationLevel: "strict",
  });
  return finishHtml(html, sharedRowWidths, boxes, videoLines);
};
