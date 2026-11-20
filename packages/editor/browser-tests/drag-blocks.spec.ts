import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  announcement,
  blockGroup,
  blockTools,
  blockWith,
  bottomOf,
  boxOf,
  canvas,
  centerOf,
  changeCount,
  changesSince,
  chooseLayout,
  consoleErrors,
  currentValue,
  deleteRow,
  drag,
  dragMarks,
  dropFileOn,
  dropIndicator,
  emailWith,
  handleOf,
  hostEvents,
  letGo,
  moveCursorToLineEnd,
  moveTo,
  openBlocks,
  openEmail,
  openTab,
  palette,
  pickUp,
  previewButton,
  previewEmail,
  serveImages,
  settle,
  setValue,
  structure,
  TALL_VIEWPORT,
  test,
  textBlock,
  textOf,
  topOf,
  undoByKey,
} from "./helpers.js";
import type { Point } from "./helpers.js";

const column = (page: Page, rowIndex: number, columnIndex: number) =>
  canvas(page)
    .getByTestId("row")
    .nth(rowIndex)
    .getByTestId("column")
    .nth(columnIndex);

/**
 * The pointer pressed last on the page from here on, heard before the editor,
 * for an event of that pointer's own.
 */
const watchPointer = async (page: Page) => {
  const presses = await hostEvents(page, "pointerdown", ["pointerId"], {
    capture: true,
  });
  return async () => {
    const heard = await presses();
    const pointerId = heard.at(-1)?.pointerId;
    if (typeof pointerId !== "number") {
      throw new TypeError("No pointer was pressed");
    }
    return pointerId;
  };
};

/** A drag's copy of a Block, which is hidden from screen readers. */
const liftedBlock = (page: Page) =>
  canvas(page).locator('[role="group"][data-drag-ghost]');

test.use({ viewport: TALL_VIEWPORT });

const indicatorBox = async (page: Page) => {
  await expect(dropIndicator(page)).toBeVisible();
  return boxOf(dropIndicator(page));
};

const scrollTop = (page: Page) =>
  page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);

/**
 * Puts the editor in a container fixed over the page, which scrolls it, and
 * returns the container. An editor wider than it can scroll it sideways.
 */
const inScroller = async (
  page: Page,
  {
    editorWidth,
    height,
    sideways = "auto",
    width,
  }: { editorWidth?: number; height: number; sideways?: string; width: number }
) => {
  await canvas(page).evaluate(
    (element, size) => {
      const scroller = document.createElement("section");
      scroller.dataset.testid = "scroller";
      Object.assign(scroller.style, {
        background: "white",
        height: `${size.height}px`,
        left: "0",
        overflowX: size.sideways,
        overflowY: "auto",
        position: "fixed",
        top: "0",
        width: `${size.width}px`,
        zIndex: "10",
      });
      if (size.editorWidth) {
        element.style.width = `${size.editorWidth}px`;
      }
      element.replaceWith(scroller);
      scroller.append(element);
    },
    { editorWidth, height, sideways, width }
  );
  await expect(textBlock(page).first()).toBeVisible();
  return page.getByTestId("scroller");
};

