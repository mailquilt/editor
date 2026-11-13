import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  announcement,
  boxOf,
  canvas,
  centerOf,
  changeCount,
  letGo,
  moveCursorToLineEnd,
  moveTo,
  openEmail as open,
  pickUp,
  rowTools,
  selectRow,
  selectRowButton,
  structure,
  textBlock,
  undoByKey,
} from "./helpers.js";
import type { Point } from "./helpers.js";

// The test host's unfriendly CSS pushes the canvas far down the page.
test.use({ viewport: { height: 1600, width: 1280 } });

/** A Row's toolbar shows on hover, so the pointer goes there first. */
const hoverRow = (page: Page, position: number) =>
  canvas(page)
    .locator(".row")
    .nth(position - 1)
    .hover({ position: { x: 4, y: 4 } });

const rowTool = (page: Page, position: number, name: string) =>
  rowTools(page, position).getByRole("button", { exact: true, name });

/** Clicks a tool in a Row's toolbar, with the mouse. */
const clickRowTool = async (page: Page, position: number, name: string) => {
  await hoverRow(page, position);
  await rowTool(page, position, name).click();
};

test.describe("the Move Row buttons", () => {
  test("are disabled on the first and last Row", async ({ page }) => {
    await open(page, [[["One"]], [["Two"]], [["Three"]]]);

    await expect(rowTool(page, 1, "Move Row up")).toBeDisabled();
    await expect(rowTool(page, 1, "Move Row down")).toBeEnabled();
    await expect(rowTool(page, 2, "Move Row up")).toBeEnabled();
    await expect(rowTool(page, 2, "Move Row down")).toBeEnabled();
    await expect(rowTool(page, 3, "Move Row down")).toBeDisabled();
  });

  test("move the Row with its Blocks, as one undo step", async ({ page }) => {
    await open(page, [[["One"], ["Two"]], [["Three"]]]);

    await clickRowTool(page, 1, "Move Row down");
    await expect(structure(page)).resolves.toEqual([
      [["Three"]],
      [["One"], ["Two"]],
    ]);
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
  test("Alt+↓ and Alt+↑ move it, and say where it went", async ({ page }) => {
    await open(page, [[["One"]], [["Two"]], [["Three"]]]);
    await selectRow(page, 1);

    await page.keyboard.press("Alt+ArrowDown");
    await expect(structure(page)).resolves.toEqual([
      [["Two"]],
      [["One"]],
      [["Three"]],
    ]);
    await expect(announcement(page)).toHaveText(
      "Row moved to position 2 of 3."
    );

    await page.keyboard.press("Alt+ArrowDown");
    await page.keyboard.press("Alt+ArrowUp");
    await page.keyboard.press("Alt+ArrowUp");
    await expect(structure(page)).resolves.toEqual([
      [["One"]],
      [["Two"]],
      [["Three"]],
    ]);
    await expect(announcement(page)).toHaveText(
      "Row moved to position 1 of 3."
    );
  });

  test("keeps it selected, with focus on its toolbar", async ({ page }) => {
    await open(page, [[["One"]], [["Two"]], [["Three"]]]);
    await selectRow(page, 2);

    await page.keyboard.press("Alt+ArrowUp");

    await expect(rowTools(page, 1)).toHaveAttribute("aria-current", "true");
    await expect(selectRowButton(page, 1)).toBeFocused();
    await expect(textBlock(page).first()).toHaveText("Two");
  });

  test("works from its Move buttons, whose focus stays in the toolbar", async ({
    page,
  }) => {
    await open(page, [[["One"]], [["Two"]], [["Three"]]]);
    await selectRow(page, 2);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(
      rowTools(page, 2).getByRole("button", { name: "Move Row down" })
    ).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([
      [["One"]],
      [["Three"]],
      [["Two"]],
    ]);
    // Disabled now, on the last Row, so focus goes to another of its tools.
    await expect(selectRowButton(page, 3)).toBeFocused();

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
    await open(
      page,
      letters.map((letter) => [[letter]])
    );
    await selectRow(page, letters.length);
    const moved = canvas(page)
      .locator(".row-frame")
      .filter({ has: textBlock(page).getByText("J", { exact: true }) });

    // oxlint-disable no-await-in-loop -- Each press depends on the one before.
    for (let position = letters.length - 1; position > 0; position -= 1) {
      await page.keyboard.press("Alt+ArrowUp");
      await expect(selectRowButton(page, position)).toBeFocused();
      await expect(moved).toBeInViewport();
    }
    // oxlint-enable no-await-in-loop
  });

  test("says when it can't go further", async ({ page }) => {
    await open(page, [[["One"]], [["Two"]]]);
    await selectRow(page, 1);

    await page.keyboard.press("Alt+ArrowUp");

    await expect(announcement(page)).toHaveText("The Row can't move up.");
    await expect(structure(page)).resolves.toEqual([[["One"]], [["Two"]]]);
    await expect(selectRowButton(page, 1)).toBeFocused();
  });

  test("Alt+← and Alt+→ say it can't move that way, and don't go back a page", async ({
    page,
  }) => {
    await open(page, [[["One"]], [["Two"]]]);
    await selectRow(page, 1);
    // Listening before the key is pressed, so the press can't come first.
    await page.evaluate(() => {
      document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
          Object.assign(window, { leftPrevented: event.defaultPrevented });
        }
      });
    });

    await page.keyboard.press("Alt+ArrowLeft");
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "leftPrevented")))
      .toBe(true);
    await expect(announcement(page)).toHaveText("The Row can't move left.");

    await page.keyboard.press("Alt+ArrowRight");
    await expect(announcement(page)).toHaveText("The Row can't move right.");
  });
});

