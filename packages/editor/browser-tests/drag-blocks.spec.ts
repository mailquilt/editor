import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  canvas,
  chooseLayout,
  deleteRow,
  openTab,
  currentValue,
  emailWith,
  moveCursorToLineEnd,
  setValue,
  structure,
  textBlock,
} from "./helpers.js";

const blockElement = (page: Page, text: string) =>
  canvas(page).locator(".block:not([data-drag-ghost])", {
    has: page
      .getByRole("textbox", { name: "Text Block" })
      .getByText(text, { exact: true }),
  });

const handleOf = (page: Page, text: string) =>
  blockElement(page, text).locator(".drag-handle");

/** Everything the page reports as going wrong, from here on. */
const collectErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return errors;
};

const column = (page: Page, rowIndex: number, columnIndex: number) =>
  canvas(page)
    .locator(".row")
    .nth(rowIndex)
    .locator(".column")
    .nth(columnIndex);

const paletteText = (page: Page) =>
  page
    .getByRole("group", { name: "Add content" })
    .getByRole("button", { name: "Text" });

const dropIndicator = (page: Page) => canvas(page).locator(".drop-indicator");

interface Point {
  x: number;
  y: number;
}

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("The element has no box");
  }
  return box;
};

const centerOf = async (locator: Locator): Promise<Point> => {
  const { height, width, x, y } = await boxOf(locator);
  return { x: x + width / 2, y: y + height / 2 };
};

/** The upper part of an element, so a drop there lands before it. */
const topOf = async (locator: Locator): Promise<Point> => {
  const { height, width, x, y } = await boxOf(locator);
  return { x: x + width / 2, y: y + height / 4 };
};

/** The lower part of an element, so a drop there lands after it. */
const bottomOf = async (locator: Locator): Promise<Point> => {
  const { height, width, x, y } = await boxOf(locator);
  return { x: x + width / 2, y: y + (height * 3) / 4 };
};

/** Lets the drag catch up with the pointer, as it does for a person. */
const settle = (page: Page) =>
  page.evaluate(
    () =>
      // oxlint-disable-next-line promise/avoid-new -- requestAnimationFrame only takes a callback.
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );

const pickUp = async (page: Page, from: Locator) => {
  const start = await centerOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 8, start.y + 8, { steps: 2 });
  await settle(page);
};

const moveTo = async (page: Page, { x, y }: Point) => {
  await page.mouse.move(x, y, { steps: 8 });
  await settle(page);
};

const drag = async (page: Page, from: Locator, to: Point) => {
  await pickUp(page, from);
  await moveTo(page, to);
  await page.mouse.up();
  await settle(page);
};

const undo = (page: Page) => page.keyboard.press("ControlOrMeta+z");
const redo = (page: Page) => page.keyboard.press("ControlOrMeta+Shift+z");

const load = async (page: Page, rows: string[][][]) => {
  await setValue(page, emailWith(rows));
  await expect(textBlock(page).first()).toBeVisible();
};

// The test host's unfriendly CSS pushes the canvas far down the page.
test.use({ viewport: { height: 1600, width: 1280 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");
});

const indicatorBox = async (page: Page) => {
  await expect(dropIndicator(page)).toBeVisible();
  return boxOf(dropIndicator(page));
};

const scrollTop = (page: Page) =>
  page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);

const changeCount = (page: Page) => page.getByTestId("change-count");