test.describe("moving a Block by its handle", () => {
  test("announces where the Block went", async ({ page }) => {
    await openEmail(page, [[["A"], ["B"]]]);
    const hostClicks = await hostEvents(page, "click", []);

    await drag(page, handleOf(page, "A"), await bottomOf(blockWith(page, "B")));

    await expect(structure(page)).resolves.toEqual([[[], ["B", "A"]]]);
    await expect(announcement(page)).toHaveText(
      "Moved to Row 1, Column 2, position 2 of 2."
    );
    // The release isn't a click the host page should see.
    expect(await hostClicks()).toStrictEqual([]);
  });

  test("into an empty Column", async ({ page }) => {
    await openEmail(page, [[["One"], []]]);

    await drag(page, handleOf(page, "One"), await centerOf(column(page, 0, 1)));

    expect(await structure(page)).toStrictEqual([[[], ["One"]]]);
  });

  test("Escape cancels the drag", async ({ page }) => {
    await openEmail(page, [[["One", "Two"], ["Three"]]]);
    const expectChanges = await changesSince(page);
    const hostClicks = await hostEvents(page, "click", []);

    await pickUp(page, handleOf(page, "Two"));
    await moveTo(page, await topOf(blockWith(page, "Three")));
    await page.keyboard.press("Escape");
    await letGo(page);

    // The release isn't a click the host page should see.
    expect(await hostClicks()).toStrictEqual([]);
    expect(await structure(page)).toStrictEqual([[["One", "Two"], ["Three"]]]);
    await expectChanges(0);
    await expect(dropIndicator(page)).toBeHidden();
    await expect(dragMarks(page)).toHaveCount(0);
  });

  // White text on a dark email would otherwise be unreadable while it moves.
  test("what's dragged keeps its Row's color behind it, or else the email's", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]]]);
    const email = emailWith([[["One"]], [["Two"]]]);
    email.settings.backgroundColor = "#101010";
    const [colored] = email.rows;
    if (colored) {
      colored.props = { backgroundColor: "#123456" };
    }
    await setValue(page, email);
    const ghostBackground = () =>
      liftedBlock(page).evaluate(
        (element) => getComputedStyle(element).backgroundColor
      );

    await pickUp(page, handleOf(page, "One"));
    expect(await ghostBackground()).toBe("rgb(18, 52, 86)");
    await page.keyboard.press("Escape");
    await letGo(page);

    await pickUp(page, handleOf(page, "Two"));
    expect(await ghostBackground()).toBe("rgb(16, 16, 16)");
    await page.keyboard.press("Escape");
    await letGo(page);
  });

  // A touch screen opens its menu for a long press that hasn't moved yet.
  test("a press on the handle keeps the menu shut until it's let go", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two"]]]);
    const handle = handleOf(page, "Two");
    const menuShut = () =>
      handle.evaluate(
        (element) =>
          !element.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              composed: true,
            })
          )
      );
    await handle.hover();

    await page.mouse.down();
    expect(await menuShut()).toBe(true);
    await page.mouse.up();

    expect(await menuShut()).toBe(false);
  });

  // As a browser does when a touch turns into scrolling the page.
  test("a cancelled pointer cancels the drag, and the next one works", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two"], ["Three"]]]);
    const expectChanges = await changesSince(page);
    const lastPointer = await watchPointer(page);

    await pickUp(page, handleOf(page, "Two"));
    await moveTo(page, await topOf(blockWith(page, "Three")));
    await page.evaluate(
      (pointerId) => {
        window.dispatchEvent(new PointerEvent("pointercancel", { pointerId }));
      },
      await lastPointer()
    );
    await letGo(page);

    expect(await structure(page)).toStrictEqual([[["One", "Two"], ["Three"]]]);
    await expectChanges(0);
    await expect(dragMarks(page)).toHaveCount(0);

    await drag(
      page,
      handleOf(page, "Two"),
      await topOf(blockWith(page, "Three"))
    );
    expect(await structure(page)).toStrictEqual([[["One"], ["Two", "Three"]]]);
  });

  test("Escape cancels the drag from the format bar too", async ({ page }) => {
    await openEmail(page, [[["One", "Two"], ["Three"]]]);
    await textOf(page, "One").click();
    await page.keyboard.press("Alt+F10");
    const bold = canvas(page)
      .getByRole("toolbar", { name: "Text formatting" })
      .getByRole("button", { name: "Bold" });
    await expect(bold).toBeFocused();
    const expectChanges = await changesSince(page);

    await pickUp(page, handleOf(page, "Two"));
    await moveTo(page, await topOf(blockWith(page, "Three")));
    await page.keyboard.press("Escape");
    await expect(dropIndicator(page)).toBeHidden();
    await letGo(page);

    expect(await structure(page)).toStrictEqual([[["One", "Two"], ["Three"]]]);
    await expectChanges(0);
    // The Escape was the drag's, so the format bar keeps focus.
    await expect(bold).toBeFocused();
  });

  test("a release before the next frame lands at the release", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two"], ["Three"]]]);
    await pickUp(page, handleOf(page, "Two"));
    const to = await bottomOf(blockWith(page, "Three"));

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
    await openEmail(page, [[["One"]]]);

    await expect(handleOf(page, "One")).toHaveAttribute("aria-hidden", "true");
  });

  test("a short drag let go over the toolbar it started from moves nothing", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]]]);
    await blockGroup(page, "Text").last().focus();
    const handle = await boxOf(blockTools(page).getByTestId("drag-handle"));

    await page.mouse.move(handle.x + 10, handle.y + 10);
    await page.mouse.down();
    await page.mouse.move(handle.x + 16, handle.y + 18, { steps: 4 });
    await settle(page);
    await letGo(page);

    await expect(structure(page)).resolves.toEqual([[["A"], ["B"]]]);
  });

  test("a drag that left the toolbar lands where the toolbar was", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]]]);
    await blockGroup(page, "Text").last().focus();
    const handle = await boxOf(blockTools(page).getByTestId("drag-handle"));

    // Away from the toolbar, then back over where it was, in the first Column.
    await page.mouse.move(handle.x + 10, handle.y + 10);
    await page.mouse.down();
    await page.mouse.move(handle.x - 120, handle.y + 120, { steps: 8 });
    await page.mouse.move(handle.x + 10, handle.y + 20, { steps: 8 });
    await settle(page);
    await expect(dropIndicator(page)).toBeVisible();
    await letGo(page);

    // Above A, whose top half the toolbar sat beside.
    await expect(structure(page)).resolves.toEqual([[["B", "A"], []]]);
  });

  test("letting go over the Email tools moves nothing", async ({ page }) => {
    await openEmail(page, [[["One", "Two"]]]);
    const expectChanges = await changesSince(page);
    const tools = canvas(page).getByRole("group", { name: "Email tools" });

    await drag(page, handleOf(page, "One"), await centerOf(tools));

    expect(await structure(page)).toStrictEqual([[["One", "Two"]]]);
    await expectChanges(0);
  });

  test("Alt+↓ on another Block does nothing during the drag", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two", "Three"]]]);
    await blockWith(page, "One").focus();

    await pickUp(page, handleOf(page, "Three"));
    await expect(canvas(page).locator("[data-drag-ghost]")).toHaveCount(1);
    await expect(blockWith(page, "One")).toBeFocused();
    await page.keyboard.press("Alt+ArrowDown");
    await page.keyboard.press("Escape");
    await letGo(page);

    expect(await structure(page)).toStrictEqual([[["One", "Two", "Three"]]]);
  });
});

