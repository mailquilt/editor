import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  addPanel,
  announcement,
  barButton,
  blockGroup,
  blockTypes,
  blockWith,
  boxOf,
  canvas,
  currentValue,
  layoutTile,
  openAddPanel,
  openBlocks,
  openEmail,
  palette,
  selectedBlock,
  selectionBar,
  selectNothing,
  setValue,
  test,
  violations,
} from "./helpers.js";

const picker = (page: Page) => canvas(page).getByTestId("add-picker");

/**
 * Rests the mouse at the edge below a Block, by its type or else its text,
 * where its + shows, and presses it.
 */
const pressPlusBelow = async (page: Page, name: string, text?: string) => {
  const target =
    text === undefined ? blockGroup(page, name) : blockWith(page, text);
  await target.scrollIntoViewIfNeeded();
  const block = await boxOf(target);
  await page.mouse.move(block.x + 20, block.y + block.height - 2);
  const plus = canvas(page)
    .getByTestId("insert-button")
    .filter({ visible: true });
  await expect(plus).toHaveCount(1);
  await plus.click();
};

test.describe("the Add panel", () => {
  test("opens with / from a Block, adds after it, and Escape goes back to the new Block", async ({
    page,
  }) => {
    await openBlocks(page, ["heading", "button"]);
    await blockGroup(page, "Heading").focus();

    await page.keyboard.press("/");
    await expect(
      addPanel(page).getByRole("textbox", { name: "Search Blocks and Rows" })
    ).toBeFocused();

    // Down to the Blocks, then along them to Divider.
    await page.keyboard.press("ArrowDown");
    await expect(palette(page, "Text")).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(palette(page, "Divider")).toBeFocused();
    await page.keyboard.press("Enter");

    expect(await blockTypes(page)).toStrictEqual([
      "heading",
      "divider",
      "button",
    ]);
    await expect(selectedBlock(page)).toHaveAccessibleName(/^Divider Block/u);
    await expect(announcement(page)).toHaveText(
      "Divider Block added, Row 1, Column 1, position 2 of 3."
    );
    // It stays open, to add another.
    await expect(addPanel(page)).toBeVisible();

    await palette(page, "Divider").focus();
    await page.keyboard.press("Escape");
    await expect(addPanel(page)).toHaveCount(0);
    await expect(blockGroup(page, "Divider")).toBeFocused();
  });

  test("its search shows the Blocks that match, and Enter adds the first", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await selectNothing(page);
    await barButton(page, "Add").click();
    const search = addPanel(page).getByRole("textbox", {
      name: "Search Blocks and Rows",
    });
    await expect(search).toBeFocused();

    await search.fill("tabel");
    await expect(addPanel(page)).toContainText("Nothing called “tabel”");
    // In a live region that was there before, so a screen reader hears it.
    await expect(addPanel(page).locator('[aria-live="polite"]')).toHaveText(
      "Nothing called “tabel” Try Text, Image or Button."
    );
    await expect(
      addPanel(page).getByRole("button", { name: /^Add/u })
    ).toHaveCount(0);

    await search.fill("ima");
    await expect(
      addPanel(page).getByRole("button", { name: /^Add/u })
    ).toHaveText(["Image"]);
    await page.keyboard.press("Enter");

    // With nothing selected, at the end of the email.
    expect(await blockTypes(page)).toStrictEqual(["button", "image"]);
  });

  test("over the Canvas's start, closes once it adds, so the new Block is in sight", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await page.addStyleTag({
      content:
        "main { padding: 0 !important } mail-quilt { width: 900px !important }",
    });
    await openAddPanel(page);

    await palette(page, "Text").click();

    await expect(addPanel(page)).toHaveCount(0);
    await expect(selectedBlock(page).getByRole("textbox")).toBeFocused();
  });

  test("adds an empty Row after what's selected, and Escape goes to the Row's chip", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await openAddPanel(page);
    await layoutTile(page, "50/50").click();

    await expect(selectionBar(page)).toHaveAccessibleName("Row 2 settings");
    await addPanel(page)
      .getByRole("textbox", { name: "Search Blocks and Rows" })
      .click();
    await page.keyboard.press("Escape");

    await expect(addPanel(page)).toHaveCount(0);
    await expect(barButton(page, "Row 2")).toBeFocused();
  });

  test("comes before the email for Tab, as it's drawn before it", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await openAddPanel(page);
    await blockGroup(page, "Text").focus();

    await page.keyboard.press("Shift+Tab");

    await expect(layoutTile(page, "100")).toBeFocused();
  });

  test("has no accessibility violations", async ({ page }) => {
    await openBlocks(page, ["text"]);
    await openAddPanel(page);
    expect(await violations(page)).toStrictEqual([]);
  });
});

