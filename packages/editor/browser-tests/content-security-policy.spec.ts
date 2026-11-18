import { expect, test } from "@playwright/test";

import { canvas, textBlock } from "./helpers.js";

test("under the Content Security Policy the docs give, the canvas shows the email's width, background and font", async ({
  page,
}) => {
  await page.route("/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      headers: {
        ...response.headers(),
        "content-security-policy": "style-src 'self' 'unsafe-inline'",
      },
      response,
    });
  });
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");

  const email = canvas(page).getByTestId("email");
  await expect(email).toHaveCSS("width", "600px");
  await expect(email).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(email).toHaveCSS("font-family", /^Arial/u);
});
