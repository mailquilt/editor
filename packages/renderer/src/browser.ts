import type { BlocksDocument } from "@mailquilt/core";

import { toMjml } from "./to-mjml.js";

/** The browser build of `renderEmail`. MJML loads the first time it's called. */
export const renderEmail = async (document: BlocksDocument) => {
  // First, so that a refused document never loads MJML.
  const mjml = toMjml(document);
  const { default: compile } = await import("mjml-browser");
  const { html } = await compile(mjml, {
    validationLevel: "strict",
  });
  return html;
};
