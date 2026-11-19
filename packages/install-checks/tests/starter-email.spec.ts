import { expect, test } from "@playwright/test";

import { starterEmail as fromJavaScript } from "../../../apps/docs/docs/_quick-start/starter-email.js";
import { starterEmail as fromTypeScript } from "../../../apps/docs/docs/_quick-start/starter-email.ts";

test("the docs' JavaScript and TypeScript starter emails are the same email", () => {
  expect(fromTypeScript).toStrictEqual(fromJavaScript);
});
