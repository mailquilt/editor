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
  // MJML indents its HTML, which is over a quarter of an email's size. Gmail
  // cuts off an email it counts as over 102 KB. The email's own line breaks are
  // escaped, so whitespace with one is only MJML's layout: none between tags,
  // and a space elsewhere. Only HTML's own whitespace, as `\s` would take a
  // no-break space too. Each run is read once, however long.
  return limitColumnWidths(
    html.replaceAll(/[\t\n\f\r ]+/gu, (space, offset: number) => {
      if (!space.includes("\n")) {
        return space;
      }
      return html[offset - 1] === ">" && html[offset + space.length] === "<"
        ? ""
        : " ";
    }),
    emailWidth
  );
};
