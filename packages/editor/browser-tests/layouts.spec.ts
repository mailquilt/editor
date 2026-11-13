import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  addRow,
  addText,
  announcement,
  blockWith,
  boxOf,
  canvas,
  changeCount,
  chooseLayout,
  currentValue,
  deleteBlock,
  deleteRow,
  emailWith,
  exportHtml,
  layoutOption,
  moveCursorToLineEnd,
  openBlocks,
  rowTools,
  selectRow,
  selectRowButton,
  setValue,
  structure,
  textBlock,
  undo,
  undoByKey,
} from "./helpers.js";

/** Selects the Row, then gives the layout in its side panel. */
const shownLayout = async (page: Page, position: number, layout: string) => {
  await selectRow(page, position);
  return layoutOption(page, layout);
};

const deleteRowButton = (page: Page, position: number) =>
  rowTools(page, position).getByRole("button", { name: "Delete Row" });

const addToColumn = (page: Page) =>
  page.getByRole("button", { name: "Add Text Block here" });

const toolbar = (page: Page) =>
  page.getByRole("group", { name: "Email tools" });

const selectedBlock = (page: Page) =>
  canvas(page).locator('[aria-current="true"]').getByRole("textbox");

const widths = async (page: Page, rowIndex = 0) => {
  const { rows } = await currentValue(page);
  return rows[rowIndex]?.columns.map(({ width }) => width);
};

/** Column positions as a person sees them, from the exported HTML. */
const exportedColumnBoxes = async (page: Page) => {
  const html = await exportHtml(page);
  const email = await page.context().newPage();
  await email.setViewportSize({ height: 800, width: 1000 });
  await email.setContent(html);
  const boxes = await email.evaluate(() =>
    Array.from(
      document.querySelectorAll('[class*="mj-column-per-"]'),
      (column) => {
        const { top, width } = column.getBoundingClientRect();
        return { top: Math.round(top), width: Math.round(width) };
      }
    )
  );
  await email.close();
  return boxes;
};

const canvasColumnWidths = (page: Page) =>
  canvas(page).evaluate((element) =>
    Array.from(
      element.shadowRoot?.querySelectorAll(".row > *") ?? [],
      (column) => Math.round(column.getBoundingClientRect().width)
    )
  );

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");
});

test.describe("selecting a Block", () => {
  test("clicking another Block moves the selection", async ({ page }) => {
    await textBlock(page).click();
    await addText(page);
    await page.keyboard.type("Second");
    await expect(selectedBlock(page)).toHaveText("Second");

    await textBlock(page).first().click();

    await expect(selectedBlock(page)).toHaveText("Hello");
    await expect(selectedBlock(page)).toHaveCount(1);
  });
});

test.describe("the palette", () => {
  test("adds a Row for the Block when the email has no Rows, as one undo step", async ({
    page,
  }) => {
    await deleteRow(page, 1);
    await expect(textBlock(page)).toHaveCount(0);

    await addText(page);
    await expect(textBlock(page)).toHaveCount(1);
    await page.keyboard.type("A");
    await expect(textBlock(page)).toHaveText("A");
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("");
    expect(await structure(page)).toStrictEqual([[[""]]]);

    await undo(page);

    await expect(textBlock(page)).toHaveCount(0);
    expect(await structure(page)).toStrictEqual([]);
  });

  test("fires one mq-change for each addition", async ({ page }) => {
    await addText(page);

    await expect(textBlock(page)).toHaveCount(2);
    await expect(changeCount(page)).toHaveText("1");
  });
});

