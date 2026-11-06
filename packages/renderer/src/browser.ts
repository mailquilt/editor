import type { BlocksDocument } from "@mailquilt/core";

import { toMjml } from "./to-mjml.js";

/** The browser build of `renderEmail`. MJML loads the first time it's called. */
export const renderEmail = async (document: BlocksDocument) => {
  const { default: compile } = await import("mjml-browser");
  const { html } = await compile(toMjml(document), {
    validationLevel: "strict",
  });
  return html;
};
