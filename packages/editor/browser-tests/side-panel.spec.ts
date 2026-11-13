import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { blockGroup, canvas, openBlocks, textBlock } from "./helpers.js";

const tab = (page: Page, name: string) =>
  canvas(page).getByRole("tab", { exact: true, name });

const tabPanel = (page: Page, name: string) =>
  canvas(page).getByRole("tabpanel", { name });

const back = (page: Page) =>
  canvas(page).getByRole("button", { exact: true, name: "Back" });

const fieldset = (page: Page, name: string) =>
  canvas(page)
    .getByRole("group", { name: "Settings" })
    .getByRole("group", { exact: true, name });

test.describe("the side panel's tabs", () => {
  test("follow the ARIA tabs pattern from the keyboard", async ({ page }) => {
    await openBlocks(page, ["text"]);
    await tab(page, "Content").focus();

    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "Rows")).toBeFocused();
    await expect(tab(page, "Rows")).toHaveAttribute("aria-selected", "true");
    await expect(tabPanel(page, "Rows")).toBeVisible();
    await expect(tabPanel(page, "Content")).toHaveCount(0);

    await page.keyboard.press("End");
    await expect(tab(page, "Settings")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "Content")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "Settings")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tab(page, "Content")).toBeFocused();

    await expect(tab(page, "Rows")).toHaveAttribute("tabindex", "-1");
    await expect(tab(page, "Content")).toHaveAttribute("tabindex", "0");
  });
});

test.describe("a selected Block's properties", () => {
  test("give way to the tabs from a visible control, until the Block is clicked again", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await textBlock(page).click();

    await back(page).click();

    await expect(tab(page, "Content")).toBeVisible();
    await expect(fieldset(page, "Block")).toHaveCount(0);
    // The Block stays selected, so what's chosen next goes after it.
    await expect(textBlock(page)).toBeFocused();

    // Its text still has focus, so only the click can bring them back.
    await textBlock(page).click();
    await expect(fieldset(page, "Block")).toBeVisible();
  });

  test("give way from the keyboard, to the tab that was showing", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await tab(page, "Rows").click();
    await blockGroup(page, "Text").focus();

    await back(page).focus();
    await page.keyboard.press("Enter");

    await expect(tab(page, "Rows")).toBeFocused();
    await expect(tab(page, "Rows")).toHaveAttribute("aria-selected", "true");
  });
});
