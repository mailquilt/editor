import type { BlocksDocument } from "@mailquilt/core";

import { toMjml } from "./to-mjml.js";

export const renderEmail = async (document: BlocksDocument) => {
  // First, so that a refused document never loads MJML.
  const mjml = toMjml(document);
  const { default: compile } = await import("mjml");
  const { html } = await compile(mjml, {
    validationLevel: "strict",
  });
  return html;
};
