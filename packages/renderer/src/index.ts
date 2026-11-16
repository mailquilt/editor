import { limitColumnWidths, toMjml } from "./to-mjml.js";

/**
 * Renders a saved email as HTML for email clients. `document` can be any value,
 * such as JSON read from a database, because it's checked first: the promise
 * rejects with the reason if it isn't an email Mail Quilt accepts. MJML loads the
 * first time it's called.
 */
export const renderEmail = async (document: unknown) => {
  // First, so that a refused document never loads MJML.
  const { emailWidth, mjml } = toMjml(document);
  // `mjml-browser` requires `cheerio` but doesn't list it, so this package does,
  // until https://github.com/mjmlio/mjml/issues/3158 is fixed.
  const { default: compile } = await import("mjml-browser");
  const { html } = await compile(mjml, {
    // MJML would otherwise load some fonts, such as Roboto, from Google.
    fonts: {},
    validationLevel: "strict",
  });
  return limitColumnWidths(html, emailWidth);
};
