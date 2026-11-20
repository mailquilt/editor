import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { focusStartOfTextBlock, textBlock } from "./helpers.js";

const shell = (page: Page) => page.locator("mail-quilt-shell");

test("shows the email in value, with the heading", async ({ page }) => {
  await page.goto("/?shell");

  await expect(textBlock(page)).toHaveText("Hello");
  await expect(shell(page).getByRole("heading", { level: 2 })).toHaveText(
    "Campaign"
  );
  await expect(
    shell(page).getByRole("button", { name: "Import JSON" })
  ).toBeVisible();
});

test("actions picks the Shell's buttons, and an empty list shows none", async ({
  page,
}) => {
  for (const [query, buttons] of [
    ["/?shell&only-html", ["Export HTML"]],
    ["/?shell&no-actions", []],
  ] as const) {
    await page.goto(query);
    await expect(textBlock(page)).toHaveText("Hello");
    await expect(
      shell(page).locator('[part="actions"]').getByRole("button")
    ).toHaveText([...buttons]);
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

  await expect(shell(page).getByRole("heading", { level: 2 })).toHaveText(
    "Renamed"
  );
  await expect(
    shell(page).locator('[part="actions"]').getByRole("button")
  ).toHaveText(["Export JSON"]);
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Saved ");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("react-test:other")))
    .toContain("Saved Hello");
});
