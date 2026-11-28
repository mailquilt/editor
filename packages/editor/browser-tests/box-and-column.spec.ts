import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  barButton,
  blockWith,
  boxOf,
  canvas,
  currentValue,
  exportHtml,
  field,
  morePanel,
  openEmail,
  openMore,
  selectionBar,
  selectNothing,
  selectRow,
  setValue,
  test,
  undo,
  violations,
} from "./helpers.js";

/** Wide enough for More to dock beside the email. */
const editorOf = async (page: Page, width: number) => {
  await page.addStyleTag({
    content: `main { padding: 0 !important } mail-quilt { width: ${width}px !important }`,
  });
};

const columnProps = async (page: Page, row: number, column: number) => {
  const { rows } = await currentValue(page);
  return rows[row - 1]?.columns[column - 1]?.props;
};

/** A Column's box on the Canvas: what the email shows of it. */
const columnBox = (page: Page, position: number) =>
  canvas(page)
    .getByTestId("column")
    .nth(position - 1)
    .getByTestId("column-box");

test.describe("a Column", () => {
  test("is chosen from the chip's menu, its settings change as one undo step, and Escape goes back to its first Block", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]]]);
    await blockWith(page, "B").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    const item = canvas(page).getByRole("menuitem", { name: "Column 2" });
    await page.keyboard.press("ArrowDown");
    await expect(item).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(selectionBar(page)).toHaveAccessibleName("Column 2 settings");
    await expect(barButton(page, "Row 1 / Column 2")).toBeFocused();

    await selectionBar(page)
      .getByRole("group", { exact: true, name: "Align" })
      .getByRole("button", { exact: true, name: "Bottom" })
      .click();
    await barButton(page, "Border: None").click();
    await field(page, "Border width (px)").fill("2");
    await page.keyboard.press("Enter");
    expect(await columnProps(page, 1, 2)).toEqual({
      borderWidth: 2,
      verticalAlign: "bottom",
    });
    // The Canvas draws the border as the export does.
    await expect(columnBox(page, 2)).toHaveCSS(
      "border-top",
      "2px solid rgb(0, 0, 0)"
    );
    expect(await exportHtml(page)).toContain("border:2px solid #000000;");

    await undo(page);
    expect(await columnProps(page, 1, 2)).toEqual({ verticalAlign: "bottom" });

    await barButton(page, "Row 1 / Column 2").focus();
    await page.keyboard.press("Escape");
    await expect(blockWith(page, "B")).toBeFocused();
    await expect(selectionBar(page)).toHaveAccessibleName("Text settings");
  });

  test("selected, leaves the Blocks out of Tab, so Shift+Tab from the bar keeps it selected", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]]]);
    await blockWith(page, "B").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(barButton(page, "Row 1 / Column 2")).toBeFocused();

    await page.keyboard.press("Shift+Tab");

    await expect(blockWith(page, "A")).not.toBeFocused();
    await expect(selectionBar(page)).toHaveAccessibleName("Column 2 settings");
  });

  test("is chosen by a press on its own space, beside its Blocks", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B", "C"], ["D"]]]);
    const column = canvas(page).getByTestId("column").nth(1);
    const { height, width } = await boxOf(column);
    // Below its one Block, in the room its taller neighbour makes.
    await column.click({ position: { x: width / 2, y: height - 10 } });
    await expect(selectionBar(page)).toHaveAccessibleName("Column 2 settings");
  });
});

test.describe("an empty Column", () => {
  test("is chosen from its Row's chip, and Escape goes out to the Row", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], []]]);
    await selectRow(page, 1);
    await barButton(page, "Row 1").press("Enter");
    await canvas(page)
      .getByRole("menuitem", { name: "Column 2" })
      .press("Enter");
    await expect(selectionBar(page)).toHaveAccessibleName("Column 2 settings");
    await expect(barButton(page, "Row 1 / Column 2")).toBeFocused();

    // From a control the Row's bar doesn't have, so focus can't stay put.
    // Reached from the keyboard, its tooltip shows, which the first Escape
    // closes.
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowLeft");
    await expect(barButton(page, "Border: None")).toBeFocused();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(selectionBar(page)).toHaveAccessibleName("Row 1 settings");
    await expect(barButton(page, "Row 1")).toBeFocused();
  });
});

test.describe("a Column's selection", () => {
  test("clears with a press on the workspace, as a Block's does", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]]]);
    await blockWith(page, "A").focus();
    await barButton(page, "Row 1 / Text").click();
    await canvas(page).getByRole("menuitem", { name: "Column 1" }).click();
    await expect(selectionBar(page)).toHaveAccessibleName("Column 1 settings");

    await selectNothing(page);
  });
});

test.describe("a Row's copy", () => {
  test("keeps its Columns' settings", async ({ page }) => {
    await openEmail(page, [[["A"], ["B"]]]);
    const email = await currentValue(page);
    const column = email.rows[0]?.columns[1] as { props: object };
    column.props = { verticalAlign: "bottom" };
    await setValue(page, email);
    await selectRow(page, 1);

    await barButton(page, "Duplicate Row").click();

    expect(await columnProps(page, 2, 2)).toEqual({ verticalAlign: "bottom" });
  });
});

test.describe("a Block's Box", () => {
  test("sets its padding, background, border and corners from More, as the export draws them", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await editorOf(page, 1400);
    await blockWith(page, "A").focus();
    const more = await openMore(page);

    // From the keyboard, as a popover opens with focus in its first field.
    await more.getByRole("button", { name: "Border: None" }).press("Enter");
    await field(page, "Border width (px)").fill("3");
    await page.keyboard.press("Enter");
    await field(page, "Corners (px)").fill("8");
    await page.keyboard.press("Enter");
    await more.getByRole("button", { name: "Padding: 16 px" }).press("Enter");
    await field(page, "Every side (px)").fill("4");
    await page.keyboard.press("Enter");

    const { rows } = await currentValue(page);
    expect(rows[0]?.columns[0]?.blocks[0]?.props).toMatchObject({
      borderRadius: 8,
      borderWidth: 3,
      paddingBottom: 4,
      paddingLeft: 4,
      paddingRight: 4,
      paddingTop: 4,
    });
    const block = canvas(page).getByRole("group", { name: /^Text Block/u });
    await expect(block).toHaveCSS("border-top-left-radius", "8px");
    await expect(block).toHaveCSS("border-top-width", "3px");
    await expect(block.getByRole("textbox")).toHaveCSS("padding-top", "4px");
    expect(await exportHtml(page)).toContain(
      'class="mq-box" style="border:3px solid #000000;border-radius:8px;'
    );
    await expect(
      morePanel(page).getByText("Outlook on Windows shows square corners.")
    ).toBeVisible();
  });
});

test.describe("automated accessibility checks of Box and a Column", () => {
  test.use({ reducedMotion: "reduce" });

  test("pass with a Column selected, and with More's Border open", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]]]);
    await editorOf(page, 1400);
    await blockWith(page, "A").focus();
    await barButton(page, "Row 1 / Text").click();
    await canvas(page).getByRole("menuitem", { name: "Column 1" }).click();
    await expect(selectionBar(page)).toHaveAccessibleName("Column 1 settings");
    expect(await violations(page)).toEqual([]);

    await blockWith(page, "A").focus();
    const more = await openMore(page);
    await more.getByRole("button", { name: "Border: None" }).press("Enter");
    await expect(field(page, "Border width (px)")).toBeFocused();
    expect(await violations(page)).toEqual([]);
  });
});