const rowFrame = (page: Page, position: number) =>
  canvas(page)
    .locator(".row-frame:not([data-drag-ghost])")
    .nth(position - 1);

/** Shows the Row's tools and tag, then the handle or tag to drag it by. */
const grip = async (page: Page, position: number, by: "handle" | "tag") => {
  await canvas(page)
    .locator(".row")
    .nth(position - 1)
    .hover({ position: { x: 4, y: 4 } });
  return by === "handle"
    ? rowTools(page, position).locator(".drag-handle")
    : rowFrame(page, position).locator(".row-tag");
};

/**
 * Into the lower part of a Row, so a drop there lands after it. Measured before a
 * drag, which adds a copy of the dragged Row.
 */
const belowMiddleOf = async (page: Page, position: number): Promise<Point> => {
  const { height, width, x, y } = await boxOf(
    canvas(page)
      .locator(".row")
      .nth(position - 1)
  );
  return { x: x + width / 2, y: y + height * 0.75 };
};

test("each Row move fires one mq-change, by button, Alt+↓ or drag", async ({
  page,
}) => {
  await open(page, [[["One"]], [["Two"]], [["Three"]]]);
  const before = Number(await changeCount(page).textContent());

  await clickRowTool(page, 1, "Move Row down");
  await expect(structure(page)).resolves.toEqual([
    [["Two"]],
    [["One"]],
    [["Three"]],
  ]);
  await expect(changeCount(page)).toHaveText(String(before + 1));

  await selectRow(page, 1);
  await page.keyboard.press("Alt+ArrowDown");
  await expect(structure(page)).resolves.toEqual([
    [["One"]],
    [["Two"]],
    [["Three"]],
  ]);
  await expect(changeCount(page)).toHaveText(String(before + 2));

  const to = await belowMiddleOf(page, 3);
  await pickUp(page, await grip(page, 1, "handle"));
  await moveTo(page, to);
  await letGo(page);
  await expect(structure(page)).resolves.toEqual([
    [["Two"]],
    [["Three"]],
    [["One"]],
  ]);
  await expect(changeCount(page)).toHaveText(String(before + 3));
});

test.describe("dragging a Row", () => {
  for (const by of ["handle", "tag"] as const) {
    test(`by its ${by} moves it between Rows, as one undo step`, async ({
      page,
    }) => {
      await open(page, [[["One"]], [["Two"]], [["Three"]]]);

      const to = await belowMiddleOf(page, 2);
      await pickUp(page, await grip(page, 1, by));
      await moveTo(page, to);
      await expect(canvas(page).locator(".drop-indicator")).toBeVisible();
      // A Row only ever lands between Rows, never in a Column.
      await expect(canvas(page).locator("[data-drop-target]")).toHaveCount(0);
      await letGo(page);
      await expect(
        canvas(page).locator("[data-drag-ghost], [data-drag-source]")
      ).toHaveCount(0);

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
  }

  test("shows the line between Rows where it will land", async ({ page }) => {
    await open(page, [[["One"]], [["Two"]], [["Three"]]]);
    const third = await boxOf(canvas(page).locator(".row").nth(2));

    const to = await belowMiddleOf(page, 3);
    await pickUp(page, await grip(page, 1, "handle"));
    await moveTo(page, to);

    const line = await boxOf(canvas(page).locator(".drop-indicator"));
    expect(line.y + line.height / 2).toBeCloseTo(third.y + third.height, 0);
    expect(line.x).toBeCloseTo(third.x, 0);
    expect(line.width).toBeCloseTo(third.width, 0);
    await letGo(page);

    await expect(structure(page)).resolves.toEqual([
      [["Two"]],
      [["Three"]],
      [["One"]],
    ]);
  });

  test("letting go where it started moves nothing", async ({ page }) => {
    await open(page, [[["One"]], [["Two"]], [["Three"]]]);
    const changes = await changeCount(page).textContent();
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
    await expect(changeCount(page)).toHaveText(changes as string);
  });

  test("letting go far from the email moves nothing", async ({ page }) => {
    await open(page, [[["One"]], [["Two"]]]);
    const changes = await changeCount(page).textContent();
    const editor = await boxOf(canvas(page));

    await pickUp(page, await grip(page, 1, "handle"));
    await moveTo(page, { x: 10, y: editor.y - 200 });
    await expect(canvas(page).locator(".drop-indicator")).toBeHidden();
    await letGo(page);

    await expect(structure(page)).resolves.toEqual([[["One"]], [["Two"]]]);
    await expect(changeCount(page)).toHaveText(changes as string);
  });

  test("keeps its text's editor, cursor and undo history", async ({ page }) => {
    await open(page, [[["One"]], [["Two"]]]);
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
    await open(page, [[["One"]], [["Two"]], [["Three"]]]);
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

  test("Alt+↓ does nothing while it's being dragged", async ({ page }) => {
    await open(page, [[["One"]], [["Two"]]]);
    await selectRow(page, 1);

    await pickUp(page, await grip(page, 1, "handle"));
    await page.keyboard.press("Alt+ArrowDown");
    await page.keyboard.press("Escape");
    await letGo(page);

    await expect(structure(page)).resolves.toEqual([[["One"]], [["Two"]]]);
  });
});
