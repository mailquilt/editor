import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  announcement,
  barButton,
  blockTool,
  blockWith,
  canvas,
  currentValue,
  openEmail,
  rowTools,
  selectedBlock,
  selectedText,
  selectRow,
  structure,
  test,
  TALL_VIEWPORT,
  textOf,
  undoByKey,
} from "./helpers.js";

test.use({ viewport: TALL_VIEWPORT });

/** A Text Block by where it is, as its name says. */
const textBlockAt = (page: Page, where: string) =>
  canvas(page).getByRole("group", {
    exact: true,
    name: `Text Block, ${where}`,
  });

test.describe("duplicating a Block", () => {
  test("Ctrl/⌘+D puts a copy right after it, with focus, as one undo step, and says where", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"]]]);
    await blockWith(page, "A").focus();
    // Kept on its way in, as the press stops in the editor, and read once the
    // editor has heard it.
    await page.evaluate(() => {
      window.addEventListener(
        "keydown",
        (event) => {
          Object.assign(window, { press: event });
        },
        { capture: true }
      );
    });

    await page.keyboard.press("ControlOrMeta+d");

    expect(await structure(page)).toStrictEqual([[["A", "A", "B"]]]);
    await expect(
      textBlockAt(page, "Row 1, Column 1, position 2 of 3")
    ).toBeFocused();
    await expect(selectedBlock(page)).toHaveAttribute(
      "aria-label",
      "Text Block, Row 1, Column 1, position 2 of 3"
    );
    await expect(announcement(page)).toHaveText(
      "Block duplicated, Row 1, Column 1, position 2 of 3."
    );
    // The browser doesn't bookmark the page.
    await expect(
      page.evaluate(
        () => (Reflect.get(window, "press") as Event).defaultPrevented
      )
    ).resolves.toBe(true);

    await undoByKey(page);
    expect(await structure(page)).toStrictEqual([[["A", "B"]]]);
  });

  test("the Selection bar's Duplicate button selects the copy, ready to type in", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"]]]);
    await textOf(page, "A").click();

    await blockTool(page, "Duplicate Block").click();

    expect(await structure(page)).toStrictEqual([[["A", "A", "B"]]]);
    await expect(selectedBlock(page)).toHaveAttribute(
      "aria-label",
      "Text Block, Row 1, Column 1, position 2 of 3"
    );
    await expect(selectedText(page)).toBeFocused();
  });
});

test.describe("duplicating a Row", () => {
  test("Ctrl/⌘+D in the Selection bar puts a copy with its Blocks right after it, which the bar then shows", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]], [["C"]]]);
    await selectRow(page, 1);
    await expect(barButton(page, "Row 1")).toBeFocused();

    await page.keyboard.press("ControlOrMeta+d");

    expect(await structure(page)).toStrictEqual([
      [["A"], ["B"]],
      [["A"], ["B"]],
      [["C"]],
    ]);
    const { rows } = await currentValue(page);
    expect(rows[1]?.columns.map(({ width }) => width)).toStrictEqual(
      rows[0]?.columns.map(({ width }) => width)
    );
    await expect(barButton(page, "Row 2")).toBeFocused();
    await expect(rowTools(page, 2)).toBeVisible();
    await expect(announcement(page)).toHaveText(
      "Row duplicated, position 2 of 3."
    );
  });

  test("the Selection bar's Duplicate button copies it too", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"]]]);
    await selectRow(page, 2);

    await rowTools(page, 2)
      .getByRole("button", { name: "Duplicate Row" })
      .click();

    expect(await structure(page)).toStrictEqual([[["A"]], [["B"]], [["B"]]]);
    await expect(rowTools(page, 3)).toBeVisible();
  });
});

test.describe("Delete and Backspace", () => {
  test("on a Block delete it, as its Delete button does, moving focus to the next Block, or else the one before", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B", "C"]]]);
    await blockWith(page, "B").focus();

    await page.keyboard.press("Delete");
    expect(await structure(page)).toStrictEqual([[["A", "C"]]]);
    await expect(blockWith(page, "C")).toBeFocused();
    await expect(announcement(page)).toHaveText("Block deleted.");

    await page.keyboard.press("Backspace");
    expect(await structure(page)).toStrictEqual([[["A"]]]);
    await expect(blockWith(page, "A")).toBeFocused();

    // With no Block left, focus stays in the editor, where the key does nothing more.
    await page.keyboard.press("Delete");
    expect(await structure(page)).toStrictEqual([[[]]]);
    await expect(
      canvas(page).getByRole("group", { name: "Email tools" })
    ).toBeFocused();
    await page.keyboard.press("Delete");
    expect(await structure(page)).toStrictEqual([[[]]]);
  });

  test("in the Selection bar with a Row selected delete the Row, and select the next Row, with focus still in the bar", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"]], [["C"]]]);
    await selectRow(page, 2);

    await page.keyboard.press("Backspace");

    expect(await structure(page)).toStrictEqual([[["A"]], [["C"]]]);
    await expect(rowTools(page, 2)).toBeVisible();
    await expect(barButton(page, "Row 2")).toBeFocused();
    await expect(announcement(page)).toHaveText("Row deleted.");

    // The next press deletes that one, and the last Row's neighbour is before it.
    await page.keyboard.press("Delete");
    expect(await structure(page)).toStrictEqual([[["A"]]]);
    await expect(barButton(page, "Row 1")).toBeFocused();
  });

  test("held down, delete one Block, not the Blocks focus moves on to", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B", "C"]]]);
    await blockWith(page, "A").focus();

    await page.keyboard.down("Delete");
    await page.keyboard.down("Delete");
    await page.keyboard.down("Delete");
    await page.keyboard.up("Delete");

    expect(await structure(page)).toStrictEqual([[["B", "C"]]]);
    await expect(blockWith(page, "B")).toBeFocused();
  });
});