test.describe("deleting a Block", () => {
  test("removes it, keeps its Column and clears the selection", async ({
    page,
  }) => {
    await textBlock(page).click();

    await deleteBlock(page).click();

    await expect(textBlock(page)).toHaveCount(0);
    await expect(deleteBlock(page)).toHaveCount(0);
    expect(await structure(page)).toStrictEqual([[[]]]);
    await expect(addToColumn(page)).toBeVisible();
  });

  test("undo brings back an editable Block with its text", async ({ page }) => {
    await textBlock(page).click();
    await page.keyboard.type("!");
    await expect(textBlock(page)).toHaveText("Hello!");
    await deleteBlock(page).click();
    await expect(textBlock(page)).toHaveCount(0);

    await undoByKey(page);

    await expect(textBlock(page)).toHaveText("Hello!");
    await textBlock(page).click();
    await page.keyboard.type("?");
    await expect(textBlock(page)).toHaveText("Hello!?");
  });

  test("from the keyboard, leaves focus where undo still works", async ({
    page,
  }) => {
    await textBlock(page).click();
    await deleteBlock(page).focus();

    await page.keyboard.press("Enter");

    await expect(textBlock(page)).toHaveCount(0);
    await expect(toolbar(page)).toBeFocused();
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("from the keyboard, focus moves to the next Block, or else the one before, and it's announced", async ({
    page,
  }) => {
    await setValue(page, emailWith([[["A", "B", "C"]]]));
    await blockWith(page, "B").focus();

    await deleteBlock(page).focus();
    await page.keyboard.press("Enter");
    await expect(blockWith(page, "C")).toBeFocused();
    await expect(announcement(page)).toHaveText("Block deleted.");

    await deleteBlock(page).focus();
    await page.keyboard.press("Enter");
    await expect(blockWith(page, "A")).toBeFocused();
    expect(await structure(page)).toStrictEqual([[["A"]]]);
  });

  test("with the mouse, deleting selects nothing in its place", async ({
    page,
  }) => {
    await setValue(page, emailWith([[["A", "B"]]]));
    await blockWith(page, "A").click();

    await deleteBlock(page).click();

    await expect(announcement(page)).toHaveText("Block deleted.");
    expect(await structure(page)).toStrictEqual([[["B"]]]);
    await expect(
      canvas(page).locator('.block[aria-current="true"]')
    ).toHaveCount(0);
  });

  test("a second Enter from the keyboard doesn't add a Block", async ({
    page,
  }) => {
    await textBlock(page).click();
    await deleteBlock(page).focus();

    await page.keyboard.press("Enter");
    await expect(textBlock(page)).toHaveCount(0);
    await page.keyboard.press("Enter");

    expect(await structure(page)).toStrictEqual([[[]]]);
  });
});

test.describe("an empty Column", () => {
  test("stays, and can be given a Text Block", async ({ page }) => {
    await chooseLayout(page, 1, "50/50");
    await expect(addToColumn(page)).toHaveCount(1);

    await addToColumn(page).click();
    await page.keyboard.type("Right");

    await expect(addToColumn(page)).toHaveCount(0);
    await expect(selectedBlock(page)).toHaveText("Right");
    expect(await structure(page)).toStrictEqual([[["Hello"], ["Right"]]]);
  });

  test("keeps its controls inside a narrow Column", async ({ page }) => {
    await openBlocks(page, ["text"], [], [], []);
    const column = canvas(page).locator(".column").nth(1);
    const box = await boxOf(column);

    const controls = await column.getByRole("button").all();
    expect(controls).toHaveLength(6);
    for (const control of controls) {
      // oxlint-disable-next-line no-await-in-loop -- One at a time, to name the one that's out.
      const inner = await boxOf(control);
      expect(inner.x).toBeGreaterThanOrEqual(box.x);
      expect(inner.x + inner.width).toBeLessThanOrEqual(box.x + box.width);
    }
  });
});

test.describe("adding and deleting Rows", () => {
  test("the Rows tab adds an empty full-width Row at the end", async ({
    page,
  }) => {
    await addRow(page);

    await expect(rowTools(page, 2)).toBeVisible();
    expect(await structure(page)).toStrictEqual([[["Hello"]], [[]]]);
    expect(await widths(page, 1)).toStrictEqual([100]);
  });

  test("the Rows tab selects the Row it adds, so the next goes after it", async ({
    page,
  }) => {
    // A Row after the selected one, so that "after it" isn't also the end.
    await setValue(page, emailWith([[["A"]], [["B"]]]));
    await blockWith(page, "A").getByRole("textbox").click();

    await addRow(page, "50/50");
    await addRow(page, "33/67");

    expect(await structure(page)).toStrictEqual([
      [["A"]],
      [[], []],
      [[], []],
      [["B"]],
    ]);
    expect(await widths(page, 1)).toStrictEqual([50, 50]);
    expect(await widths(page, 2)).toStrictEqual([33, 67]);
    await expect(rowTools(page, 3)).toHaveAttribute("aria-current", "true");
  });

  test("the Rows tab adds after the selected Block's Row", async ({ page }) => {
    await addRow(page);
    await addToColumn(page).click();
    await page.keyboard.type("Last");
    await expect(selectedBlock(page)).toHaveText("Last");
    await textBlock(page).first().click();

    await addRow(page);

    await expect(rowTools(page, 3)).toBeVisible();
    expect(await structure(page)).toStrictEqual([
      [["Hello"]],
      [[]],
      [["Last"]],
    ]);
  });

  test("Delete Row removes the right Row with its Blocks", async ({ page }) => {
    await addRow(page);
    await addToColumn(page).click();
    await page.keyboard.type("Second");
    await expect(textBlock(page).last()).toHaveText("Second");

    await deleteRow(page, 1);

    await expect(textBlock(page)).toHaveText("Second");
    expect(await structure(page)).toStrictEqual([[["Second"]]]);
  });

  test("deleting the Row that has focus moves focus to the toolbar", async ({
    page,
  }) => {
    await textBlock(page).click();

    await deleteRow(page, 1);

    await expect(toolbar(page)).toBeFocused();
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("deleting a Row from the keyboard keeps focus in the editor", async ({
    page,
  }) => {
    await deleteRowButton(page, 1).focus();

    await page.keyboard.press("Enter");

    await expect(toolbar(page)).toBeFocused();
  });

  test("deleting a Row from the keyboard moves focus to the next Row, or else the one before, and it's announced", async ({
    page,
  }) => {
    await addRow(page);
    await addRow(page);
    await expect(rowTools(page, 3)).toBeVisible();
    await deleteRowButton(page, 2).focus();

    await page.keyboard.press("Enter");
    await expect(selectRowButton(page, 2)).toBeFocused();
    await expect(announcement(page)).toHaveText("Row deleted.");

    await deleteRowButton(page, 2).focus();
    await page.keyboard.press("Enter");
    await expect(selectRowButton(page, 1)).toBeFocused();
    expect(await structure(page)).toStrictEqual([[["Hello"]]]);
  });

  test("deleting another Row from the keyboard leaves the selected Block alone", async ({
    page,
  }) => {
    await addRow(page);
    await expect(rowTools(page, 2)).toBeVisible();
    await textBlock(page).click();
    await deleteRowButton(page, 2).focus();

    await page.keyboard.press("Enter");
    await expect(rowTools(page, 2)).toHaveCount(0);
    await page.keyboard.press("Enter");

    await expect(textBlock(page).locator("p")).toHaveCount(1);
  });
});

test.describe("choosing a layout", () => {
  test("33/33/33 shows and exports its Columns side by side", async ({
    page,
  }) => {
    await chooseLayout(page, 1, "33/33/33");

    await expect(await shownLayout(page, 1, "33/33/33")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(await widths(page)).toStrictEqual([33.33, 33.33, 33.34]);
    await expect(addToColumn(page)).toHaveCount(2);
    expect(await canvasColumnWidths(page)).toStrictEqual([200, 200, 200]);
    const boxes = await exportedColumnBoxes(page);
    expect(boxes.map(({ width }) => width)).toStrictEqual([200, 200, 200]);
    expect(new Set(boxes.map(({ top }) => top)).size).toBe(1);
  });

  test("shows no current layout for widths that aren't a preset", async ({
    page,
  }) => {
    const document = await currentValue(page);
    const [row] = document.rows;
    if (row?.columns[0]) {
      row.columns[0].width = 40;
      row.columns.push({ blocks: [], id: "other", props: {}, width: 60 });
    }
    await setValue(page, document);
    await expect(addToColumn(page)).toHaveCount(1);

    await selectRow(page, 1);
    const layouts = canvas(page)
      .locator(".side-panel")
      .getByRole("group", { name: "Layout" });
    await expect(layouts).toBeVisible();
    await expect(layouts.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(canvas(page).getByText("Custom layout")).toBeVisible();
  });

  test("keeps the moved Block's editor", async ({ page }) => {
    await chooseLayout(page, 1, "50/50");
    await addToColumn(page).click();
    await page.keyboard.type("abc");
    await expect(selectedBlock(page)).toHaveText("abc");
    await selectedBlock(page).evaluate((element) => {
      element.dataset.kept = "";
    });

    await chooseLayout(page, 1, "100");

    const moved = textBlock(page).last();
    await expect(moved).toHaveAttribute("data-kept", "");
    await moved.click();
    await moveCursorToLineEnd(page);
    await page.keyboard.type("d");
    await expect(selectedBlock(page)).toHaveText("abcd");
    expect(await structure(page)).toStrictEqual([[["Hello", "abcd"]]]);
  });

  test("undo puts Blocks back in their Columns, still editable", async ({
    page,
  }) => {
    await chooseLayout(page, 1, "50/50");
    await addToColumn(page).click();
    await page.keyboard.type("Right");
    await expect(selectedBlock(page)).toHaveText("Right");
    await chooseLayout(page, 1, "100");
    expect(await structure(page)).toStrictEqual([[["Hello", "Right"]]]);

    await undo(page);

    await expect(await shownLayout(page, 1, "50/50")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(await structure(page)).toStrictEqual([[["Hello"], ["Right"]]]);
    // A press elsewhere closes the picker, which covers the text.
    await page.mouse.click(5, 5);
    await textBlock(page).last().click();
    await page.keyboard.type("!");
    await expect(textBlock(page).last()).toHaveText("Right!");
  });
});

test.describe("structure changes and the rest of the editor", () => {
  test("undo in the link field doesn't undo the email", async ({ page }) => {
    await textBlock(page).click();
    await page.keyboard.type("x");
    await expect(changeCount(page)).toHaveText("1");
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    await expect(page.getByRole("textbox", { name: "Link URL" })).toBeFocused();
    // Typed, because a filled value leaves nothing for the field's own undo.
    await page.keyboard.type("https");

    await undoByKey(page);

    await expect(textBlock(page)).toHaveText("Hellox");
  });

  test("a keyboard undo works after adding a Row with nothing focused", async ({
    page,
  }) => {
    await addRow(page);
    await expect(rowTools(page, 2)).toBeVisible();

    await undoByKey(page);

    await expect(rowTools(page, 2)).toHaveCount(0);
  });

  test("the Undo button closes the link field and returns to the Block", async ({
    page,
  }) => {
    await textBlock(page).click();
    await page.keyboard.type("x");
    await expect(changeCount(page)).toHaveText("1");
    await page.keyboard.press("ControlOrMeta+a");
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    const field = page.getByRole("textbox", { name: "Link URL" });
    await expect(field).toBeFocused();

    await undo(page);

    await expect(field).toHaveCount(0);
    await expect(textBlock(page)).toHaveText("Hello");
    await expect(textBlock(page)).toBeFocused();
  });

  test("the Undo button leaves the link field open with nothing to undo", async ({
    page,
  }) => {
    await textBlock(page).click();
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    const field = page.getByRole("textbox", { name: "Link URL" });
    await expect(field).toBeFocused();

    await undo(page);

    await expect(field).toBeVisible();
  });
});
