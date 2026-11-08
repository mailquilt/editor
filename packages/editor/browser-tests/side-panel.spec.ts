import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  blockGroup,
  blockTypes,
  canvas,
  openBlocks,
  structure,
  textBlock,
} from "./helpers.js";

const tab = (page: Page, name: string) =>
  canvas(page).getByRole("tab", { exact: true, name });

const tabPanel = (page: Page, name: string) =>
  canvas(page).getByRole("tabpanel", { name });

const back = (page: Page) =>
  canvas(page).getByRole("button", { exact: true, name: "Back" });

const rowsPanelLayout = (page: Page, layout: string) =>
  tabPanel(page, "Rows").getByRole("button", { exact: true, name: layout });

const fieldset = (page: Page, name: string) =>
  canvas(page)
    .getByRole("group", { name: "Settings" })
    .getByRole("group", { exact: true, name });

test.describe("the side panel's tabs", () => {
  test("are Content, Rows and Settings, with Content first", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);

    await expect(canvas(page).getByRole("tab")).toHaveText([
      "Content",
      "Rows",
      "Settings",
    ]);
    await expect(tab(page, "Content")).toHaveAttribute("aria-selected", "true");
    await expect(
      tabPanel(page, "Content")
        .getByRole("group", { name: "Add content" })
        .getByRole("button")
    ).toHaveText(["Text", "Heading", "Image", "Button", "Divider", "Spacer"]);
  });

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

  test("Settings holds the email's settings", async ({ page }) => {
    await openBlocks(page, ["text"]);

    await tab(page, "Settings").click();

    await expect(fieldset(page, "Email").getByLabel("Width (px)")).toHaveValue(
      "600"
    );
  });

  test("Rows names each layout and adds a Row with it at the end", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await tab(page, "Rows").click();

    await expect(tabPanel(page, "Rows").getByRole("button")).toHaveText([
      "100",
      "50/50",
      "33/67",
      "67/33",
      "33/33/33",
      "25/25/25/25",
    ]);
    await rowsPanelLayout(page, "33/67").click();

    await expect(structure(page)).resolves.toEqual([[["Words"]], [[], []]]);
    const widths = await canvas(page).evaluate((element) =>
      (
        element as unknown as {
          value: { rows: { columns: { width: number }[] }[] };
        }
      ).value.rows[1]?.columns.map(({ width }) => width)
    );
    expect(widths).toEqual([33, 67]);
  });
});

test.describe("a selected Block's properties", () => {
  test("replace the tabs: the Block's fields, then its Row's", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);

    await textBlock(page).click();

    await expect(canvas(page).getByRole("tablist")).toHaveCount(0);
    await expect(
      canvas(page).getByRole("group", { name: "Settings" }).locator("legend")
    ).toHaveText(["Block", "Row"]);
    await expect(
      fieldset(page, "Block").getByLabel("Font size (px)")
    ).toBeVisible();
  });

  test("give way to the tabs again from a visible control", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await textBlock(page).click();

    await back(page).click();

    await expect(tab(page, "Content")).toBeVisible();
    await expect(fieldset(page, "Block")).toHaveCount(0);
    // The Block stays selected, so what's chosen next goes after it.
    await expect(textBlock(page)).toBeFocused();
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

  test("give way when the selection is cleared", async ({ page }) => {
    await openBlocks(page, ["text"]);
    await textBlock(page).click();
    await expect(back(page)).toBeVisible();

    await blockGroup(page, "Text")
      .getByRole("button", { name: "Delete Block" })
      .click();

    await expect(tab(page, "Content")).toBeVisible();
  });

  test("a Content tile inserts after the selected Block with Enter", async ({
    page,
  }) => {
    await openBlocks(page, ["text", "text"]);
    await blockGroup(page, "Text").first().focus();
    await back(page).click();

    await tabPanel(page, "Content")
      .getByRole("button", { exact: true, name: "Image" })
      .focus();
    await page.keyboard.press("Enter");

    await expect(blockTypes(page)).resolves.toEqual(["text", "image", "text"]);
    await expect(blockGroup(page, "Image")).toBeFocused();
    await expect(back(page)).toBeVisible();
  });

  test("a Rows thumbnail adds after the selected Block's Row", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await tab(page, "Rows").click();
    await rowsPanelLayout(page, "100").click();
    await expect(structure(page)).resolves.toEqual([[["Words"]], [[]]]);
    await textBlock(page).click();
    await back(page).click();

    await rowsPanelLayout(page, "50/50").click();

    await expect(structure(page)).resolves.toEqual([
      [["Words"]],
      [[], []],
      [[]],
    ]);
  });
});
