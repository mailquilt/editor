import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  announcement,
  blockTool,
  blockWith,
  canvas,
  currentValue,
  openEmail,
  rowTools,
  selectedBlock,
  selectedText,
  selectRowButton,
  showRowTools,
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

  test("its toolbar's Duplicate button selects the copy, ready to type in", async ({
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
  test("Ctrl/⌘+D in its toolbar puts a copy with its Blocks right after it, and focus goes to the copy's toolbar", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]], [["C"]]]);
    await selectRowButton(page, 1).focus();

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
    await expect(selectRowButton(page, 2)).toBeFocused();
    await expect(rowTools(page, 2)).toHaveAttribute("aria-current", "true");
    await expect(announcement(page)).toHaveText(
      "Row duplicated, position 2 of 3."
    );
  });

  test("its toolbar's Duplicate button copies it too", async ({ page }) => {
    await openEmail(page, [[["A"]], [["B"]]]);
    await showRowTools(page, 2);

    await rowTools(page, 2)
      .getByRole("button", { name: "Duplicate Row" })
      .click();

    expect(await structure(page)).toStrictEqual([[["A"]], [["B"]], [["B"]]]);
    await expect(rowTools(page, 3)).toHaveAttribute("aria-current", "true");
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
  });

  test("in a Row's toolbar delete the Row, moving focus to the next Row's toolbar", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"]], [["C"]]]);
    await selectRowButton(page, 2).focus();

    await page.keyboard.press("Backspace");

    expect(await structure(page)).toStrictEqual([[["A"]], [["C"]]]);
    await expect(selectRowButton(page, 2)).toBeFocused();
    await expect(announcement(page)).toHaveText("Row deleted.");
  });
});
