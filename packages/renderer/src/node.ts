import type { BlocksDocument } from "@mailquilt/core";

import { toMjml } from "./to-mjml.js";

export const renderEmail = async (document: BlocksDocument) => {
  const { default: compile } = await import("mjml");
  const { html } = await compile(toMjml(document), {
    validationLevel: "strict",
  });
  return html;
};