const putCursorAfterTwo = async (page: Page) => {
  await textOf(page, "Two").click();
  await moveCursorToLineEnd(page);
  await page.keyboard.type("A");
};

test.describe("the text cursor during a drag", () => {
  test("stays put when the drag is cancelled", async ({ page }) => {
    await openEmail(page, [[["One", "Two"]]]);
    await putCursorAfterTwo(page);

    await pickUp(page, handleOf(page, "One"));
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await page.keyboard.type("B");

    expect(await structure(page)).toStrictEqual([[["One", "TwoAB"]]]);
  });

  test("stays put when the drop changes nothing, which reports no change", async ({
    page,
  }) => {
    const errors = consoleErrors(page);
    await openEmail(page, [[["One", "Two"]]]);
    await putCursorAfterTwo(page);
    // The one change so far is the typing.
    await expect(changeCount(page)).toHaveText("1");
    const start = await centerOf(blockWith(page, "One"));

    await drag(page, handleOf(page, "One"), start);
    await expect(changeCount(page)).toHaveText("1");
    await page.keyboard.type("B");

    expect(await structure(page)).toStrictEqual([[["One", "TwoAB"]]]);
    expect(errors).toStrictEqual([]);
  });

  test("dragging over text doesn't select it", async ({ page }) => {
    await openEmail(page, [[["One", "Two", "Three"]]]);

    await pickUp(page, handleOf(page, "One"));
    await moveTo(page, await bottomOf(blockWith(page, "Three")));

    const selected = await page.evaluate(() => String(window.getSelection()));
    expect(selected).toBe("");
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });
});

