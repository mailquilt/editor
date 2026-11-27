import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { focusStartOfTextBlock, textBlock } from "./helpers.js";

const shell = (page: Page) => page.locator("mail-quilt-shell");

test("shows the email in value, with the heading", async ({ page }) => {
  await page.goto("/?shell");

  await expect(textBlock(page)).toHaveText("Hello");
  await expect(shell(page).locator("[part=heading]")).toHaveText("Campaign");
  await expect(
    shell(page).getByRole("button", { exact: true, name: "Export" })
  ).toBeVisible();
});

test("actions picks the Shell's exports, and an empty list shows none", async ({
  page,
}) => {
  for (const [query, menuItems] of [
    ["/?shell&only-html", [/HTML file/u]],
    ["/?shell&no-actions", []],
  ] as const) {
    await page.goto(query);
    await expect(textBlock(page)).toHaveText("Hello");
    await expect(
      shell(page).getByRole("button", { exact: true, name: "Export" })
    ).toHaveCount(menuItems.length);
    if (menuItems.length > 0) {
      await shell(page).getByRole("button", { name: "Export" }).click();
      await expect(shell(page).getByRole("menuitem")).toHaveText([
        ...menuItems,
      ]);
    }
  }
});

// Once the Shell is defined, React sets some props as properties and others,
// such as save-key, as attributes.
test("heading, actions and saveKey can change after the Shell has started", async ({
  page,
}) => {
  await page.goto("/?shell");
  await expect(page.getByTestId("ready")).toHaveText("yes");

  await page.getByRole("button", { name: "Change props" }).click();

  await expect(shell(page).locator("[part=heading]")).toHaveText("Renamed");
  await shell(page).getByRole("button", { name: "Export" }).click();
  await expect(shell(page).getByRole("menuitem")).toHaveText([/JSON file/u]);
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Saved ");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("react-test:other")))
    .toContain("Saved Hello");
});
