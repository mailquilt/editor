import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  addRow,
  blockTool,
  canvas,
  chooseLayout,
  deleteRow,
  emailWith,
  exportHtml,
  layoutOption,
  openTab,
  selectRow,
  rowTools,
  setValue,
  showPalette,
  textBlock,
} from "./helpers.js";

type Document = NonNullable<MailQuilt["value"]>;

const addText = async (page: Page) => {
  const text = await showPalette(page, "Text");
  await text.click();
};

const deleteBlock = (page: Page) => blockTool(page, "Delete Block");

const rowControls = rowTools;

/** Selects the Row, then gives the layout in its side panel. */
const shownLayout = async (page: Page, position: number, layout: string) => {
  await selectRow(page, position);
  return layoutOption(page, layout);
};

const deleteRowButton = (page: Page, position: number) =>
  rowControls(page, position).getByRole("button", { name: "Delete Row" });

const addToColumn = (page: Page) =>
  page.getByRole("button", { name: "Add Text Block here" });

const toolbar = (page: Page) =>
  page.getByRole("group", { name: "Email tools" });

const selectedBlock = (page: Page) =>
  canvas(page).locator('[aria-current="true"]').getByRole("textbox");

const currentValue = (page: Page) =>
  canvas(page).evaluate((element) => (element as MailQuilt).value as Document);

const textOf = (block: Document["rows"][0]["columns"][0]["blocks"][0]) => {
  const { content } = block.props as {
    content: { content: { content?: { text: string }[] }[] };
  };
  return content.content
    .flatMap((paragraph) => paragraph.content ?? [])
    .map(({ text }) => text)
    .join("");
};

/** Each Row's Columns, as the text of each Column's Blocks. */
const structure = async (page: Page) => {
  const { rows } = await currentValue(page);
  return rows.map((row) =>
    row.columns.map((column) => column.blocks.map(textOf))
  );
};

const widths = async (page: Page, rowIndex = 0) => {
  const { rows } = await currentValue(page);
  return rows[rowIndex]?.columns.map(({ width }) => width);
};

