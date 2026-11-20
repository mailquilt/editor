import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  addRow,
  addText,
  announcement,
  blockWith,
  boxOf,
  canvas,
  chooseLayout,
  currentValue,
  deleteBlock,
  deleteRow,
  emailWith,
  EXPORT_VIEWPORT,
  layoutOption,
  openBlocks,
  openExport,
  openTestPage,
  rowTools,
  selectedBlock,
  selectedText,
  selectRow,
  selectRowButton,
  setValue,
  structure,
  test,
  textBlock,
  textOf,
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

const widths = async (page: Page, rowIndex = 0) => {
  const { rows } = await currentValue(page);
  return rows[rowIndex]?.columns.map(({ width }) => width);
};

/** Column positions as a person sees them, from the exported HTML. */
const exportedColumnBoxes = async (page: Page) => {
  const { opened: email } = await openExport(page, EXPORT_VIEWPORT);
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
      element.shadowRoot?.querySelectorAll('[data-testid="column"]') ?? [],
      (column) => Math.round(column.getBoundingClientRect().width)
    )
  );

test.beforeEach(async ({ page }) => {
  await openTestPage(page);
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
});

test.describe("deleting a Block", () => {
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

  test("from the keyboard, leaves focus where a second Enter adds nothing and undo still works", async ({
    page,
  }) => {
    await textBlock(page).click();
    await deleteBlock(page).focus();

    await page.keyboard.press("Enter");

    await expect(textBlock(page)).toHaveCount(0);
    await expect(toolbar(page)).toBeFocused();
    await page.keyboard.press("Enter");
    expect(await structure(page)).toStrictEqual([[[]]]);
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("from the keyboard, focus moves straight to the next Block, or else the one before, and it's announced", async ({
    page,
  }) => {
    await setValue(page, emailWith([[["A", "B", "C"]]]));
    await blockWith(page, "B").focus();

    await deleteBlock(page).focus();
    // Where focus goes on the way, which a screen reader may say.
    await canvas(page).evaluate((element) => {
      const focused: string[] = [];
      Object.assign(window, { focused });
      element.shadowRoot?.addEventListener("focusin", ({ target }) => {
        focused.push((target as HTMLElement).dataset.place ?? "");
      });
    });
    await page.keyboard.press("Enter");
    await expect(blockWith(page, "C")).toBeFocused();
    await expect(announcement(page)).toHaveText("Block deleted.");
    await expect(
      page.evaluate(() => Reflect.get(window, "focused"))
    ).resolves.toStrictEqual(["block"]);

    await deleteBlock(page).focus();
    await page.keyboard.press("Enter");
    await expect(blockWith(page, "A")).toBeFocused();
    expect(await structure(page)).toStrictEqual([[["A"]]]);
  });

  test("with the mouse, deleting leaves nothing selected", async ({ page }) => {
    await setValue(page, emailWith([[["A", "B"]]]));
    await blockWith(page, "A").click();

    await deleteBlock(page).click();

    await expect(announcement(page)).toHaveText("Block deleted.");
    expect(await structure(page)).toStrictEqual([[["B"]]]);
    await expect(selectedBlock(page)).toHaveCount(0);
  });
});

test.describe("an empty Column", () => {
  test("stays, and can be given a Text Block", async ({ page }) => {
    await chooseLayout(page, 1, "50/50");
    await expect(addToColumn(page)).toHaveCount(1);

    await addToColumn(page).click();
    await page.keyboard.type("Right");

    await expect(addToColumn(page)).toHaveCount(0);
    await expect(selectedText(page)).toHaveText("Right");
    expect(await structure(page)).toStrictEqual([[["Hello"], ["Right"]]]);
  });

  test("keeps its controls inside a narrow Column", async ({ page }) => {
    await openBlocks(page, ["text"], [], [], []);
    const column = canvas(page).getByTestId("column").nth(1);
    const box = await boxOf(column);

    const controls = await column.getByRole("button").all();
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      // oxlint-disable-next-line no-await-in-loop -- One at a time, to name the one that's out.
      const inner = await boxOf(control);
      expect(inner.x).toBeGreaterThanOrEqual(box.x);
      expect(inner.x + inner.width).toBeLessThanOrEqual(box.x + box.width);
    }
  });
});

test.describe("adding and deleting Rows", () => {
  test("the Rows tab selects the Row it adds, so the next goes after it", async ({
    page,
  }) => {
    // A Row after the selected one, so that "after it" isn't also the end.
    await setValue(page, emailWith([[["A"]], [["B"]]]));
    await textOf(page, "A").click();

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
    const email = await currentValue(page);
    const [row] = email.rows;
    if (row?.columns[0]) {
      row.columns[0].width = 40;
      row.columns.push({ blocks: [], id: "other", props: {}, width: 60 });
    }
    await setValue(page, email);
    await expect(addToColumn(page)).toHaveCount(1);

    await selectRow(page, 1);
    const layouts = canvas(page)
      .getByTestId("side-panel")
      .getByRole("group", { name: "Layout" });
    await expect(layouts).toBeVisible();
    await expect(layouts.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(canvas(page).getByText("Custom layout")).toBeVisible();
  });

  test("keeps the moved Block's editor, and undo puts Blocks back in their Columns, still editable", async ({
    page,
  }) => {
    await chooseLayout(page, 1, "50/50");
    await addToColumn(page).click();
    await page.keyboard.type("Right");
    await expect(selectedText(page)).toHaveText("Right");
    await selectedText(page).evaluate((element) => {
      element.dataset.kept = "";
    });
    await chooseLayout(page, 1, "100");
    expect(await structure(page)).toStrictEqual([[["Hello", "Right"]]]);
    await expect(textBlock(page).last()).toHaveAttribute("data-kept", "");

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
  test("the Rows tab adds an empty full-width Row at the end, and a keyboard undo with nothing focused takes it back", async ({
    page,
  }) => {
    await addRow(page);
    await expect(rowTools(page, 2)).toBeVisible();
    expect(await structure(page)).toStrictEqual([[["Hello"]], [[]]]);
    expect(await widths(page, 1)).toStrictEqual([100]);

    await undoByKey(page);

    await expect(rowTools(page, 2)).toHaveCount(0);
  });
});