test.describe("selecting text with the mouse", () => {
  test("from the first letter never moves the Block", async ({ page }) => {
    await openEmail(page, [[["Move me not", "Two"], ["Three"]]]);
    const line = await boxOf(textBlock(page).first().locator("p"));

    // Its first letter, where the text starts at the end of the handle.
    await page.mouse.move(line.x + 1, line.y + line.height / 2);
    await page.mouse.down();
    await moveTo(page, await bottomOf(blockWith(page, "Three")));
    await expect(canvas(page).locator("[data-drag-ghost]")).toHaveCount(0);
    await expect(dropIndicator(page)).toBeHidden();
    await letGo(page);

    expect(await structure(page)).toStrictEqual([
      [["Move me not", "Two"], ["Three"]],
    ]);
  });

  test("still selects the text", async ({ page }) => {
    await openEmail(page, [[["Select me"]]]);
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
    await openEmail(page, [[["One", "Two"], ["Three"]]]);
    await pickUp(page, handleOf(page, "Two"));
    const lifted = liftedBlock(page);
    const first = await boxOf(lifted);
    const email = await boxOf(canvas(page).getByTestId("email"));

    await page.mouse.move(email.x + 100, email.y + 100, { steps: 8 });
    await settle(page);
    const second = await boxOf(lifted);
    await page.mouse.move(email.x + 200, email.y + 200, { steps: 8 });
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
    await openEmail(page, [[["One", "Two"], ["Three"]]]);
    await page.evaluate(() => {
      // Taller than the window, whatever else the page has.
      document.body.style.minHeight = "200vh";
      window.scrollBy(0, 200);
    });
    expect(await scrollTop(page)).toBeGreaterThanOrEqual(100);
    const start = await centerOf(handleOf(page, "Two"));

    await pickUp(page, handleOf(page, "Two"));

    // Where pickUp left the pointer.
    const pointer = { x: start.x + 8, y: start.y + 8 };
    const lifted = await boxOf(liftedBlock(page));
    expect(pointer.x).toBeGreaterThan(lifted.x);
    expect(pointer.x).toBeLessThan(lifted.x + lifted.width);
    expect(pointer.y).toBeGreaterThan(lifted.y);
    expect(pointer.y).toBeLessThan(lifted.y + lifted.height);
    await page.keyboard.press("Escape");
  });

  test("the Block keeps its size on a page that scales the editor", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two"]]]);
    await canvas(page).evaluate((element) => {
      element.style.transform = "scale(0.5)";
      element.style.transformOrigin = "0 0";
    });
    const before = await boxOf(blockWith(page, "One"));
    const text = await boxOf(textOf(page, "One"));

    await pickUp(page, handleOf(page, "One"));

    const lifted = liftedBlock(page);
    const after = await boxOf(lifted);
    expect(after.width).toBeCloseTo(before.width, 0);
    expect(after.height).toBeCloseTo(before.height, 0);
    const copied = await boxOf(
      lifted.getByRole("textbox", { includeHidden: true })
    );
    expect(copied.height).toBeCloseTo(text.height, 0);
    await page.keyboard.press("Escape");
  });

  test("picking up a tall Block keeps the page where it is, scrolled to its end", async ({
    context,
    page,
  }) => {
    await serveImages(context);
    await openBlocks(page, ["text", "image"]);
    const block = blockGroup(page, "Image");
    await block.hover();
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    );
    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled).toBeGreaterThan(0);
    const start = await boxOf(block.getByTestId("drag-handle"));

    await page.mouse.move(start.x + 8, start.y + 12);
    await page.mouse.down();
    await page.mouse.move(start.x + 16, start.y + 20, { steps: 2 });
    await settle(page);

    await expect(page.evaluate(() => window.scrollY)).resolves.toBe(scrolled);
    await page.mouse.up();
  });

  test("the other Blocks stay where they are", async ({ page }) => {
    await openEmail(page, [[["One", "Two", "Three"]]]);
    const before = await boxOf(blockWith(page, "Three"));

    await pickUp(page, handleOf(page, "One"));
    await moveTo(page, await bottomOf(blockWith(page, "Two")));

    expect(await boxOf(blockWith(page, "Three"))).toStrictEqual(before);
    await page.keyboard.press("Escape");
  });

  test("the indicator shows the position between two Blocks", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two", "Three"], ["Four"]]]);
    await pickUp(page, handleOf(page, "Four"));
    const two = await boxOf(blockWith(page, "Two"));
    const left = await boxOf(column(page, 0, 0));

    await moveTo(page, await topOf(blockWith(page, "Two")));
    const before = await indicatorBox(page);
    expect(before.y + before.height / 2).toBeCloseTo(two.y, 0);
    expect(before.x).toBeCloseTo(left.x, 0);
    expect(before.width).toBeCloseTo(left.width, 0);

    await moveTo(page, await bottomOf(blockWith(page, "Two")));
    const after = await indicatorBox(page);
    expect(after.y + after.height / 2).toBeCloseTo(two.y + two.height, 0);
    // The Column it would land in is highlighted, and no other.
    await expect(canvas(page).getByTestId("email")).toHaveAttribute(
      "data-dragging"
    );
    await expect(column(page, 0, 0)).toHaveAttribute("data-drop-target");
    await expect(column(page, 0, 1)).not.toHaveAttribute("data-drop-target");

    await letGo(page);
    expect(await structure(page)).toStrictEqual([
      [["One", "Two", "Four", "Three"], []],
    ]);
    await expect(canvas(page).locator("[data-drop-target]")).toHaveCount(0);
    await expect(canvas(page).getByTestId("email")).not.toHaveAttribute(
      "data-dragging"
    );
  });

  test("on a page that scales the editor, the indicator is where the drop lands, as wide as its Column", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two"], ["Three"]]]);
    await canvas(page).evaluate((element) => {
      element.style.transform = "scale(0.5)";
      element.style.transformOrigin = "0 0";
    });
    await pickUp(page, handleOf(page, "Three"));
    const two = await boxOf(blockWith(page, "Two"));
    const left = await boxOf(column(page, 0, 0));

    await moveTo(page, await topOf(blockWith(page, "Two")));

    const box = await indicatorBox(page);
    expect(box.y + box.height / 2).toBeCloseTo(two.y, 0);
    expect(box.x).toBeCloseTo(left.x, 0);
    expect(box.width).toBeCloseTo(left.width, 0);
    await letGo(page);
    expect(await structure(page)).toStrictEqual([
      [["One", "Three", "Two"], []],
    ]);
  });

  test("the indicator spans the email outside any Row", async ({ page }) => {
    await openEmail(page, [[["One"], ["Two"]]]);
    await pickUp(page, handleOf(page, "One"));
    const row = await boxOf(canvas(page).getByTestId("row").first());

    await moveTo(page, { x: row.x + 100, y: row.y + row.height + 30 });

    const box = await indicatorBox(page);
    expect(box.y + box.height / 2).toBeCloseTo(row.y + row.height, 0);
    expect(box.x).toBeCloseTo(row.x, 0);
    expect(box.width).toBeCloseTo(row.width, 0);
    await page.keyboard.press("Escape");
  });
});

test.describe("dropping outside any Row", () => {
  test("below the email adds a Row at the end, as one change", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two"]], [["Three"]]]);
    const expectChanges = await changesSince(page);
    const { height, width, x, y } = await boxOf(
      canvas(page).getByTestId("row").last()
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
    await expectChanges(1);
  });

  test("on the first Row's controls adds a Row at the start", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two"]]]);
    const controls = await boxOf(
      page.getByRole("toolbar", { exact: true, name: "Row 1" })
    );

    // Its top, which is above the middle of the Row.
    await drag(page, handleOf(page, "Two"), {
      x: controls.x + controls.width / 2,
      y: controls.y + 4,
    });

    expect(await structure(page)).toStrictEqual([[["Two"]], [["One"]]]);
  });
});