test.describe("moving a Block by its handle", () => {
  test("announces where the Block went", async ({ page }) => {
    await load(page, [[["A"], ["B"]]]);

    await drag(
      page,
      handleOf(page, "A"),
      await bottomOf(blockElement(page, "B"))
    );

    await expect(structure(page)).resolves.toEqual([[[], ["B", "A"]]]);
    await expect(canvas(page).getByRole("status")).toHaveText(
      "Moved to Row 1, Column 2, position 2 of 2."
    );
  });

  test("into an empty Column", async ({ page }) => {
    await load(page, [[["One"], []]]);

    await drag(page, handleOf(page, "One"), await centerOf(column(page, 0, 1)));

    expect(await structure(page)).toStrictEqual([[[], ["One"]]]);
  });

  test("into a Column of another Row", async ({ page }) => {
    await load(page, [[["One"]], [["Two"], ["Three"]]]);

    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockElement(page, "Three"))
    );

    expect(await structure(page)).toStrictEqual([
      [[]],
      [["Two"], ["Three", "One"]],
    ]);
  });

  test("leaves nothing of the drag behind", async ({ page }) => {
    await load(page, [[["One", "Two"], ["Three"]]]);

    await drag(
      page,
      handleOf(page, "Two"),
      await topOf(blockElement(page, "Three"))
    );

    await expect(
      canvas(page).locator("[data-drag-ghost], [data-drag-source]")
    ).toHaveCount(0);
    await expect(canvas(page).locator(".block[popover]")).toHaveCount(0);
    await expect(textBlock(page)).toHaveCount(3);
  });

  test("Escape cancels the drag", async ({ page }) => {
    await load(page, [[["One", "Two"], ["Three"]]]);
    const changes = await changeCount(page).textContent();

    await pickUp(page, handleOf(page, "Two"));
    await moveTo(page, await topOf(blockElement(page, "Three")));
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await settle(page);

    expect(await structure(page)).toStrictEqual([[["One", "Two"], ["Three"]]]);
    await expect(changeCount(page)).toHaveText(changes as string);
    await expect(dropIndicator(page)).toBeHidden();
    await expect(
      canvas(page).locator("[data-drag-ghost], [data-drag-source]")
    ).toHaveCount(0);
  });

  test("Escape cancels the drag from the format bar too", async ({ page }) => {
    await load(page, [[["One", "Two"], ["Three"]]]);
    await blockElement(page, "One").getByRole("textbox").click();
    await page.keyboard.press("Alt+F10");
    const bold = canvas(page)
      .getByRole("toolbar", { name: "Text formatting" })
      .getByRole("button", { name: "Bold" });
    await expect(bold).toBeFocused();
    const changes = await changeCount(page).textContent();

    await pickUp(page, handleOf(page, "Two"));
    await moveTo(page, await topOf(blockElement(page, "Three")));
    await page.keyboard.press("Escape");
    await expect(dropIndicator(page)).toBeHidden();
    await page.mouse.up();
    await settle(page);

    expect(await structure(page)).toStrictEqual([[["One", "Two"], ["Three"]]]);
    await expect(changeCount(page)).toHaveText(changes as string);
    // The Escape was the drag's, so the format bar keeps focus.
    await expect(bold).toBeFocused();
  });

  test("dropping where it started changes nothing", async ({ page }) => {
    const errors = collectErrors(page);
    await load(page, [[["One", "Two"], ["Three"]]]);
    const changes = await changeCount(page).textContent();
    const start = await centerOf(blockElement(page, "One"));

    await drag(page, handleOf(page, "One"), start);

    expect(await structure(page)).toStrictEqual([[["One", "Two"], ["Three"]]]);
    await expect(changeCount(page)).toHaveText(changes as string);
    expect(errors).toStrictEqual([]);
  });

  test("a release before the next frame lands at the release", async ({
    page,
  }) => {
    await load(page, [[["One", "Two"], ["Three"]]]);
    await pickUp(page, handleOf(page, "Two"));
    const to = await bottomOf(blockElement(page, "Three"));

    // No frame comes, so the last one saw the pointer as it was before.
    await page.evaluate(() => {
      window.requestAnimationFrame = () => 0;
    });
    await page.mouse.move(to.x, to.y);
    await page.mouse.up();

    await expect
      .poll(() => structure(page))
      .toStrictEqual([[["One"], ["Three", "Two"]]]);
  });

  test("the handle isn't offered to assistive technology", async ({ page }) => {
    await load(page, [[["One"]]]);

    await expect(
      canvas(page).getByRole("button", { name: "Drag Block" })
    ).toHaveCount(0);
    await expect(handleOf(page, "One")).toBeAttached();
  });
});

const placeCursorAfterTwo = async (page: Page) => {
  await blockElement(page, "Two").getByRole("textbox").click();
  await moveCursorToLineEnd(page);
  await page.keyboard.type("A");
};

test.describe("the text cursor during a drag", () => {
  test("stays put when the drag is cancelled", async ({ page }) => {
    await load(page, [[["One", "Two"]]]);
    await placeCursorAfterTwo(page);

    await pickUp(page, handleOf(page, "One"));
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await page.keyboard.type("B");

    expect(await structure(page)).toStrictEqual([[["One", "TwoAB"]]]);
  });

  test("stays put when the drop changes nothing", async ({ page }) => {
    await load(page, [[["One", "Two"]]]);
    await placeCursorAfterTwo(page);
    const start = await centerOf(blockElement(page, "One"));

    await drag(page, handleOf(page, "One"), start);
    await page.keyboard.type("B");

    expect(await structure(page)).toStrictEqual([[["One", "TwoAB"]]]);
  });

  test("stays put when the palette drops on the toolbar", async ({ page }) => {
    await load(page, [[["One", "Two"]]]);
    await placeCursorAfterTwo(page);
    await openTab(page, "Content");
    const start = await centerOf(paletteText(page));

    await pickUp(page, paletteText(page));
    await moveTo(page, start);
    await page.mouse.up();
    await settle(page);
    await page.keyboard.type("B");

    expect(await structure(page)).toStrictEqual([[["One", "TwoAB"]]]);
  });

  test("dragging over text doesn't select it", async ({ page }) => {
    await load(page, [[["One", "Two", "Three"]]]);

    await pickUp(page, handleOf(page, "One"));
    await moveTo(page, await bottomOf(blockElement(page, "Three")));

    const selected = await page.evaluate(() => String(window.getSelection()));
    expect(selected).toBe("");
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });
});

