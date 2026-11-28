import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  announcement,
  barButton,
  bottomOf,
  boxOf,
  canvas,
  centerOf,
  changesSince,
  dragMarks,
  dropIndicator,
  hoverRow,
  letGo,
  moveCursorToLineEnd,
  moreAction,
  moveTo,
  openEmail,
  pickUp,
  pretendPlatform,
  rowFrame,
  rowTag,
  rowTools,
  selectRow,
  structure,
  TALL_VIEWPORT,
  test,
  textBlock,
  tooltip,
  undoByKey,
  watchPrevented,
} from "./helpers.js";

test.use({ viewport: TALL_VIEWPORT });

/** A tool in the Selection bar while the Row at `position` is selected. */
const rowTool = (page: Page, position: number, name: string) =>
  rowTools(page, position).getByRole("button", { exact: true, name });

/**
 * Selects a Row, then clicks a tool of its in the Selection bar, or in More
 * where the bar is short of room, as a Row of two Columns's is here.
 */
const clickRowTool = async (page: Page, position: number, name: string) => {
  await selectRow(page, position);
  const inBar = rowTool(page, position, name);
  await (
    (await inBar.isVisible()) ? inBar : await moreAction(page, name)
  ).click();
};

test.describe("the Move Row buttons", () => {
  test("are off on the first and last Row, still reached by the arrow keys, and say why", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]], [["Two"]], [["Three"]]]);

    await selectRow(page, 1);
    const up = rowTool(page, 1, "Move Row up");
    await expect(up).toHaveAttribute("aria-disabled", "true");
    await expect(up).toHaveAccessibleDescription("It's the first Row");
    await expect(rowTool(page, 1, "Move Row down")).not.toHaveAttribute(
      "aria-disabled"
    );
    // The arrow keys reach it, and its tooltip says why.
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(up).toBeFocused();
    await expect(tooltip(page)).toHaveText("It's the first Row");
    // Off, though still reachable, so a press does nothing.
    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([
      [["One"]],
      [["Two"]],
      [["Three"]],
    ]);
    await expect(up).toBeFocused();

    await selectRow(page, 2);
    await expect(rowTool(page, 2, "Move Row up")).not.toHaveAttribute(
      "aria-disabled"
    );
    await expect(rowTool(page, 2, "Move Row down")).not.toHaveAttribute(
      "aria-disabled"
    );
    await selectRow(page, 3);
    await expect(rowTool(page, 3, "Move Row down")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  test("move the Row with its Blocks, as one undo step", async ({ page }) => {
    await openEmail(page, [[["One"], ["Two"]], [["Three"]]]);
    const expectChanges = await changesSince(page);

    await clickRowTool(page, 1, "Move Row down");
    await expect(structure(page)).resolves.toEqual([
      [["Three"]],
      [["One"], ["Two"]],
    ]);
    await expectChanges(1);
    await expect(announcement(page)).toHaveText(
      "Row moved to position 2 of 2."
    );

    await undoByKey(page);
    await expect(structure(page)).resolves.toEqual([
      [["One"], ["Two"]],
      [["Three"]],
    ]);
    await expect(announcement(page)).toHaveText(
      "Undo moved a Row to position 1 of 2."
    );
  });
});

test.describe("moving a selected Row from the keyboard", () => {
  test("works from its Move buttons, whose focus stays in the Selection bar", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]], [["Two"]], [["Three"]]]);
    await selectRow(page, 2);
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(rowTool(page, 2, "Move Row down")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([
      [["One"]],
      [["Three"]],
      [["Two"]],
    ]);
    // Off now, on the last Row, it keeps focus, as it stays reachable.
    await expect(rowTool(page, 3, "Move Row down")).toBeFocused();
    await expect(rowTool(page, 3, "Move Row down")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await page.keyboard.press("ArrowLeft");
    await expect(rowTool(page, 3, "Move Row up")).toBeFocused();

    await page.keyboard.press("Alt+ArrowUp");
    await expect(structure(page)).resolves.toEqual([
      [["One"]],
      [["Two"]],
      [["Three"]],
    ]);
    await expect(rowTools(page, 2)).toBeVisible();
  });

  test("keeps it in view", async ({ page }) => {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    await page.setViewportSize({ height: 500, width: 1000 });
    await openEmail(
      page,
      letters.map((letter) => [[letter]])
    );
    await selectRow(page, letters.length);
    const moved = canvas(page)
      .getByTestId("row-frame")
      .filter({ has: textBlock(page).getByText("J", { exact: true }) });

    for (let position = letters.length - 1; position > 0; position -= 1) {
      await page.keyboard.press("Alt+ArrowUp");
      await expect(barButton(page, `Row ${position}`)).toBeFocused();
      await expect(moved).toBeInViewport();
    }
  });

  test("says when it can't go further, and Alt+← and Alt+→ only keep the page", async ({
    page,
  }) => {
    // As on Windows and Linux, where Alt+← goes back a page.
    await pretendPlatform(page, "Win32");
    await openEmail(page, [[["One"]], [["Two"]]]);
    await selectRow(page, 1);
    // Listening before the key is pressed, so the press can't come first.
    const leftPrevented = await watchPrevented(page, "ArrowLeft");

    await page.keyboard.press("Alt+ArrowUp");
    await expect(announcement(page)).toHaveText("The Row can't move up.");
    await expect(structure(page)).resolves.toEqual([[["One"]], [["Two"]]]);
    await expect(barButton(page, "Row 1")).toBeFocused();

    // A Row moves only up and down, so these say nothing.
    await page.keyboard.press("Alt+ArrowLeft");
    await expect.poll(leftPrevented).toBe(true);
    await page.keyboard.press("Alt+ArrowRight");
    await expect(announcement(page)).toHaveText("The Row can't move up.");
    await expect(structure(page)).resolves.toEqual([[["One"]], [["Two"]]]);
  });
});

