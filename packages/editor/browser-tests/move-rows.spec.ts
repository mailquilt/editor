import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  announcement,
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
  moveTo,
  openEmail,
  pickUp,
  pretendPlatform,
  rowFrame,
  rowTag,
  rowTools,
  selectRow,
  selectRowButton,
  structure,
  TALL_VIEWPORT,
  test,
  textBlock,
  undoByKey,
  watchPrevented,
} from "./helpers.js";

test.use({ viewport: TALL_VIEWPORT });

const rowTool = (page: Page, position: number, name: string) =>
  rowTools(page, position).getByRole("button", { exact: true, name });

/** Clicks a tool in a Row's toolbar, with the mouse. */
const clickRowTool = async (page: Page, position: number, name: string) => {
  await hoverRow(page, position);
  await rowTool(page, position, name).click();
};

test.describe("the Move Row buttons", () => {
  test("are disabled on the first and last Row", async ({ page }) => {
    await openEmail(page, [[["One"]], [["Two"]], [["Three"]]]);

    await expect(rowTool(page, 1, "Move Row up")).toBeDisabled();
    await expect(rowTool(page, 1, "Move Row down")).toBeEnabled();
    await expect(rowTool(page, 2, "Move Row up")).toBeEnabled();
    await expect(rowTool(page, 2, "Move Row down")).toBeEnabled();
    await expect(rowTool(page, 3, "Move Row down")).toBeDisabled();
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
  test("works from its Move buttons, whose focus stays in the toolbar", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]], [["Two"]], [["Three"]]]);
    await selectRow(page, 2);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(rowTool(page, 2, "Move Row down")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([
      [["One"]],
      [["Three"]],
      [["Two"]],
    ]);
    // Disabled now, on the last Row, so focus goes to another of its tools,
    // and the arrow keys go past it.
    await expect(selectRowButton(page, 3)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(rowTool(page, 3, "Duplicate Row")).toBeFocused();

    await page.keyboard.press("Alt+ArrowUp");
    await expect(structure(page)).resolves.toEqual([
      [["One"]],
      [["Two"]],
      [["Three"]],
    ]);
    await expect(rowTools(page, 2)).toHaveAttribute("aria-current", "true");
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
      await expect(selectRowButton(page, position)).toBeFocused();
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
    await expect(selectRowButton(page, 1)).toBeFocused();

    // A Row moves only up and down, so these say nothing.
    await page.keyboard.press("Alt+ArrowLeft");
    await expect.poll(leftPrevented).toBe(true);
    await page.keyboard.press("Alt+ArrowRight");
    await expect(announcement(page)).toHaveText("The Row can't move up.");
    await expect(structure(page)).resolves.toEqual([[["One"]], [["Two"]]]);
  });
});

/** Shows the Row's tools and tag, then the handle or tag to drag it by. */
const grip = async (page: Page, position: number, by: "handle" | "tag") => {
  await hoverRow(page, position);
  return by === "handle"
    ? rowTools(page, position).getByTestId("drag-handle")
    : rowTag(page, position);
};

/** Into the lower part of a Row, so a drop there lands after it. */
const belowMiddleOf = (page: Page, position: number) =>
  bottomOf(rowFrame(page, position).getByTestId("row"));

test.describe("dragging a Row", () => {
  // The other tests drag it by its tag too.
  test("by its handle moves it between Rows, as one undo step", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]], [["Two"]], [["Three"]]]);

    const to = await belowMiddleOf(page, 2);
    await pickUp(page, await grip(page, 1, "handle"));
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
    const tag = await grip(page, 2, "tag");
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

    await pickUp(page, await grip(page, 1, "handle"));
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
    // Its toolbar is hidden while its Block is selected, so by its tag.
    await pickUp(page, await grip(page, 1, "tag"));
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

    await pickUp(page, await grip(page, 1, "handle"));
    await moveTo(page, to);
    await letGo(page);

    await expect(selectRowButton(page, 2)).toBeFocused();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(structure(page)).resolves.toEqual([
      [["Two"]],
      [["Three"]],
      [["One"]],
    ]);
  });
});