test.describe("selecting text with the mouse", () => {
  test("from the first letter never moves the Block", async ({ page }) => {
    await load(page, [[["Move me not", "Two"], ["Three"]]]);
    const { x, y } = await boxOf(blockElement(page, "Move me not"));

    // Text starts 16px in, at the end of the handle.
    await page.mouse.move(x + 16, y + 26);
    await page.mouse.down();
    await moveTo(page, await bottomOf(blockElement(page, "Three")));
    await expect(canvas(page).locator("[data-drag-ghost]")).toHaveCount(0);
    await expect(dropIndicator(page)).toBeHidden();
    await page.mouse.up();
    await settle(page);

    expect(await structure(page)).toStrictEqual([
      [["Move me not", "Two"], ["Three"]],
    ]);
  });

  test("still selects the text", async ({ page }) => {
    await load(page, [[["Select me"]]]);
    const block = textBlock(page);
    const { height, width, x, y } = await boxOf(block);

    await page.mouse.move(x + 16, y + height / 2);
    await page.mouse.down();
    await page.mouse.move(x + width - 4, y + height / 2, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.type("Typed");

    await expect(block).toHaveText("Typed");
  });
});

test.describe("while dragging", () => {
  test("the Block follows the pointer", async ({ page }) => {
    await load(page, [[["One", "Two"], ["Three"]]]);
    await pickUp(page, handleOf(page, "Two"));
    const lifted = canvas(page).locator(".block[data-drag-ghost]");
    const first = await boxOf(lifted);

    await page.mouse.move(700, 900, { steps: 8 });
    await settle(page);
    const second = await boxOf(lifted);
    await page.mouse.move(800, 1000, { steps: 8 });
    await settle(page);
    const third = await boxOf(lifted);

    expect(third.x - second.x).toBeCloseTo(100, 0);
    expect(third.y - second.y).toBeCloseTo(100, 0);
    expect(second.x).not.toBeCloseTo(first.x, 0);
    await expect(lifted).toContainText("Two");
    await page.keyboard.press("Escape");
  });

  test("the Block stays under the pointer on a scrolled page", async ({
    page,
  }) => {
    await load(page, [[["One", "Two"], ["Three"]]]);
    await page.evaluate(() => window.scrollBy(0, 200));
    expect(await scrollTop(page)).toBeGreaterThanOrEqual(100);
    const start = await centerOf(handleOf(page, "Two"));

    await pickUp(page, handleOf(page, "Two"));

    // Where pickUp left the pointer.
    const pointer = { x: start.x + 8, y: start.y + 8 };
    const lifted = await boxOf(canvas(page).locator(".block[data-drag-ghost]"));
    expect(pointer.x).toBeGreaterThan(lifted.x);
    expect(pointer.x).toBeLessThan(lifted.x + lifted.width);
    expect(pointer.y).toBeGreaterThan(lifted.y);
    expect(pointer.y).toBeLessThan(lifted.y + lifted.height);
    await page.keyboard.press("Escape");
  });

  test("the Block keeps its size on a page that scales the editor", async ({
    page,
  }) => {
    await load(page, [[["One", "Two"]]]);
    await canvas(page).evaluate((element) => {
      element.style.transform = "scale(0.5)";
      element.style.transformOrigin = "0 0";
    });
    const before = await boxOf(blockElement(page, "One"));
    const text = await boxOf(blockElement(page, "One").getByRole("textbox"));

    await pickUp(page, handleOf(page, "One"));

    const lifted = canvas(page).locator(".block[data-drag-ghost]");
    const after = await boxOf(lifted);
    expect(after.width).toBeCloseTo(before.width, 0);
    expect(after.height).toBeCloseTo(before.height, 0);
    const copied = await boxOf(lifted.locator(".ProseMirror"));
    expect(copied.height).toBeCloseTo(text.height, 0);
    await page.keyboard.press("Escape");
  });

  test("the other Blocks stay where they are", async ({ page }) => {
    await load(page, [[["One", "Two", "Three"]]]);
    const before = await boxOf(blockElement(page, "Three"));

    await pickUp(page, handleOf(page, "One"));
    await moveTo(page, await bottomOf(blockElement(page, "Two")));

    expect(await boxOf(blockElement(page, "Three"))).toStrictEqual(before);
    await page.keyboard.press("Escape");
  });

  test("the indicator shows the place between two Blocks", async ({ page }) => {
    await load(page, [[["One", "Two", "Three"], ["Four"]]]);
    await pickUp(page, handleOf(page, "Four"));
    const two = await boxOf(blockElement(page, "Two"));
    const left = await boxOf(column(page, 0, 0));

    await moveTo(page, await topOf(blockElement(page, "Two")));
    const before = await indicatorBox(page);
    expect(before.y + before.height / 2).toBeCloseTo(two.y, 0);
    expect(before.x).toBeCloseTo(left.x, 0);
    expect(before.width).toBeCloseTo(left.width, 0);

    await moveTo(page, await bottomOf(blockElement(page, "Two")));
    const after = await indicatorBox(page);
    expect(after.y + after.height / 2).toBeCloseTo(two.y + two.height, 0);

    await page.mouse.up();
    await settle(page);
    expect(await structure(page)).toStrictEqual([
      [["One", "Two", "Four", "Three"], []],
    ]);
  });

  test("the indicator spans the email outside any Row", async ({ page }) => {
    await load(page, [[["One"], ["Two"]]]);
    await pickUp(page, handleOf(page, "One"));
    const row = await boxOf(canvas(page).locator(".row").first());

    await moveTo(page, { x: row.x + 100, y: row.y + row.height + 30 });

    const box = await indicatorBox(page);
    expect(box.y + box.height / 2).toBeCloseTo(row.y + row.height, 0);
    expect(box.x).toBeCloseTo(row.x, 0);
    expect(box.width).toBeCloseTo(row.width, 0);
    await page.keyboard.press("Escape");
  });
});

test.describe("dropping outside any Row", () => {
  test("below the email adds a Row at the end", async ({ page }) => {
    await load(page, [[["One", "Two"]], [["Three"]]]);
    const { height, width, x, y } = await boxOf(
      canvas(page).locator(".row").last()
    );

    await drag(page, handleOf(page, "Two"), {
      x: x + width / 2,
      y: y + height + 30,
    });

    expect(await structure(page)).toStrictEqual([
      [["One"]],
      [["Three"]],
      [["Two"]],
    ]);
    const { rows } = await currentValue(page);
    expect(rows[2]?.columns.map(({ width: w }) => w)).toStrictEqual([100]);
  });

  test("on the first Row's controls adds a Row at the start", async ({
    page,
  }) => {
    await load(page, [[["One", "Two"]]]);
    const controls = await boxOf(
      page.getByRole("group", { exact: true, name: "Row 1" })
    );

    // Its top, which is above the middle of the Row.
    await drag(page, handleOf(page, "Two"), {
      x: controls.x + controls.width / 2,
      y: controls.y + 4,
    });

    expect(await structure(page)).toStrictEqual([[["Two"]], [["One"]]]);
  });

  test("beside a Row adds a Row next to it", async ({ page }) => {
    await load(page, [[["One", "Two"]], [["Three"]]]);
    const row = await boxOf(canvas(page).locator(".row").last());

    await drag(page, handleOf(page, "Two"), {
      x: row.x - 40,
      y: row.y + (row.height * 3) / 4,
    });

    expect(await structure(page)).toStrictEqual([
      [["One"]],
      [["Three"]],
      [["Two"]],
    ]);
  });

  test("is one change for the host", async ({ page }) => {
    await load(page, [[["One", "Two"]]]);
    const changes = Number(await changeCount(page).textContent());
    const { height, width, x, y } = await boxOf(
      canvas(page).locator(".row").first()
    );

    await drag(page, handleOf(page, "Two"), {
      x: x + width / 2,
      y: y + height + 30,
    });

    await expect(changeCount(page)).toHaveText(String(changes + 1));
  });
});

test.describe("letting go far from the editor", () => {
  test("shows no indicator and leaves a Block where it was", async ({
    page,
  }) => {
    await load(page, [[["One", "Two"]]]);
    const changes = await changeCount(page).textContent();
    const editor = await boxOf(canvas(page));

    await pickUp(page, handleOf(page, "Two"));
    await moveTo(page, { x: 10, y: editor.y - 200 });
    await expect(dropIndicator(page)).toBeHidden();
    await page.mouse.up();
    await settle(page);

    expect(await structure(page)).toStrictEqual([[["One", "Two"]]]);
    await expect(changeCount(page)).toHaveText(changes as string);
  });

  test("the Block can be dragged again afterwards", async ({ page }) => {
    await load(page, [[["One", "Two"]]]);
    const editor = await boxOf(canvas(page));

    await drag(page, handleOf(page, "Two"), { x: 10, y: editor.y - 200 });
    await drag(
      page,
      handleOf(page, "Two"),
      await topOf(blockElement(page, "One"))
    );

    expect(await structure(page)).toStrictEqual([[["Two", "One"]]]);
  });
});

test.describe("dragging from the palette", () => {
  test("into a Column, between its Blocks", async ({ page }) => {
    await load(page, [[["One", "Two"], ["Three"]]]);

    await drag(
      page,
      paletteText(page),
      await bottomOf(blockElement(page, "One"))
    );

    expect(await structure(page)).toStrictEqual([
      [["One", "", "Two"], ["Three"]],
    ]);
  });

  test("into an empty Column", async ({ page }) => {
    await load(page, [[["One"], []]]);

    await drag(page, paletteText(page), await centerOf(column(page, 0, 1)));

    expect(await structure(page)).toStrictEqual([[["One"], [""]]]);
  });

  test("selects the new Block, ready to type in", async ({ page }) => {
    await load(page, [[["One"]]]);

    await drag(
      page,
      paletteText(page),
      await bottomOf(blockElement(page, "One"))
    );
    await page.keyboard.type("Typed");

    await expect(textBlock(page).nth(1)).toHaveText("Typed");
    expect(await structure(page)).toStrictEqual([[["One", "Typed"]]]);
  });

  test("into an email with no Rows", async ({ page }) => {
    await load(page, [[["One"]]]);
    await deleteRow(page, 1);
    await expect(textBlock(page)).toHaveCount(0);
    const email = await boxOf(canvas(page).locator(".email"));

    await drag(page, paletteText(page), {
      x: email.x + 300,
      y: email.y + 20,
    });

    expect(await structure(page)).toStrictEqual([[[""]]]);
    await undo(page);
    expect(await structure(page)).toStrictEqual([]);
  });

  test("leaves the palette button where it was", async ({ page }) => {
    await load(page, [[["One"]]]);
    const before = await boxOf(paletteText(page));

    await pickUp(page, paletteText(page));
    await moveTo(page, await bottomOf(blockElement(page, "One")));
    await expect(paletteText(page)).toBeVisible();
    await page.mouse.up();
    await settle(page);

    // The new Block's settings show in place of the tabs.
    await openTab(page, "Content");
    expect(await boxOf(paletteText(page))).toStrictEqual(before);
    await expect(
      canvas(page).locator("[data-drag-ghost], [data-drag-source]")
    ).toHaveCount(0);
  });

  test("dropping on the toolbar shows no indicator and adds nothing", async ({
    page,
  }) => {
    await load(page, [[["One"]]]);
    const start = await centerOf(paletteText(page));

    await pickUp(page, paletteText(page));
    await moveTo(page, start);
    await expect(dropIndicator(page)).toBeHidden();
    await page.mouse.up();
    await settle(page);

    expect(await structure(page)).toStrictEqual([[["One"]]]);
  });

  test("a click still adds a Block, however long the press", async ({
    page,
  }) => {
    await load(page, [[["One"]]]);
    const { x, y } = await centerOf(paletteText(page));

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.up();

    expect(await structure(page)).toStrictEqual([[["One", ""]]]);
  });

  test("a click still works after a drag", async ({ page }) => {
    await load(page, [[["One"]]]);

    await drag(
      page,
      paletteText(page),
      await bottomOf(blockElement(page, "One"))
    );
    // The new Block's settings show in place of the tabs.
    await openTab(page, "Content");
    await paletteText(page).click();

    expect(await structure(page)).toStrictEqual([[["One", "", ""]]]);
  });
});

test.describe("text after a move", () => {
  test("survives with its formatting", async ({ page }) => {
    const email = emailWith([[["One"], ["Two"]]]);
    const bold = {
      content: {
        content: [
          {
            content: [
              { marks: [{ type: "bold" }], text: "Bold", type: "text" },
              { text: " plain", type: "text" },
            ],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
    };
    const block = email.rows[0]?.columns[0]?.blocks[0];
    if (block) {
      block.props = bold;
    }
    await setValue(page, email);
    await expect(textBlock(page).first()).toHaveText("Bold plain");

    await drag(
      page,
      handleOf(page, "Bold plain"),
      await bottomOf(blockElement(page, "Two"))
    );

    const moved = blockElement(page, "Bold plain");
    await expect(moved.locator("strong")).toHaveText("Bold");
    const { rows } = await currentValue(page);
    expect(rows[0]?.columns[1]?.blocks[1]?.props).toStrictEqual(bold);
  });

  test("includes what was typed just before", async ({ page }) => {
    await load(page, [[["One"], ["Two"]]]);
    await blockElement(page, "One").getByRole("textbox").click();
    await moveCursorToLineEnd(page);
    await page.keyboard.type(" more");

    await drag(
      page,
      handleOf(page, "One more"),
      await bottomOf(blockElement(page, "Two"))
    );

    expect(await structure(page)).toStrictEqual([[[], ["Two", "One more"]]]);
  });

  test("the moved Block can be typed in straight away", async ({ page }) => {
    await load(page, [[["One"], ["Two"]]]);

    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockElement(page, "Two"))
    );
    await expect(blockElement(page, "One").getByRole("textbox")).toBeFocused();
    await page.keyboard.type("X");

    const after = await structure(page);
    expect(after[0]?.[1]?.[0]).toBe("Two");
    expect(after[0]?.[1]?.[1]?.replace("X", "")).toBe("One");
  });

  test("the moved Block can be clicked and edited", async ({ page }) => {
    await load(page, [[["One", "Two"], ["Three"]]]);

    await drag(
      page,
      handleOf(page, "Two"),
      await topOf(blockElement(page, "Three"))
    );
    // Where its text starts, as Two's format bar covers its top end.
    await blockElement(page, "Three")
      .getByRole("textbox")
      .click({ position: { x: 24, y: 8 } });
    await blockElement(page, "Two").getByRole("textbox").click();
    await moveCursorToLineEnd(page);
    await page.keyboard.type("!");

    expect(await structure(page)).toStrictEqual([[["One"], ["Two!", "Three"]]]);
  });

  test("still formats from the toolbar", async ({ page }) => {
    await load(page, [[["One"], ["Two"]]]);

    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockElement(page, "Two"))
    );
    await page.keyboard.press("ControlOrMeta+a");
    await page.getByRole("button", { name: "Bold" }).click();

    await expect(blockElement(page, "One").locator("strong")).toHaveText("One");
  });
});