test.describe("letting go far from the editor", () => {
  test("a release the window missed ends the drag", async ({ page }) => {
    await openEmail(page, [[["One", "Two"]]]);
    const lastPointer = await watchPointer(page);
    await pickUp(page, handleOf(page, "One"));
    await moveTo(page, await bottomOf(blockWith(page, "Two")));

    // As the next move would be after a release outside the window.
    await page.evaluate(
      (pointerId) => {
        window.dispatchEvent(
          new PointerEvent("pointermove", { buttons: 0, pointerId })
        );
      },
      await lastPointer()
    );

    await expect(dragMarks(page)).toHaveCount(0);
    await letGo(page);
    expect(await structure(page)).toStrictEqual([[["One", "Two"]]]);
  });
});

test.describe("a file dropped doesn't open in the page", () => {
  test("on the email", async ({ page }) => {
    await openBlocks(page, ["text"]);

    await expect(dropFileOn(blockGroup(page, "Text"))).resolves.toEqual([
      false,
      false,
    ]);
  });

  test("on the email in the open Preview", async ({ browserName, page }) => {
    test.skip(
      browserName === "webkit",
      "WebKit runs no listener in a document whose scripts are off"
    );
    await page.goto("/");
    await previewButton(page).click();
    const email = previewEmail(page);
    await expect(email).toContainText("Hello");

    // From inside the email's own document, where a real drop over it goes.
    await expect(dropFileOn(email)).resolves.toEqual([false, false]);
  });
});

test("text dragged within a Block's text still moves", async ({ page }) => {
  await openEmail(page, [[["One Two"]]]);
  const words = textBlock(page).getByText("One Two");
  await words.dblclick({ position: { x: 4, y: 8 } });
  // ProseMirror learns of the selection a moment later.
  await settle(page);

  // The selected first word goes after the second, as the browser sends a drag
  // of selected text.
  await words.evaluate((line) => {
    const text = line.firstChild;
    if (!text) {
      throw new Error("The line has no text");
    }
    /** Halfway along the character at `offset`. */
    const pointAt = (offset: number) => {
      const range = document.createRange();
      range.setStart(text, offset);
      range.setEnd(text, offset + 1);
      const { height, left, top, width } = range.getBoundingClientRect();
      return { clientX: left + width / 2, clientY: top + height / 2 };
    };
    const inOne = pointAt(1);
    const afterTwo = { ...pointAt(6), clientX: pointAt(6).clientX + 20 };
    const dataTransfer = new DataTransfer();
    const events = [
      ["dragstart", inOne],
      ["dragover", afterTwo],
      ["drop", afterTwo],
      ["dragend", afterTwo],
    ] as const;
    for (const [type, point] of events) {
      line.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          dataTransfer,
          ...point,
        })
      );
    }
  });

  await expect(textBlock(page)).toHaveText(/^ ?TwoOne ?$/u);
});

test.describe("dragging from the palette", () => {
  test("selects the new Block, ready to type in, and a click still adds one", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]]]);

    await drag(
      page,
      palette(page, "Text"),
      await bottomOf(blockWith(page, "One"))
    );
    await page.keyboard.type("Typed");

    await expect(textBlock(page).nth(1)).toHaveText("Typed");
    expect(await structure(page)).toStrictEqual([[["One", "Typed"]]]);

    // The new Block's settings show instead of the tabs.
    await openTab(page, "Content");
    await palette(page, "Text").click();
    await expect(structure(page)).resolves.toEqual([[["One", "Typed", ""]]]);
  });

  test("into an email with no Rows", async ({ page }) => {
    await openEmail(page, [[["One"]]]);
    await deleteRow(page, 1);
    await expect(textBlock(page)).toHaveCount(0);
    const email = await boxOf(canvas(page).getByTestId("email"));

    await drag(page, palette(page, "Text"), {
      x: email.x + 300,
      y: email.y + 20,
    });

    expect(await structure(page)).toStrictEqual([[[""]]]);
    await undoByKey(page);
    expect(await structure(page)).toStrictEqual([]);
  });

  test("leaves the palette button where it was", async ({ page }) => {
    await openEmail(page, [[["One"]]]);
    const before = await boxOf(palette(page, "Text"));

    await pickUp(page, palette(page, "Text"));
    await moveTo(page, await bottomOf(blockWith(page, "One")));
    await expect(palette(page, "Text")).toBeVisible();
    await letGo(page);

    // The new Block's settings show instead of the tabs.
    await openTab(page, "Content");
    expect(await boxOf(palette(page, "Text"))).toStrictEqual(before);
    await expect(dragMarks(page)).toHaveCount(0);
  });

  test("let go back on the palette, adds nothing and leaves the text cursor", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two"]]]);
    await putCursorAfterTwo(page);
    await openTab(page, "Content");
    const start = await centerOf(palette(page, "Text"));

    await pickUp(page, palette(page, "Text"));
    await moveTo(page, start);
    await expect(dropIndicator(page)).toBeHidden();
    await letGo(page);
    await page.keyboard.type("B");

    expect(await structure(page)).toStrictEqual([[["One", "TwoAB"]]]);
  });

  test("a click still adds a Block, however long the press", async ({
    page,
  }) => {
    await openEmail(page, [[["One"]]]);
    const { x, y } = await centerOf(palette(page, "Text"));

    await page.clock.install();

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.clock.runFor(1000);
    await page.mouse.up();

    expect(await structure(page)).toStrictEqual([[["One", ""]]]);
  });
});