const undo = (page: Page) => page.keyboard.press("ControlOrMeta+z");
const redo = (page: Page) => page.keyboard.press("ControlOrMeta+Shift+z");

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
    await undo(page);
    await expect(textBlock(page)).toHaveText("");
    expect(await structure(page)).toStrictEqual([[[""]]]);

    await page.getByRole("button", { name: "Undo" }).click();

    await expect(textBlock(page)).toHaveCount(0);
    expect(await structure(page)).toStrictEqual([]);
  });

  test("fires one mq-change for each addition", async ({ page }) => {
    await addText(page);

    await expect(textBlock(page)).toHaveCount(2);
    await expect(page.getByTestId("change-count")).toHaveText("1");
  });

  test("is one undo step, and redo brings the Block back", async ({ page }) => {
    await addText(page);
    await expect(textBlock(page)).toHaveCount(2);

    await undo(page);
    await expect(textBlock(page)).toHaveCount(1);

    await redo(page);
    await expect(textBlock(page)).toHaveCount(2);
    expect(await structure(page)).toStrictEqual([[["Hello", ""]]]);
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

    await undo(page);

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
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("from the keyboard, focus moves to the next Block, or else the one before, and it's announced", async ({
    page,
  }) => {
    await setValue(page, emailWith([[["A", "B", "C"]]]));
    const block = (text: string) =>
      canvas(page)
        .getByRole("group", { name: "Text Block" })
        .filter({ hasText: text });
    await block("B").focus();

    await deleteBlock(page).focus();
    await page.keyboard.press("Enter");
    await expect(block("C")).toBeFocused();
    await expect(canvas(page).getByRole("status")).toHaveText("Block deleted.");

    await deleteBlock(page).focus();
    await page.keyboard.press("Enter");
    await expect(block("A")).toBeFocused();
    expect(await structure(page)).toStrictEqual([[["A"]]]);
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
});

test.describe("adding and deleting Rows", () => {
  test("the Rows tab adds an empty full-width Row at the end", async ({
    page,
  }) => {
    await addRow(page);

    await expect(rowControls(page, 2)).toBeVisible();
    expect(await structure(page)).toStrictEqual([[["Hello"]], [[]]]);
    expect(await widths(page, 1)).toStrictEqual([100]);
  });

  test("the Rows tab selects the Row it adds, so the next goes after it", async ({
    page,
  }) => {
    await textBlock(page).click();

    await addRow(page, "50/50");
    await addRow(page, "33/67");

    expect(await widths(page, 1)).toStrictEqual([50, 50]);
    expect(await widths(page, 2)).toStrictEqual([33, 67]);
    await expect(
      rowControls(page, 3).getByRole("button", { name: "Select Row" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("the Rows tab adds after the selected Block's Row", async ({ page }) => {
    await addRow(page);
    await addToColumn(page).click();
    await page.keyboard.type("Last");
    await expect(selectedBlock(page)).toHaveText("Last");
    await textBlock(page).first().click();

    await addRow(page);

    await expect(rowControls(page, 3)).toBeVisible();
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

  test("each is one undo step", async ({ page }) => {
    await addRow(page);
    await expect(rowControls(page, 2)).toBeVisible();
    // The added Row's tools have focus, and show over the first Row's.
    await deleteRowButton(page, 1).focus();
    await page.keyboard.press("Enter");
    await expect(textBlock(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(textBlock(page)).toHaveText("Hello");
    expect(await structure(page)).toStrictEqual([[["Hello"]], [[]]]);

    await page.getByRole("button", { name: "Undo" }).click();
    expect(await structure(page)).toStrictEqual([[["Hello"]]]);

    await page.getByRole("button", { name: "Redo" }).click();
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(textBlock(page)).toHaveCount(0);
    expect(await structure(page)).toStrictEqual([[[]]]);
  });

  test("deleting the Row that has focus moves focus to the toolbar", async ({
    page,
  }) => {
    await textBlock(page).click();

    await deleteRow(page, 1);

    await expect(toolbar(page)).toBeFocused();
    await undo(page);
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
    await expect(rowControls(page, 3)).toBeVisible();
    await deleteRowButton(page, 2).focus();

    await page.keyboard.press("Enter");
    await expect(
      rowControls(page, 2).getByRole("button", { name: "Select Row" })
    ).toBeFocused();
    await expect(canvas(page).getByRole("status")).toHaveText("Row deleted.");

    await deleteRowButton(page, 2).focus();
    await page.keyboard.press("Enter");
    await expect(
      rowControls(page, 1).getByRole("button", { name: "Select Row" })
    ).toBeFocused();
    expect(await structure(page)).toStrictEqual([[["Hello"]]]);
  });

  test("deleting another Row from the keyboard leaves the selected Block alone", async ({
    page,
  }) => {
    await addRow(page);
    await expect(rowControls(page, 2)).toBeVisible();
    await textBlock(page).click();
    await deleteRowButton(page, 2).focus();

    await page.keyboard.press("Enter");
    await expect(rowControls(page, 2)).toHaveCount(0);
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

  test("switching to fewer Columns keeps every Block, ending in the last Column left", async ({
    page,
  }) => {
    await chooseLayout(page, 1, "33/33/33");
    await addToColumn(page).first().click();
    await page.keyboard.type("Two");
    await expect(selectedBlock(page)).toHaveText("Two");
    await addToColumn(page).click();
    await page.keyboard.type("Three");
    await expect(selectedBlock(page)).toHaveText("Three");

    await chooseLayout(page, 1, "50/50");

    expect(await structure(page)).toStrictEqual([
      [["Hello"], ["Two", "Three"]],
    ]);
    await expect(textBlock(page)).toHaveCount(3);
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
    await page.keyboard.press("End");
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

    await page.getByRole("button", { name: "Undo" }).click();

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

  test("is one undo step that also removes added Columns", async ({ page }) => {
    await chooseLayout(page, 1, "25/25/25/25");
    await expect(addToColumn(page)).toHaveCount(3);

    await page.getByRole("button", { name: "Undo" }).click();

    await expect(addToColumn(page)).toHaveCount(0);
    expect(await widths(page)).toStrictEqual([100]);
    await expect(page.getByTestId("change-count")).toHaveText("2");
  });

  test("choosing the current layout changes nothing and adds no undo step", async ({
    page,
  }) => {
    await chooseLayout(page, 1, "100");

    await expect(page.getByTestId("change-count")).toHaveText("0");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("change-count")).toHaveText("0");
  });

  test("gives each Row its own layout", async ({ page }) => {
    await addRow(page);

    await chooseLayout(page, 2, "67/33");

    expect(await widths(page, 0)).toStrictEqual([100]);
    expect(await widths(page, 1)).toStrictEqual([67, 33]);
  });
});

test.describe("structure changes and the rest of the editor", () => {
  test("the formatting toolbar acts on the moved Block", async ({ page }) => {
    await chooseLayout(page, 1, "50/50");
    await addToColumn(page).click();
    await page.keyboard.type("x");
    await expect(selectedBlock(page)).toHaveText("x");
    await chooseLayout(page, 1, "100");
    await textBlock(page).last().click();
    await expect(selectedBlock(page)).toBeFocused();

    await page.keyboard.press("ControlOrMeta+a");
    await page.getByRole("button", { name: "Bold" }).click();

    await expect(selectedBlock(page).locator("strong")).toHaveText("x");
  });

  test("undo in the link field doesn't undo the email", async ({ page }) => {
    await textBlock(page).click();
    await page.keyboard.type("x");
    await expect(page.getByTestId("change-count")).toHaveText("1");
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    await expect(page.getByRole("textbox", { name: "Link URL" })).toBeFocused();
    // Typed, because a filled value leaves nothing for the field's own undo.
    await page.keyboard.type("https");

    await undo(page);

    await expect(textBlock(page)).toHaveText("Hellox");
  });

  test("a keyboard undo works with focus on a Rows tab thumbnail", async ({
    page,
  }) => {
    await addRow(page);
    await expect(rowControls(page, 2)).toBeVisible();
    await openTab(page, "Rows");
    await canvas(page)
      .getByRole("group", { name: "Add a Row" })
      .getByRole("button", { exact: true, name: "100" })
      .focus();

    await undo(page);

    await expect(rowControls(page, 2)).toHaveCount(0);
  });

  test("a keyboard undo works after adding a Row with nothing focused", async ({
    page,
  }) => {
    await addRow(page);
    await expect(rowControls(page, 2)).toBeVisible();

    await undo(page);

    await expect(rowControls(page, 2)).toHaveCount(0);
  });

  test("a keyboard undo works after clicking a layout with nothing focused", async ({
    page,
  }) => {
    await chooseLayout(page, 1, "50/50");
    await expect(addToColumn(page)).toHaveCount(1);

    await undo(page);

    await expect(addToColumn(page)).toHaveCount(0);
  });

  test("a keyboard undo works after clicking Delete Row with nothing focused", async ({
    page,
  }) => {
    await deleteRow(page, 1);
    await expect(textBlock(page)).toHaveCount(0);

    await undo(page);

    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("the Undo button closes the link field and returns to the Block", async ({
    page,
  }) => {
    await textBlock(page).click();
    await page.keyboard.type("x");
    await expect(page.getByTestId("change-count")).toHaveText("1");
    await page.keyboard.press("ControlOrMeta+a");
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    const field = page.getByRole("textbox", { name: "Link URL" });
    await expect(field).toBeFocused();

    await page.getByRole("button", { name: "Undo" }).click();

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

    await page.getByRole("button", { name: "Undo" }).click();

    await expect(field).toBeVisible();
  });

  test("a keyboard undo works with focus on a Row's controls", async ({
    page,
  }) => {
    await addRow(page);
    await expect(rowControls(page, 2)).toBeVisible();
    await deleteRowButton(page, 1).focus();

    await undo(page);

    await expect(rowControls(page, 2)).toHaveCount(0);
  });
});