test.describe("undo", () => {
  test("each drag is one step", async ({ page }) => {
    await load(page, [[["One", "Two"], ["Three"]]]);

    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockElement(page, "Two"))
    );
    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockElement(page, "Three"))
    );
    expect(await structure(page)).toStrictEqual([[["Two"], ["Three", "One"]]]);

    await undo(page);
    expect(await structure(page)).toStrictEqual([[["Two", "One"], ["Three"]]]);
    await undo(page);
    expect(await structure(page)).toStrictEqual([[["One", "Two"], ["Three"]]]);
    await redo(page);
    expect(await structure(page)).toStrictEqual([[["Two", "One"], ["Three"]]]);
    await redo(page);
    expect(await structure(page)).toStrictEqual([[["Two"], ["Three", "One"]]]);
  });

  test("two drags to new Rows in a row are two steps", async ({ page }) => {
    await load(page, [[["One", "Two", "Three"]]]);
    const below = async () => {
      const { height, width, x, y } = await boxOf(
        canvas(page).locator(".row").last()
      );
      return { x: x + width / 2, y: y + height + 30 };
    };

    await drag(page, handleOf(page, "Two"), await below());
    await drag(page, handleOf(page, "Three"), await below());
    expect(await structure(page)).toStrictEqual([
      [["One"]],
      [["Two"]],
      [["Three"]],
    ]);

    await undo(page);
    expect(await structure(page)).toStrictEqual([
      [["One", "Three"]],
      [["Two"]],
    ]);
  });

  test("a drag from the palette is one step", async ({ page }) => {
    await load(page, [[["One"]]]);
    const { height, width, x, y } = await boxOf(
      canvas(page).locator(".row").first()
    );

    await drag(page, paletteText(page), {
      x: x + width / 2,
      y: y + height + 30,
    });
    expect(await structure(page)).toStrictEqual([[["One"]], [[""]]]);

    await undo(page);
    expect(await structure(page)).toStrictEqual([[["One"]]]);
  });

  test("typing after a drag is its own step", async ({ page }) => {
    await load(page, [[["One"], ["Two"]]]);

    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockElement(page, "Two"))
    );
    await page.keyboard.type("X");

    await undo(page);
    expect(await structure(page)).toStrictEqual([[[], ["Two", "One"]]]);
    await undo(page);
    expect(await structure(page)).toStrictEqual([[["One"], ["Two"]]]);
  });

  test("works after pressing a handle with no focus in the editor", async ({
    page,
  }) => {
    await load(page, [[["One", "Two"]]]);
    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockElement(page, "Two"))
    );
    await page.getByTestId("host-paragraph").click();
    const { x, y } = await centerOf(handleOf(page, "Two"));

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
    await undo(page);

    expect(await structure(page)).toStrictEqual([[["One", "Two"]]]);
  });

  test("a moved Block stays editable after undo", async ({ page }) => {
    await load(page, [[["One"], ["Two"]]]);

    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockElement(page, "Two"))
    );
    await undo(page);
    await blockElement(page, "One").getByRole("textbox").click();
    await moveCursorToLineEnd(page);
    await page.keyboard.type("!");

    expect(await structure(page)).toStrictEqual([[["One!"], ["Two"]]]);
  });
});