test.describe("text after a move", () => {
  test("includes what was typed just before", async ({ page }) => {
    await openEmail(page, [[["One"], ["Two"]]]);
    await textOf(page, "One").click();
    await moveCursorToLineEnd(page);
    await page.keyboard.type(" more");

    await drag(
      page,
      handleOf(page, "One more"),
      await bottomOf(blockWith(page, "Two"))
    );

    expect(await structure(page)).toStrictEqual([[[], ["Two", "One more"]]]);
  });

  test("the moved Block can be clicked and edited", async ({ page }) => {
    await openEmail(page, [[["One", "Two"], ["Three"]]]);

    await drag(
      page,
      handleOf(page, "Two"),
      await topOf(blockWith(page, "Three"))
    );
    // Where its text starts, as Two's format bar covers its top end.
    await textOf(page, "Three").click({ position: { x: 24, y: 8 } });
    await textOf(page, "Two").click();
    await moveCursorToLineEnd(page);
    await page.keyboard.type("!");

    expect(await structure(page)).toStrictEqual([[["One"], ["Two!", "Three"]]]);
  });
});

test.describe("undo", () => {
  test("works after pressing a handle with no focus in the editor", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two"]]]);
    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockWith(page, "Two"))
    );
    await page.getByTestId("host-paragraph").click();
    const { x, y } = await centerOf(handleOf(page, "Two"));

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
    await undoByKey(page);

    expect(await structure(page)).toStrictEqual([[["One", "Two"]]]);
  });
});