/** Shows a Row's tag, which drags it. */
const grip = async (page: Page, position: number) => {
  await hoverRow(page, position);
  return rowTag(page, position);
};

/** Into the lower part of a Row, so a drop there lands after it. */
const belowMiddleOf = (page: Page, position: number) =>
  bottomOf(rowFrame(page, position).getByTestId("row"));

test.describe("dragging a Row", () => {
  test("by its tag moves it between Rows, as one undo step", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]], [["Two"]], [["Three"]]]);

    const to = await belowMiddleOf(page, 2);
    await pickUp(page, await grip(page, 1));
    await moveTo(page, to);
    await expect(dropIndicator(page)).toBeVisible();
    // A Row only ever lands between Rows, never in a Column.
    await expect(canvas(page).locator("[data-drop-target]")).toHaveCount(0);
    await letGo(page);
    await expect(dragMarks(page)).toHaveCount(0);

    await expect(structure(page)).resolves.toEqual([
      [["Two"]],
      [["One"]],
      [["Three"]],
    ]);
    await expect(announcement(page)).toHaveText(
      "Row moved to position 2 of 3."
    );
    await undoByKey(page);
    await expect(structure(page)).resolves.toEqual([
      [["One"]],
      [["Two"]],
      [["Three"]],
    ]);
  });

  test("letting go where it started moves nothing", async ({ page }) => {
    await openEmail(page, [[["One"]], [["Two"]], [["Three"]]]);
    const expectChanges = await changesSince(page);
    const tag = await grip(page, 2);
    const start = await centerOf(tag);

    await pickUp(page, tag);
    await moveTo(page, start);
    await letGo(page);

    await expect(structure(page)).resolves.toEqual([
      [["One"]],
      [["Two"]],
      [["Three"]],
    ]);
    await expectChanges(0);
  });

  test("letting go far from the email moves nothing", async ({ page }) => {
    await openEmail(page, [[["One"]], [["Two"]]]);
    const expectChanges = await changesSince(page);
    const editor = await boxOf(canvas(page));
    // Well past the editor's drop margin, and still in the window.
    const away = { x: editor.x + editor.width / 2, y: editor.y - 100 };
    expect(away.y).toBeGreaterThan(0);

    await pickUp(page, await grip(page, 1));
    await moveTo(page, away);
    await expect(dropIndicator(page)).toBeHidden();
    await letGo(page);

    await expect(structure(page)).resolves.toEqual([[["One"]], [["Two"]]]);
    await expectChanges(0);
  });

  test("keeps its text's editor, cursor and undo history", async ({ page }) => {
    await openEmail(page, [[["One"]], [["Two"]]]);
    const one = textBlock(page).first();
    await one.click();
    await moveCursorToLineEnd(page);
    await page.keyboard.type("A");
    await one.evaluate((element) => {
      element.dataset.kept = "";
    });

    const to = await belowMiddleOf(page, 2);
    await pickUp(page, await grip(page, 1));
    await moveTo(page, to);
    await letGo(page);
    await expect(structure(page)).resolves.toEqual([[["Two"]], [["OneA"]]]);
    await page.keyboard.type("B");

    await expect(textBlock(page).last()).toHaveAttribute("data-kept", "");
    await expect(structure(page)).resolves.toEqual([[["Two"]], [["OneAB"]]]);
    await undoByKey(page);
    await expect(structure(page)).resolves.toEqual([[["Two"]], [["OneA"]]]);
    await undoByKey(page);
    await expect(structure(page)).resolves.toEqual([[["OneA"]], [["Two"]]]);
    await undoByKey(page);
    await expect(structure(page)).resolves.toEqual([[["One"]], [["Two"]]]);
  });

  test("leaves focus on a selected Row's tools", async ({ page }) => {
    await openEmail(page, [[["One"]], [["Two"]], [["Three"]]]);
    await selectRow(page, 1);
    const to = await belowMiddleOf(page, 2);

    await pickUp(page, await grip(page, 1));
    await moveTo(page, to);
    await letGo(page);

    await expect(barButton(page, "Row 2")).toBeFocused();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(structure(page)).resolves.toEqual([
      [["Two"]],
      [["Three"]],
      [["One"]],
    ]);
  });
});