test.describe("auto-scrolling", () => {
  const manyBlocks = Array.from({ length: 30 }, (_, index) => `Block ${index}`);

  test.use({ viewport: { height: 600, width: 1280 } });

  test("the page scrolls down near its bottom edge", async ({ page }) => {
    await load(page, [[manyBlocks]]);
    const handle = handleOf(page, "Block 1");
    await blockElement(page, "Block 1").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const editor = document.querySelector("mail-quilt");
      window.scrollTo(0, (editor?.getBoundingClientRect().top ?? 0) + 40);
    });
    await handle.hover();
    const before = await scrollTop(page);

    await pickUp(page, handle);
    await page.mouse.move(640, 590, { steps: 8 });

    await expect.poll(() => scrollTop(page)).toBeGreaterThan(before + 100);

    await page.mouse.up();
    await settle(page);
    const current = await structure(page);
    const flat = current.flat().flat();
    expect(flat.indexOf("Block 1")).toBeGreaterThan(1);
    expect(flat).toHaveLength(manyBlocks.length);
  });

  test("the page scrolls up near its top edge", async ({ page }) => {
    await load(page, [[manyBlocks]]);
    const block = blockElement(page, "Block 29");
    await block.scrollIntoViewIfNeeded();
    const handle = handleOf(page, "Block 29");
    await handle.hover();
    const before = await scrollTop(page);

    await pickUp(page, handle);
    await page.mouse.move(640, 10, { steps: 8 });

    await expect.poll(() => scrollTop(page)).toBeLessThan(before - 100);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("a scrolling container around the editor scrolls", async ({ page }) => {
    await load(page, [[manyBlocks]]);
    await canvas(page).evaluate((element) => {
      const scroller = document.createElement("section");
      scroller.id = "scroller";
      scroller.style.cssText =
        "height: 400px; overflow: auto; position: fixed; top: 0; left: 0; width: 800px; background: white; z-index: 10";
      element.replaceWith(scroller);
      scroller.append(element);
    });
    await expect(textBlock(page).first()).toBeVisible();
    const containerTop = () =>
      page.evaluate(() => document.querySelector("#scroller")?.scrollTop ?? 0);
    const handle = handleOf(page, "Block 1");
    await handle.hover();

    await pickUp(page, handle);
    await page.mouse.move(400, 395, { steps: 8 });

    await expect.poll(containerTop).toBeGreaterThan(100);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("a container scrolls sideways near its edge", async ({ page }) => {
    await load(page, [[["One"]]]);
    await canvas(page).evaluate((element) => {
      const scroller = document.createElement("section");
      scroller.id = "scroller";
      scroller.style.cssText =
        "height: 500px; overflow: auto; position: fixed; top: 0; left: 0; width: 600px; background: white; z-index: 10";
      element.style.width = "1400px";
      element.replaceWith(scroller);
      scroller.append(element);
    });
    await expect(textBlock(page).first()).toBeVisible();
    const containerLeft = () =>
      page.evaluate(() => document.querySelector("#scroller")?.scrollLeft ?? 0);
    const handle = handleOf(page, "One");
    await handle.hover();

    await pickUp(page, handle);
    await page.mouse.move(595, 250, { steps: 8 });

    await expect.poll(containerLeft).toBeGreaterThan(100);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("a container doesn't scroll the way it hides", async ({ page }) => {
    await load(page, [[["One"]]]);
    await canvas(page).evaluate((element) => {
      const scroller = document.createElement("section");
      scroller.id = "scroller";
      scroller.style.cssText =
        "height: 500px; overflow-x: hidden; overflow-y: auto; position: fixed; top: 0; left: 0; width: 600px; background: white; z-index: 10";
      element.style.width = "1400px";
      element.replaceWith(scroller);
      scroller.append(element);
    });
    await expect(textBlock(page).first()).toBeVisible();
    const handle = handleOf(page, "One");
    await handle.hover();

    await pickUp(page, handle);
    await page.mouse.move(595, 250, { steps: 8 });
    await settle(page);
    await settle(page);

    expect(
      await page.evaluate(() => document.querySelector("#scroller")?.scrollLeft)
    ).toBe(0);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("the indicator keeps up while the page scrolls", async ({ page }) => {
    await load(page, [[manyBlocks]]);
    await page.evaluate(() => {
      const editor = document.querySelector("mail-quilt");
      window.scrollTo(0, (editor?.getBoundingClientRect().top ?? 0) + 40);
    });
    const handle = handleOf(page, "Block 1");
    await handle.hover();
    const before = await scrollTop(page);

    await pickUp(page, handle);
    await page.mouse.move(640, 590, { steps: 8 });
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(before + 300);
    await settle(page);

    const line = await boxOf(dropIndicator(page));
    expect(Math.abs(line.y - 590)).toBeLessThan(60);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });
});

test.describe("a Block that's removed or replaced", () => {
  test("clearing the email during a drag ends it safely", async ({ page }) => {
    const errors = collectErrors(page);
    await load(page, [[["One", "Two"]]]);

    await pickUp(page, handleOf(page, "One"));
    await setValue(page, undefined);
    await settle(page);
    await page.mouse.up();
    await settle(page);
    expect(errors).toStrictEqual([]);

    await load(page, [[["Three", "Four"]]]);
    await drag(
      page,
      handleOf(page, "Three"),
      await bottomOf(blockElement(page, "Four"))
    );
    expect(await structure(page)).toStrictEqual([[["Four", "Three"]]]);
  });

  test("removing the editor during a drag ends it safely", async ({ page }) => {
    const errors = collectErrors(page);
    await load(page, [[["One", "Two"]]]);

    await pickUp(page, handleOf(page, "One"));
    await canvas(page).evaluate((element) => {
      const parent = element.parentElement;
      element.remove();
      setTimeout(() => parent?.append(element), 50);
    });
    await page.mouse.up();
    await expect(textBlock(page).first()).toBeVisible();
    await settle(page);
    expect(errors).toStrictEqual([]);

    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockElement(page, "Two"))
    );
    expect(await structure(page)).toStrictEqual([[["Two", "One"]]]);
  });

  test("a Column that undo brings back during a drag takes the drop", async ({
    page,
  }) => {
    await load(page, [[["One"], ["Two"]]]);
    await chooseLayout(page, 1, "100");
    expect(await structure(page)).toStrictEqual([[["One", "Two"]]]);

    await pickUp(page, handleOf(page, "One"));
    await undo(page);
    await settle(page);
    await moveTo(page, await bottomOf(blockElement(page, "Two")));
    await page.mouse.up();
    await settle(page);

    expect(await structure(page)).toStrictEqual([[[], ["Two", "One"]]]);
  });

  test("undoing during a drag ends it where undo left things", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await load(page, [[["One"], ["Two"]]]);
    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockElement(page, "Two"))
    );

    await pickUp(page, handleOf(page, "One"));
    await moveTo(page, await topOf(blockElement(page, "Two")));
    await undo(page);
    await settle(page);
    // The undo made the Block anew, so the drag of the old one is over.
    await expect(
      canvas(page).locator("[data-drag-ghost], [data-drag-source]")
    ).toHaveCount(0);
    await expect(dropIndicator(page)).toBeHidden();
    await page.mouse.up();
    await settle(page);

    expect(await structure(page)).toStrictEqual([[["One"], ["Two"]]]);
    expect(errors).toStrictEqual([]);
    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockElement(page, "Two"))
    );
    expect(await structure(page)).toStrictEqual([[[], ["Two", "One"]]]);
  });
});