test.describe("auto-scrolling", () => {
  const manyBlocks = Array.from({ length: 30 }, (_, index) => `Block ${index}`);

  // A window shorter than the email. The pointer goes to its middle across,
  // 640px, and to 10px from its top or bottom, inside the 60px where a drag
  // scrolls.
  test.use({ viewport: { height: 600, width: 1280 } });

  test("the page scrolls up near its top edge", async ({ page }) => {
    await openEmail(page, [[manyBlocks]]);
    const block = blockWith(page, "Block 29");
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

  test("picking up a Block near the top of the window doesn't scroll the page", async ({
    page,
  }) => {
    await openEmail(page, [[manyBlocks]]);
    const handle = handleOf(page, "Block 10");
    await blockWith(page, "Block 10").scrollIntoViewIfNeeded();
    await handle.hover();
    // Its handle 100px from the top: near it, but not at it.
    const { y } = await centerOf(handle);
    await page.evaluate((by) => window.scrollBy(0, by), y - 100);
    await handle.hover();
    const before = await scrollTop(page);

    await pickUp(page, handle);
    await settle(page);
    await settle(page);

    expect(await scrollTop(page)).toBe(before);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("a frame that comes late, as after the tab was in the background, scrolls no further than a tenth of a second's worth", async ({
    page,
  }) => {
    await openEmail(page, [
      [Array.from({ length: 80 }, (_, index) => `Block ${index}`)],
    ]);
    const handle = handleOf(page, "Block 79");
    await handle.scrollIntoViewIfNeeded();
    await handle.hover();
    await pickUp(page, handle);
    await page.mouse.move(640, 10, { steps: 8 });

    const steps = await page.evaluate(async () => {
      const scroller = document.scrollingElement as Element;
      // oxlint-disable-next-line promise/avoid-new -- These browser callbacks have no promise form.
      await new Promise(requestAnimationFrame);
      let last = scroller.scrollTop;
      // Three tenths of a second with no frames.
      const end = performance.now() + 300;
      while (performance.now() < end) {
        // Busy.
      }
      // How far each of the next frames scrolled. Each step holds one of the
      // drag's frames, and on a slow machine the one after the late frame can
      // count for a tenth of a second too.
      const scrolled: number[] = [];
      for (const _ of [1, 2, 3]) {
        // oxlint-disable-next-line promise/avoid-new, no-await-in-loop -- As above, and each frame waits for the last.
        await new Promise(requestAnimationFrame);
        scrolled.push(last - scroller.scrollTop);
        last = scroller.scrollTop;
      }
      return scrolled;
    });

    // The pointer is 50px into the 60px edge, so 1250px a second: 125px in a
    // tenth of a second, give or take rounding, where three tenths would be 375px.
    expect(Math.max(...steps)).toBeGreaterThan(0);
    expect(Math.max(...steps)).toBeLessThan(130);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  // The other tests have the container as the editor's parent.
  test("a container in another component's shadow root, around its slot, scrolls", async ({
    page,
  }) => {
    await openEmail(page, [[manyBlocks]]);
    await canvas(page).evaluate((element) => {
      const wrapper = document.createElement("div");
      wrapper.attachShadow({ mode: "open" }).innerHTML =
        '<section data-testid="scroller" style="height: 400px; overflow: auto; position: fixed; top: 0; left: 0; width: 800px; background: white; z-index: 10"><slot></slot></section>';
      element.replaceWith(wrapper);
      wrapper.append(element);
    });
    await expect(textBlock(page).first()).toBeVisible();
    const containerTop = () =>
      page.getByTestId("scroller").evaluate((scroller) => scroller.scrollTop);
    const handle = handleOf(page, "Block 1");
    await handle.hover();

    await pickUp(page, handle);
    await page.mouse.move(400, 395, { steps: 8 });

    await expect.poll(containerTop).toBeGreaterThan(100);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("a container scrolls sideways near its edge", async ({ page }) => {
    await openEmail(page, [[["One"]]]);
    const scroller = await inScroller(page, {
      editorWidth: 1400,
      height: 500,
      width: 600,
    });
    const containerLeft = () =>
      scroller.evaluate((element) => element.scrollLeft);
    const handle = handleOf(page, "One");
    await handle.hover();

    await pickUp(page, handle);
    await page.mouse.move(595, 250, { steps: 8 });

    await expect.poll(containerLeft).toBeGreaterThan(100);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("the page scrolls once a container can't go further", async ({
    page,
  }) => {
    await openEmail(page, [[manyBlocks]]);
    await page.evaluate(() => {
      // Taller than the window, whatever else the page has.
      document.body.style.minHeight = "300vh";
    });
    const scroller = await inScroller(page, { height: 500, width: 800 });
    const containerTop = () =>
      scroller.evaluate((element) => element.scrollTop);
    await scroller.evaluate((element) => {
      element.scrollTo(0, element.scrollHeight);
    });
    const end = await containerTop();
    expect(end).toBeGreaterThan(0);
    const handle = handleOf(page, "Block 29");
    await handle.hover();
    const before = await scrollTop(page);

    await pickUp(page, handle);
    // Below the container, near the bottom of the window.
    await page.mouse.move(400, 595, { steps: 8 });

    await expect.poll(() => scrollTop(page)).toBeGreaterThan(before + 100);
    expect(await containerTop()).toBe(end);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("letting go below a scrolling container, over what it hides, moves nothing", async ({
    page,
  }) => {
    await openEmail(page, [[manyBlocks]]);
    await inScroller(page, { height: 300, width: 800 });
    const expectChanges = await changesSince(page);
    const handle = handleOf(page, "Block 0");
    await handle.hover();

    await pickUp(page, handle);
    await moveTo(page, { x: 400, y: 360 });
    await letGo(page);

    const after = await structure(page);
    expect(after.flat().flat()).toStrictEqual(manyBlocks);
    await expectChanges(0);
  });

  test("a container doesn't scroll the way it hides", async ({ page }) => {
    // Tall enough to scroll up and down, which it doesn't hide.
    await openEmail(page, [[manyBlocks]]);
    const scroller = await inScroller(page, {
      editorWidth: 1400,
      height: 500,
      sideways: "hidden",
      width: 600,
    });
    const scrolled = () =>
      scroller.evaluate(({ scrollLeft, scrollTop: top }) => ({
        left: scrollLeft,
        top,
      }));
    const handle = handleOf(page, "Block 0");
    await handle.hover();

    await pickUp(page, handle);
    await page.mouse.move(595, 250, { steps: 8 });
    await settle(page);
    await settle(page);

    const sideways = await scrolled();
    expect(sideways.left).toBe(0);

    // The same drag still scrolls it down near its bottom edge.
    await page.mouse.move(300, 495, { steps: 8 });
    await expect
      .poll(async () => {
        const { top } = await scrolled();
        return top;
      })
      .toBeGreaterThan(100);
    const downwards = await scrolled();
    expect(downwards.left).toBe(0);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("the page scrolls down near its bottom edge, and the indicator keeps up", async ({
    page,
  }) => {
    await openEmail(page, [[manyBlocks]]);
    await page.evaluate(() => {
      const editor = document.querySelector("mail-quilt");
      window.scrollTo(0, (editor?.getBoundingClientRect().top ?? 0) + 40);
    });
    const handle = handleOf(page, "Block 1");
    await handle.hover();
    const before = await scrollTop(page);

    await pickUp(page, handle);
    await page.mouse.move(640, 590, { steps: 8 });
    // Read in the page, as a slow browser can scroll to the email's end between
    // one call from the test and the next, which leaves the pointer past it.
    // Each frame scrolls and then moves the indicator, so the two agree.
    const found = await page.waitForFunction(
      (start) =>
        (document.scrollingElement?.scrollTop ?? 0) > start + 300 && {
          top: document
            .querySelector("mail-quilt")
            ?.shadowRoot?.querySelector('[data-testid="drop-indicator"]')
            ?.getBoundingClientRect().top,
        },
      before,
      { polling: "raf" }
    );
    const { top } = (await found.jsonValue()) as { top?: number };
    expect(Math.abs((top ?? Number.POSITIVE_INFINITY) - 590)).toBeLessThan(60);

    await letGo(page);
    const after = await structure(page);
    const flat = after.flat().flat();
    expect(flat.indexOf("Block 1")).toBeGreaterThan(1);
    expect(flat).toHaveLength(manyBlocks.length);
  });
});

test.describe("a Block that's removed or replaced", () => {
  test("clearing the email during a drag ends it safely", async ({ page }) => {
    const errors = consoleErrors(page);
    await openEmail(page, [[["One", "Two"]]]);

    await pickUp(page, handleOf(page, "One"));
    await setValue(page, undefined);
    await settle(page);
    await letGo(page);
    expect(errors).toStrictEqual([]);

    await setValue(page, emailWith([[["Three", "Four"]]]));
    await expect(textBlock(page).first()).toBeVisible();
    await drag(
      page,
      handleOf(page, "Three"),
      await bottomOf(blockWith(page, "Four"))
    );
    expect(await structure(page)).toStrictEqual([[["Four", "Three"]]]);
  });

  test("removing the editor during a drag ends it safely", async ({ page }) => {
    const errors = consoleErrors(page);
    await openEmail(page, [[["One", "Two"]]]);

    await pickUp(page, handleOf(page, "One"));
    const removed = await canvas(page).evaluateHandle((element) => {
      const parent = element.parentElement;
      element.remove();
      return { element, parent };
    });
    await page.mouse.up();
    await removed.evaluate(({ element, parent }) => parent?.append(element));
    await expect(textBlock(page).first()).toBeVisible();
    await settle(page);
    expect(errors).toStrictEqual([]);

    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockWith(page, "Two"))
    );
    expect(await structure(page)).toStrictEqual([[["Two", "One"]]]);
  });

  test("a Column that undo brings back during a drag takes the drop", async ({
    page,
  }) => {
    await openEmail(page, [[["One"], ["Two"]]]);
    await chooseLayout(page, 1, "100");
    expect(await structure(page)).toStrictEqual([[["One", "Two"]]]);

    await pickUp(page, handleOf(page, "One"));
    await undoByKey(page);
    await settle(page);
    await moveTo(page, await bottomOf(blockWith(page, "Two")));
    await letGo(page);

    expect(await structure(page)).toStrictEqual([[[], ["Two", "One"]]]);
  });

  test("undoing during a drag ends it where undo left things", async ({
    page,
  }) => {
    const errors = consoleErrors(page);
    await openEmail(page, [[["One"], ["Two"]]]);
    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockWith(page, "Two"))
    );

    await pickUp(page, handleOf(page, "One"));
    await moveTo(page, await topOf(blockWith(page, "Two")));
    await undoByKey(page);
    await settle(page);
    // The undo made the Block anew, so the drag of the old one is over.
    await expect(dragMarks(page)).toHaveCount(0);
    await expect(dropIndicator(page)).toBeHidden();
    await letGo(page);

    expect(await structure(page)).toStrictEqual([[["One"], ["Two"]]]);
    expect(errors).toStrictEqual([]);
    await drag(
      page,
      handleOf(page, "One"),
      await bottomOf(blockWith(page, "Two"))
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
    "Only Chromium's DevTools protocol can send a touch that moves"
  );
  test.use({ hasTouch: true, isMobile: true });

  test("a Block's handle drags it, and the page doesn't scroll", async ({
    page,
  }) => {
    await openEmail(page, [[["One", "Two", "Three", "Four"]]]);
    // A phone shows the whole test page, so this gives it room to scroll.
    await page.evaluate(() => {
      const below = document.createElement("section");
      below.style.height = "20000px";
      document.body.append(below);
    });
    const before = await scrollTop(page);

    // Straight up and far, as that would scroll the page down. A move mostly
    // sideways would be read as one, which the page can't scroll for.
    const from = await centerOf(handleOf(page, "Four"));
    const { y } = await topOf(blockWith(page, "One"));
    await touchDrag(page, from, { x: from.x, y });

    await expect
      .poll(() => structure(page))
      .toStrictEqual([[["Four", "One", "Two", "Three"]]]);
    expect(await scrollTop(page)).toBe(before);
    await expect(dragMarks(page)).toHaveCount(0);
  });

  test("a palette item swiped up scrolls the Side panel, and adds nothing", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 300, width: 1280 });
    await openEmail(page, [[["One"]]]);
    const tile = palette(page, "Image");
    await tile.scrollIntoViewIfNeeded();
    /** How far the nearest container that can scroll is scrolled. */
    const scrolled = () =>
      tile.evaluate((element) => {
        let container = element.parentElement;
        while (container && container.scrollHeight <= container.clientHeight) {
          container = container.parentElement;
        }
        return container?.scrollTop;
      });
    const before = await scrolled();

    const from = await centerOf(tile);
    await touchDrag(page, from, { x: from.x, y: from.y - 120 });

    await expect.poll(scrolled).toBeGreaterThan(before ?? 0);
    expect(await structure(page)).toStrictEqual([[["One"]]]);
  });

  test("a palette item drags a new Block in", async ({ page }) => {
    await openEmail(page, [[["One"]]]);

    await touchDrag(
      page,
      await centerOf(palette(page, "Text")),
      await bottomOf(blockWith(page, "One"))
    );

    await expect.poll(() => structure(page)).toStrictEqual([[["One", ""]]]);
  });
});