test.describe("the picker", () => {
  test("opens from the + between two Blocks, and adds below the Block above", async ({
    page,
  }) => {
    await openBlocks(page, ["heading", "button"]);
    await pressPlusBelow(page, "Heading");

    await expect(
      picker(page).getByRole("textbox", { name: "Search Blocks" })
    ).toBeFocused();
    await expect(picker(page)).toContainText(
      "Adds below the Heading, in Row 1"
    );
    expect(await violations(page)).toStrictEqual([]);

    await picker(page)
      .getByRole("button", { exact: true, name: "Add Image Block" })
      .click();

    expect(await blockTypes(page)).toStrictEqual([
      "heading",
      "image",
      "button",
    ]);
    await expect(picker(page)).toHaveCount(0);
    await expect(selectedBlock(page)).toHaveAccessibleName(/^Image Block/u);
  });

  test("closes once an undo takes away the Block it adds below", async ({
    page,
  }) => {
    await openBlocks(page, ["heading"], []);
    await canvas(page).getByTestId("add-blocks").click();
    await picker(page)
      .getByRole("button", { exact: true, name: "Add Divider Block" })
      .click();
    await pressPlusBelow(page, "Divider");
    await expect(picker(page)).toBeVisible();

    // Its Column is empty again, which has no place below a Block.
    await page.keyboard.press("ControlOrMeta+z");

    expect(await blockTypes(page, 0, 1)).toStrictEqual([]);
    await expect(picker(page)).toHaveCount(0);
  });

  test("closes once the Host app's email no longer has the Block it adds below", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B", "C"]]]);
    await pressPlusBelow(page, "Text", "B");
    await expect(picker(page)).toBeVisible();

    const email = await currentValue(page);
    const column = email.rows[0]?.columns[0];
    if (column) {
      column.blocks = column.blocks.filter((_, index) => index !== 1);
    }
    await setValue(page, email);

    // Not moved below C, where it would add in the wrong place.
    await expect(picker(page)).toHaveCount(0);
  });

  test("below the email's last Block, opens above its line, inside the Canvas", async ({
    page,
  }) => {
    // Tall enough that the email ends where the Canvas does.
    await openEmail(page, [[[..."ABCDEFGHI"]]]);
    await pressPlusBelow(page, "Text", "I");

    const box = await boxOf(picker(page));
    const workspace = await boxOf(canvas(page).getByTestId("workspace"));
    expect(box.y + box.height).toBeLessThanOrEqual(
      workspace.y + workspace.height
    );
  });

  test("a press elsewhere closes it, adding nothing", async ({ page }) => {
    await openBlocks(page, ["heading", "button"]);
    await pressPlusBelow(page, "Heading");
    await expect(picker(page)).toBeVisible();

    await blockGroup(page, "Heading").click();

    await expect(picker(page)).toHaveCount(0);
    expect(await blockTypes(page)).toStrictEqual(["heading", "button"]);
  });
});

test("the picker in a narrow first Column stays inside the Canvas", async ({
  page,
}) => {
  await openEmail(page, [[["A", "B"], ["C"], ["D"], ["E"]]]);
  await page.addStyleTag({
    content:
      "main { padding: 0 !important } mail-quilt { width: 680px !important }",
  });
  await pressPlusBelow(page, "Text", "A");

  const box = await boxOf(picker(page));
  const workspace = await boxOf(canvas(page).getByTestId("workspace"));
  expect(box.x).toBeGreaterThanOrEqual(workspace.x);
  expect(box.x + box.width).toBeLessThanOrEqual(workspace.x + workspace.width);
});

test.describe("an empty Column", () => {
  test("is one stop for Tab, and opens the picker in it, which Escape closes", async ({
    page,
  }) => {
    await openBlocks(page, ["text"], []);
    const button = canvas(page).getByRole("button", {
      name: "Add a Block, or drop one here, in Row 1, Column 2",
    });
    await button.focus();

    await page.keyboard.press("Enter");
    const first = picker(page).getByRole("button", {
      exact: true,
      name: "Add Text Block",
    });
    await expect(first).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(picker(page)).toHaveCount(0);
    await expect(button).toBeFocused();

    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    expect(await blockTypes(page, 0, 1)).toStrictEqual(["heading"]);
    await expect(announcement(page)).toHaveText(
      "Heading Block added, Row 1, Column 2, position 1 of 1."
    );
  });
});