/** A finger that presses at `from`, moves to `to` and lifts. */
const touchDrag = async (page: Page, from: Point, to: Point) => {
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [from],
    type: "touchStart",
  });
  const steps = 12;
  for (let step = 1; step <= steps; step += 1) {
    // oxlint-disable-next-line no-await-in-loop -- One move at a time.
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * step) / steps,
          y: from.y + ((to.y - from.y) * step) / steps,
        },
      ],
      type: "touchMove",
    });
    // oxlint-disable-next-line no-await-in-loop -- See above.
    await settle(page);
  }
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [],
    type: "touchEnd",
  });
};

test.describe("on a touch screen", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Only Chromium can emulate a phone."
  );
  test.use({ hasTouch: true, isMobile: true });

  test("a Block's handle drags it, and the page doesn't scroll", async ({
    page,
  }) => {
    await load(page, [[["One", "Two"]]]);
    const before = await scrollTop(page);

    await touchDrag(
      page,
      await centerOf(handleOf(page, "One")),
      await bottomOf(blockElement(page, "Two"))
    );

    await expect.poll(() => structure(page)).toStrictEqual([[["Two", "One"]]]);
    expect(await scrollTop(page)).toBe(before);
    await expect(
      canvas(page).locator("[data-drag-ghost], [data-drag-source]")
    ).toHaveCount(0);
  });

  test("a palette item drags a new Block in", async ({ page }) => {
    await load(page, [[["One"]]]);

    await touchDrag(
      page,
      await centerOf(paletteText(page)),
      await bottomOf(blockElement(page, "One"))
    );

    await expect.poll(() => structure(page)).toStrictEqual([[["One", ""]]]);
  });
});
