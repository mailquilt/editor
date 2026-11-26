import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { blockGroup, canvas, openBlocks, panelTab, test } from "./helpers.js";

const tabPanel = (page: Page, name: string) =>
  canvas(page).getByRole("tabpanel", { name });

test.describe("the side panel's tabs", () => {
  test("follow the ARIA tabs pattern from the keyboard", async ({ page }) => {
    await openBlocks(page, ["text"]);
    await panelTab(page, "Content").focus();

    await page.keyboard.press("ArrowRight");
    await expect(panelTab(page, "Rows")).toBeFocused();
    await expect(panelTab(page, "Rows")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(tabPanel(page, "Rows")).toBeVisible();
    await expect(tabPanel(page, "Content")).toHaveCount(0);
    // Its title is a heading, for a screen reader's list of them.
    await expect(
      tabPanel(page, "Rows").getByRole("heading", { level: 3 })
    ).toHaveText("Layouts");

    await page.keyboard.press("End");
    await expect(panelTab(page, "Rows")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(panelTab(page, "Content")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(panelTab(page, "Rows")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(panelTab(page, "Content")).toBeFocused();

    await expect(panelTab(page, "Rows")).toHaveAttribute("tabindex", "-1");
    await expect(panelTab(page, "Content")).toHaveAttribute("tabindex", "0");
  });
});

test.describe("the side panel with a Block selected", () => {
  // The Selection bar has the Block's settings, so the tabs stay.
  test("keeps the tab that was showing", async ({ page }) => {
    await openBlocks(page, ["text"]);
    await panelTab(page, "Rows").click();

    await blockGroup(page, "Text").focus();

    await expect(panelTab(page, "Rows")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(tabPanel(page, "Rows")).toBeVisible();
  });
});
