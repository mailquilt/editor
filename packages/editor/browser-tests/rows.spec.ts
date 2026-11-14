import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  rowTools,
  blockGroup,
  boxOf,
  canvas,
  layoutTile,
  openEmail as open,
  openTab,
  palette,
  selectRowButton,
  settle,
  structure,
  undoByKey,
} from "./helpers.js";

// The test host's unfriendly CSS pushes the canvas far down the page.
test.use({ viewport: { height: 1600, width: 1280 } });

const rowTag = (page: Page, position: number) =>
  canvas(page)
    .locator(".row-frame")
    .nth(position - 1)
    .locator(".row-tag");

test.describe("selecting a Row", () => {
  test("its tag selects it, and the panel shows its settings", async ({
    page,
  }) => {
    await open(page, [[["A"]], [["B"], ["C"]]]);
    await canvas(page).locator(".row").nth(1).hover();

    await rowTag(page, 2).click();

    await expect(rowTools(page, 2)).toHaveAttribute("aria-current", "true");
    await expect(
      canvas(page).locator('.block[aria-current="true"]')
    ).toHaveCount(0);
    await expect(canvas(page).locator(".side-panel legend")).toHaveText([
      "Row",
    ]);
    await expect(
      canvas(page)
        .locator(".side-panel")
        .getByRole("group", { name: "Layout" })
        .getByRole("button", { exact: true, name: "50/50" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("gives way to a selected Block, and to a click on the workspace", async ({
    page,
  }) => {
    await open(page, [[["A"]], [["B"]]]);
    await selectRowButton(page, 1).focus();
    await page.keyboard.press("Enter");

    await blockGroup(page, "Text").last().focus();
    await expect(rowTools(page, 1)).not.toHaveAttribute("aria-current");

    await selectRowButton(page, 1).focus();
    await page.keyboard.press("Enter");
    const area = await boxOf(canvas(page).locator(".canvas-area"));
    await page.mouse.click(area.x + 10, area.y + 10);
    await expect(rowTools(page, 1)).not.toHaveAttribute("aria-current");
    await expect(
      canvas(page).getByRole("tab", { name: "Content" })
    ).toBeVisible();
  });

  test("a Content tile adds into the selected Row's first Column, at its end", async ({
    page,
  }) => {
    await open(page, [[["A"], ["B"]], [["C"]]]);
    await selectRowButton(page, 1).focus();
    await page.keyboard.press("Enter");
    await openTab(page, "Content");

    await palette(page, "Text").click();

    await expect(structure(page)).resolves.toEqual([
      [["A", ""], ["B"]],
      [["C"]],
    ]);
  });
});

test.describe("dragging a layout from the Rows tab", () => {
  test("adds a Row with it between two Rows, and selects it", async ({
    page,
  }) => {
    await open(page, [[["A"]], [["B"]]]);
    await openTab(page, "Rows");
    const tile = layoutTile(page, "50/50");
    const from = await boxOf(tile);
    const second = await boxOf(canvas(page).locator(".row").nth(1));

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y + 20, { steps: 3 });
    await page.mouse.move(second.x + 100, second.y + 4, { steps: 8 });
    await settle(page);
    await expect(canvas(page).locator(".drop-indicator")).toBeVisible();
    // A new Row lands between Rows, never in a Column.
    await expect(canvas(page).locator("[data-drop-target]")).toHaveCount(0);
    await page.mouse.up();
    await settle(page);

    await expect(structure(page)).resolves.toEqual([
      [["A"]],
      [[], []],
      [["B"]],
    ]);
    await expect(rowTools(page, 2)).toHaveAttribute("aria-current", "true");
    await undoByKey(page);
    await expect(structure(page)).resolves.toEqual([[["A"]], [["B"]]]);
  });
});
