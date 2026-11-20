import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  backButton,
  blockGroup,
  canvas,
  openBlocks,
  panelTab,
  test,
  textBlock,
} from "./helpers.js";

const tabPanel = (page: Page, name: string) =>
  canvas(page).getByRole("tabpanel", { name });

const fieldset = (page: Page, name: string) =>
  canvas(page).getByRole("group", { exact: true, name });

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
    await expect(panelTab(page, "Settings")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(panelTab(page, "Content")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(panelTab(page, "Settings")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(panelTab(page, "Content")).toBeFocused();

    await expect(panelTab(page, "Rows")).toHaveAttribute("tabindex", "-1");
    await expect(panelTab(page, "Content")).toHaveAttribute("tabindex", "0");
  });
});

test.describe("a selected Block's properties", () => {
  test("give way to the tabs from a visible control, until the Block is clicked again", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await textBlock(page).click();

    await backButton(page).click();

    await expect(panelTab(page, "Content")).toBeVisible();
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
    await panelTab(page, "Rows").click();
    await blockGroup(page, "Text").focus();

    await backButton(page).focus();
    await page.keyboard.press("Enter");

    await expect(panelTab(page, "Rows")).toBeFocused();
    await expect(panelTab(page, "Rows")).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
