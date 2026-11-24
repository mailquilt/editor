import { expect, test } from "@playwright/test";

import { starterEmail as forOtherFrameworks } from "../../../apps/docs/docs/_quick-start/other-frameworks/starter-email.ts";
import { starterEmail as fromJavaScript } from "../../../apps/docs/docs/_quick-start/starter-email.js";
import { starterEmail as fromTypeScript } from "../../../apps/docs/docs/_quick-start/starter-email.ts";

test("the docs' JavaScript and TypeScript starter emails are the same email", () => {
  expect(fromTypeScript).toStrictEqual(fromJavaScript);
  expect(forOtherFrameworks).toStrictEqual(fromJavaScript);
});
