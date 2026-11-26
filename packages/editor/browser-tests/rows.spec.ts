import { expect } from "@playwright/test";

import {
  blockGroup,
  boxOf,
  canvas,
  dropIndicator,
  hoverRow,
  layoutOption,
  layoutTile,
  openEmail,
  openTab,
  palette,
  rowTag,
  rowTools,
  selectedBlock,
  selectionBar,
  selectRow,
  settle,
  structure,
  TALL_VIEWPORT,
  test,
  undoByKey,
} from "./helpers.js";

test.use({ viewport: TALL_VIEWPORT });

test.describe("selecting a Row", () => {
  test("its tag selects it, and the Selection bar shows its settings", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"], ["C"]]]);
    await hoverRow(page, 2);

    await rowTag(page, 2).click();

    await expect(rowTools(page, 2)).toBeVisible();
    await expect(
      canvas(page).locator('[data-testid="row-frame"][data-row-selected]')
    ).toHaveCount(1);
    await expect(selectedBlock(page)).toHaveCount(0);
    await expect(layoutOption(page, "50/50")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("gives way to a selected Block", async ({ page }) => {
    await openEmail(page, [[["A"]], [["B"]]]);
    await selectRow(page, 1);

    await blockGroup(page, "Text").last().focus();
    await expect(blockGroup(page, "Text").last()).toHaveAttribute(
      "aria-current",
      "true"
    );
    await expect(selectionBar(page)).toHaveAccessibleName("Text settings");
  });

  test("a Content tile adds into the selected Row's first Column, at its end", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]], [["C"]]]);
    await selectRow(page, 1);
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
    await openEmail(page, [[["A"]], [["B"]]]);
    await openTab(page, "Rows");
    const tile = layoutTile(page, "50/50");
    const from = await boxOf(tile);
    const second = await boxOf(canvas(page).getByTestId("row").nth(1));

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y + 20, { steps: 3 });
    await page.mouse.move(second.x + 100, second.y + 4, { steps: 8 });
    await settle(page);
    await expect(dropIndicator(page)).toBeVisible();
    // A new Row lands between Rows, never in a Column.
    await expect(canvas(page).locator("[data-drop-target]")).toHaveCount(0);
    await page.mouse.up();
    await settle(page);

    await expect(structure(page)).resolves.toEqual([
      [["A"]],
      [[], []],
      [["B"]],
    ]);
    await expect(rowTools(page, 2)).toBeVisible();
    await undoByKey(page);
    await expect(structure(page)).resolves.toEqual([[["A"]], [["B"]]]);
  });
});
