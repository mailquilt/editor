import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  addRow,
  announcement,
  blockTool,
  blockWith,
  boxOf,
  canvas,
  changeCount,
  chooseLayout,
  countHostEscapes,
  deleteBlock,
  emailWith,
  layoutOption,
  linkUrlField,
  openBlocks,
  openEmail as open,
  openTab,
  palette,
  previewButton,
  redoByKey,
  selectedText,
  selectRow,
  settle,
  setValue,
  stopClock,
  structure,
  textOf,
  tooltip,
  undo,
  undoButton,
  undoByKey,
  violations,
  watchPrevented,
} from "./helpers.js";

/** Back to the side panel's tabs from the keyboard, the Block still selected. */
const backToTabs = async (page: Page) => {
  await canvas(page).getByRole("button", { exact: true, name: "Back" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    canvas(page).getByRole("tab", { name: "Content" })
  ).toBeFocused();
};

/**
 * The controls that can't show focus, of those that can take it now. A group
 * with any tabindex is one, as the floating toolbar takes focus from the editor.
 */
const controlsWithoutRing = (page: Page) =>
  canvas(page).evaluate((host) => {
    const root = host.shadowRoot as ShadowRoot;
    const controls = root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input, select, [role="group"][tabindex], [role="textbox"]'
    );
    return [...controls]
      .filter((control) => {
        control.focus();
        const { outlineStyle, outlineWidth } = getComputedStyle(control);
        return (
          root.activeElement === control &&
          (outlineStyle !== "solid" || !["2px", "3px"].includes(outlineWidth))
        );
      })
      .map(
        (control) => control.getAttribute("aria-label") ?? control.textContent
      );
  });

/**
 * How far below the top of the window a Block and its toolbar start, and so
 * negative if they're cut off there.
 */
const gapBelowTop = async (page: Page, text: string) => {
  const block = await boxOf(blockWith(page, text));
  const toolbar = await boxOf(
    blockWith(page, text).getByRole("toolbar", { name: "Block tools" })
  );
  return Math.min(block.y, toolbar.y);
};

/** Where the Block "L" is in the only Column of the only Row. */
const positionOfL = async (page: Page) => {
  const [row] = await structure(page);
  return row?.[0]?.indexOf("L");
};

/** Counts every change a screen reader could be told about in the live region. */
const countAnnouncements = (page: Page) =>
  canvas(page).evaluate((host) => {
    const status = host.shadowRoot?.querySelector('[role="status"]') as Element;
    const counter = window as unknown as { announcements: number };
    counter.announcements = 0;
    new MutationObserver(() => {
      counter.announcements += 1;
    }).observe(status, { characterData: true, childList: true, subtree: true });
  });

const announcementCount = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { announcements: number }).announcements
  );

test.describe("selecting a Block", () => {
  test("Tab reaches a Block and selects it, and then its text", async ({
    page,
  }) => {
    await open(page, [[["First"], ["Second"]]]);
    await expect(deleteBlock(page)).toHaveCount(0);

    await canvas(page).getByRole("button", { name: "Delete Row" }).focus();
    await page.keyboard.press("Tab");

    await expect(blockWith(page, "First")).toBeFocused();
    await expect(blockWith(page, "First")).toHaveAttribute(
      "aria-current",
      "true"
    );
    await expect(deleteBlock(page)).toBeVisible();
    await expect(structure(page)).resolves.toEqual([[["First"], ["Second"]]]);

    await page.keyboard.press("Tab");
    await expect(textOf(page, "First")).toBeFocused();

    // The selected Block's toolbar is one stop.
    await page.keyboard.press("Tab");
    await expect(blockTool(page, "Move Block up")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(blockWith(page, "Second")).toBeFocused();
    await expect(blockWith(page, "Second")).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  test("arrow keys go through the Blocks in reading order", async ({
    page,
  }) => {
    await open(page, [[["A", "B"], ["C"]], [["D"]]]);
    await blockWith(page, "A").focus();

    await page.keyboard.press("ArrowDown");
    await expect(blockWith(page, "B")).toBeFocused();
    await expect(blockWith(page, "B")).toHaveAttribute("aria-current", "true");
    await expect(blockWith(page, "A")).not.toHaveAttribute("aria-current");

    await page.keyboard.press("ArrowDown");
    await expect(blockWith(page, "C")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(blockWith(page, "D")).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(blockWith(page, "D")).toBeFocused();

    await page.keyboard.press("ArrowUp");
    await expect(blockWith(page, "C")).toBeFocused();
  });

  test("left and right go across Columns, past empty ones", async ({
    page,
  }) => {
    await open(page, [[["A", "B"], [], ["C"]]]);
    await blockWith(page, "B").focus();

    await page.keyboard.press("ArrowRight");
    await expect(blockWith(page, "C")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(blockWith(page, "C")).toBeFocused();

    await page.keyboard.press("ArrowLeft");
    await expect(blockWith(page, "A")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(blockWith(page, "A")).toBeFocused();
  });

  test("the same place in the next Column keeps its position", async ({
    page,
  }) => {
    await open(page, [
      [
        ["A", "B"],
        ["C", "D"],
      ],
    ]);
    await blockWith(page, "B").focus();

    await page.keyboard.press("ArrowRight");
    await expect(blockWith(page, "D")).toBeFocused();
  });
});

test.describe("moving a Block with Alt+Arrow keys", () => {
  test("moves within a Column, keeping focus for the next press", async ({
    page,
  }) => {
    await open(page, [[["A", "B", "C"]]]);
    await blockWith(page, "A").focus();

    await page.keyboard.press("Alt+ArrowDown");
    await expect(structure(page)).resolves.toEqual([[["B", "A", "C"]]]);
    await expect(blockWith(page, "A")).toBeFocused();

    await page.keyboard.press("Alt+ArrowDown");
    await expect(structure(page)).resolves.toEqual([[["B", "C", "A"]]]);
    await expect(blockWith(page, "A")).toBeFocused();

    await page.keyboard.press("Alt+ArrowUp");
    await expect(structure(page)).resolves.toEqual([[["B", "A", "C"]]]);
    await expect(blockWith(page, "A")).toBeFocused();
  });

  test("moves between Columns, into empty ones too", async ({ page }) => {
    await open(page, [[["A", "B"], [], ["C"]]]);
    await blockWith(page, "B").focus();

    await page.keyboard.press("Alt+ArrowRight");
    await expect(structure(page)).resolves.toEqual([[["A"], ["B"], ["C"]]]);
    await expect(blockWith(page, "B")).toBeFocused();

    await page.keyboard.press("Alt+ArrowRight");
    await expect(structure(page)).resolves.toEqual([[["A"], [], ["B", "C"]]]);
    await expect(blockWith(page, "B")).toBeFocused();

    await page.keyboard.press("Alt+ArrowLeft");
    await expect(structure(page)).resolves.toEqual([[["A"], ["B"], ["C"]]]);
    await expect(blockWith(page, "B")).toBeFocused();
  });

  test("after Back, keeps the side panel's tabs showing", async ({ page }) => {
    await open(page, [[["A", "B", "C"]]]);
    await blockWith(page, "A").focus();
    // The mouse leaves focus on the Block.
    await canvas(page)
      .getByRole("button", { exact: true, name: "Back" })
      .click();

    await page.keyboard.press("Alt+ArrowDown");

    await expect(structure(page)).resolves.toEqual([[["B", "A", "C"]]]);
    await expect(blockWith(page, "A")).toBeFocused();
    await expect(
      canvas(page).getByRole("tab", { name: "Content" })
    ).toBeVisible();
  });

  test("past the end of a Column, moves into the next Row", async ({
    page,
  }) => {
    await open(page, [[["A"], ["B"]], [["C", "D"]]]);
    await blockWith(page, "B").focus();

    await page.keyboard.press("Alt+ArrowDown");
    await expect(structure(page)).resolves.toEqual([
      [["A"], []],
      [["B", "C", "D"]],
    ]);
    await expect(blockWith(page, "B")).toBeFocused();

    await page.keyboard.press("Alt+ArrowUp");
    await expect(structure(page)).resolves.toEqual([
      [["A", "B"], []],
      [["C", "D"]],
    ]);
    await expect(blockWith(page, "B")).toBeFocused();
  });

  test("past the top or bottom of the email, adds a Row of its own", async ({
    page,
  }) => {
    await open(page, [[["A"], ["B"]]]);
    await blockWith(page, "A").focus();

    await page.keyboard.press("Alt+ArrowUp");
    await expect(structure(page)).resolves.toEqual([[["A"]], [[], ["B"]]]);
    await expect(blockWith(page, "A")).toBeFocused();

    await blockWith(page, "B").focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(structure(page)).resolves.toEqual([
      [["A"]],
      [[], []],
      [["B"]],
    ]);
    await expect(blockWith(page, "B")).toBeFocused();
  });

  test("each move is one undo step, and focus stays on the Block", async ({
    page,
  }) => {
    await open(page, [[["A"], ["B"]]]);
    await blockWith(page, "A").focus();

    await page.keyboard.press("Alt+ArrowRight");
    await page.keyboard.press("Alt+ArrowUp");
    await expect(structure(page)).resolves.toEqual([[["A"]], [[], ["B"]]]);

    await undoByKey(page);
    await expect(structure(page)).resolves.toEqual([[[], ["A", "B"]]]);
    await expect(blockWith(page, "A")).toBeFocused();

    await undoByKey(page);
    await expect(structure(page)).resolves.toEqual([[["A"], ["B"]]]);
    await expect(blockWith(page, "A")).toBeFocused();

    await redoByKey(page);
    await expect(structure(page)).resolves.toEqual([[[], ["A", "B"]]]);
    await expect(blockWith(page, "A")).toBeFocused();
  });
});

test.describe("moving a Block with toolbar buttons", () => {
  test("from the keyboard, focus stays on the button for the next press", async ({
    page,
  }) => {
    await open(page, [[["A", "B", "C"], []]]);
    await blockWith(page, "A").focus();
    await blockTool(page, "Move Block down").focus();

    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["B", "A", "C"], []]]);
    await expect(blockTool(page, "Move Block down")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["B", "C", "A"], []]]);
    await expect(blockTool(page, "Move Block down")).toBeFocused();

    await blockTool(page, "Move Block right").focus();
    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["B", "C"], ["A"]]]);

    await blockTool(page, "Move Block left").focus();
    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["A", "B", "C"], []]]);

    await blockTool(page, "Move Block down").focus();
    await page.keyboard.press("Enter");
    await blockTool(page, "Move Block up").focus();
    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["A", "B", "C"], []]]);
  });

  test("with the mouse, the text keeps focus and its cursor", async ({
    page,
  }) => {
    await open(page, [[["A", "B"]]]);
    await textOf(page, "A").click();
    await page.keyboard.type("x");

    await blockTool(page, "Move Block down").click();

    await expect(structure(page)).resolves.toEqual([[["B", "Ax"]]]);
    await expect(textOf(page, "Ax")).toBeFocused();
    await page.keyboard.type("y");
    await expect(structure(page)).resolves.toEqual([[["B", "Axy"]]]);
  });
});

test.describe("announcing a move", () => {
  // At a Row's edge, and alone in a Row at the top, where every press would
  // otherwise add an empty Row.
  test("says when a Block can't go further, and changes nothing", async ({
    page,
  }) => {
    await open(page, [[["A"]]]);
    const before = await changeCount(page).textContent();
    await blockWith(page, "A").focus();

    await page.keyboard.press("Alt+ArrowLeft");
    await expect(announcement(page)).toHaveText("The Block can't move left.");

    await page.keyboard.press("Alt+ArrowUp");
    await expect(announcement(page)).toHaveText("The Block can't move up.");
    await expect(structure(page)).resolves.toEqual([[["A"]]]);
    await expect(changeCount(page)).toHaveText(before as string);
  });

  test("the same words twice are still two announcements", async ({ page }) => {
    await open(page, [[["A", "B", "C"]]]);
    await countAnnouncements(page);
    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(announcement(page)).toHaveText(
      "Moved to Row 1, Column 1, position 2 of 3."
    );
    await expect.poll(() => announcementCount(page)).toBe(1);

    await blockWith(page, "C").focus();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(structure(page)).resolves.toEqual([[["B", "C", "A"]]]);
    await expect(announcement(page)).toHaveText(
      "Moved to Row 1, Column 1, position 2 of 3."
    );

    await expect.poll(() => announcementCount(page)).toBe(2);
  });

  test("undo and redo of a move say where the Block went", async ({ page }) => {
    await open(page, [[["A", "B"], ["C"]]]);
    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowRight");

    await undoByKey(page);
    await expect(announcement(page)).toHaveText(
      "Undo moved a Block to Row 1, Column 1, position 1 of 2."
    );

    await redoByKey(page);
    await expect(announcement(page)).toHaveText(
      "Redo moved a Block to Row 1, Column 2, position 1 of 2."
    );
  });

  test("undo of something else clears the last move's words", async ({
    page,
  }) => {
    await open(page, [[["A", "B"]]]);
    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowDown");
    await addRow(page);
    await expect(announcement(page)).not.toBeEmpty();

    await undo(page);

    await expect(structure(page)).resolves.toEqual([[["B", "A"]]]);
    await expect(announcement(page)).toBeEmpty();
  });

  test("undo of a layout change that moves several Blocks says nothing of one", async ({
    page,
  }) => {
    await open(page, [[["A"], ["B"], ["C"]]]);
    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(announcement(page)).toHaveText("The Block can't move left.");
    await chooseLayout(page, 1, "100");
    await expect(structure(page)).resolves.toEqual([[["A", "B", "C"]]]);

    await undo(page);

    await expect(structure(page)).resolves.toEqual([[["A"], ["B"], ["C"]]]);
    await expect(announcement(page)).toBeEmpty();
  });

  test("doesn't carry over to another email", async ({ page }) => {
    await open(page, [[["A", "B"]]]);
    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(announcement(page)).not.toBeEmpty();
    // The controlled host sets `value` from the move, which would replace this.
    await expect(changeCount(page)).toHaveText("1");

    await setValue(page, emailWith([[["C"]]]));

    await expect(blockWith(page, "C")).toBeVisible();
    await expect(announcement(page)).toBeEmpty();
  });
});

test.describe("typing inside a Block", () => {
  test("arrow keys move the cursor, and Alt+Arrow keys don't move the Block or go back a page", async ({
    page,
  }) => {
    // As on Windows and Linux, where Alt+← goes back a page.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "platform", {
        get: () => "Win32",
      });
    });
    await open(page, [[["one two", "B"], ["C"]]]);
    await textOf(page, "one two").click();
    // Listening before the key is pressed, so the press can't come first.
    const leftPrevented = await watchPrevented(page, "ArrowLeft");

    await page.keyboard.press("Alt+ArrowDown");
    await page.keyboard.press("Alt+ArrowUp");
    await page.keyboard.press("Alt+ArrowLeft");

    await expect(structure(page)).resolves.toEqual([[["one two", "B"], ["C"]]]);
    await expect(textOf(page, "one two")).toBeFocused();
    await expect.poll(leftPrevented).toBe(true);

    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
    );
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("x");
    await expect(structure(page)).resolves.toEqual([
      [["oxne two", "B"], ["C"]],
    ]);
    await expect(textOf(page, "oxne two")).toBeFocused();
  });

  // The browser moves the cursor by word, which only a real Mac does, so this
  // checks the editor leaves the key to it on any platform that says it's one.
  test("on a Mac, Alt+← is left to the browser, to move the cursor by word", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "platform", {
        get: () => "MacIntel",
      });
    });
    await open(page, [[["one two"], ["C"]]]);
    await textOf(page, "one two").click();
    const leftPrevented = await watchPrevented(page, "ArrowLeft");
    // After the check above has seen the press, so a browser that isn't a Mac
    // doesn't take it as Back and leave the page.
    await page.evaluate(() => {
      window.addEventListener("keydown", (event) => event.preventDefault());
    });

    await page.keyboard.press("Alt+ArrowLeft");

    await expect.poll(leftPrevented).toBe(false);
    await expect(textOf(page, "one two")).toBeFocused();
  });

  test("Escape returns to the Block, and Enter to the same place", async ({
    page,
  }) => {
    await open(page, [[["A", "B"]]]);
    await textOf(page, "A").click();
    await page.keyboard.type("x");

    await page.keyboard.press("Escape");
    await expect(blockWith(page, "Ax")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(textOf(page, "Ax")).toBeFocused();
    await page.keyboard.type("y");
    await expect(structure(page)).resolves.toEqual([[["Axy", "B"]]]);
  });

  test("Escape from the text stops at the editor, and then reaches the host", async ({
    page,
  }) => {
    await open(page, [[["A"]]]);
    const escapes = await countHostEscapes(page);
    await textOf(page, "A").click();

    await page.keyboard.press("Escape");
    await expect(blockWith(page, "A")).toBeFocused();
    await expect(escapes()).resolves.toBe(0);

    await page.keyboard.press("Escape");
    await expect(escapes()).resolves.toBe(1);
  });

  test("Escape that an input method handled stays in the text", async ({
    page,
  }) => {
    await open(page, [[["A"]]]);
    await textOf(page, "A").click();

    // WebKit can end the composition first, then send this.
    await textOf(page, "A").evaluate((text) => {
      text.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          composed: true,
          key: "Escape",
          keyCode: 229,
        })
      );
    });

    await expect(textOf(page, "A")).toBeFocused();
  });

  test("Ctrl/⌘+Z that an input method handled doesn't undo", async ({
    page,
  }) => {
    await open(page, [[["A"]]]);
    await textOf(page, "A").click();
    await page.keyboard.type("B");
    await expect(structure(page)).resolves.toEqual([[["AB"]]]);

    // Both modifiers, so it's the shortcut on any platform.
    await textOf(page, "AB").evaluate((text) => {
      text.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          code: "KeyZ",
          composed: true,
          ctrlKey: true,
          key: "Process",
          keyCode: 229,
          metaKey: true,
        })
      );
    });
    await settle(page);

    await expect(structure(page)).resolves.toEqual([[["AB"]]]);
  });

  test("holding Enter on a Block goes to its text and adds nothing", async ({
    page,
  }) => {
    await open(page, [[["A"]]]);
    await blockWith(page, "A").focus();

    await page.keyboard.down("Enter");
    await page.keyboard.down("Enter");
    await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");

    await expect(textOf(page, "A")).toBeFocused();
    await expect(textOf(page, "A").locator("p")).toHaveCount(1);
    await expect(changeCount(page)).toHaveText("0");

    await page.keyboard.press("Enter");
    await expect(textOf(page, "A").locator("p")).toHaveCount(2);
  });

  test("holding Enter in the text still adds paragraphs", async ({ page }) => {
    await open(page, [[["A"]]]);
    await textOf(page, "A").click();

    await page.keyboard.down("Enter");
    await page.keyboard.down("Enter");
    await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");

    await expect(textOf(page, "A").locator("p")).toHaveCount(4);
  });

  test("with focus on the Block itself, typing changes nothing", async ({
    page,
  }) => {
    await open(page, [[["A", "B"]]]);
    await textOf(page, "A").click();
    await page.keyboard.press("Escape");
    await expect(blockWith(page, "A")).toBeFocused();

    await page.keyboard.type("x");

    await expect(structure(page)).resolves.toEqual([[["A", "B"]]]);
  });

  test("modified arrow keys on the Block itself do nothing", async ({
    page,
  }) => {
    await open(page, [[["A", "B"]]]);
    await blockWith(page, "A").focus();

    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Alt+Shift+ArrowDown");

    await expect(blockWith(page, "A")).toBeFocused();
    await expect(structure(page)).resolves.toEqual([[["A", "B"]]]);
  });
});

test.describe("Enter on a palette item", () => {
  test("inserts after the selected Block, in its Column, as one undo step", async ({
    page,
  }) => {
    await open(page, [[["A", "B"], ["C"]]]);
    await blockWith(page, "A").focus();
    await backToTabs(page);
    await palette(page, "Text").focus();

    await page.keyboard.press("Enter");

    await expect(selectedText(page)).toBeFocused();
    await stopClock(page);
    await page.keyboard.type("New");
    await expect(structure(page)).resolves.toEqual([
      [["A", "New", "B"], ["C"]],
    ]);

    await undo(page);
    await undo(page);
    await expect(structure(page)).resolves.toEqual([[["A", "B"], ["C"]]]);
  });

  test("holding it adds one Block and no empty paragraphs", async ({
    page,
  }) => {
    await open(page, [[["A"]]]);
    await palette(page, "Text").focus();

    await page.keyboard.down("Enter");
    await expect(selectedText(page)).toBeFocused();
    await page.keyboard.down("Enter");
    await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");

    await expect(structure(page)).resolves.toEqual([[["A", ""]]]);
    await expect(selectedText(page).locator("p")).toHaveCount(1);
  });

  test("with no Block selected, adds to the last Column, and shows it", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 500, width: 1280 });
    const above = Array.from({ length: 10 }, (_, index) => [[`R${index}`]]);
    await open(page, [...above, [["A"], ["B"]]]);
    await palette(page, "Text").focus();
    await expect(blockWith(page, "B")).not.toBeInViewport();

    await page.keyboard.press("Enter");

    await expect(selectedText(page)).toBeFocused();
    await expect(selectedText(page)).toBeInViewport();
    await page.keyboard.type("New");
    await expect(structure(page)).resolves.toEqual([
      ...above,
      [["A"], ["B", "New"]],
    ]);
  });
});

test.describe("labels and focus states", () => {
  test("a Block says where it is and what its keys do", async ({ page }) => {
    await open(page, [[["A"], ["B", "C"]]]);

    await expect(blockWith(page, "C")).toHaveAccessibleName(
      "Text Block, Row 1, Column 2, position 2 of 2"
    );
    await expect(blockWith(page, "C")).toHaveAccessibleDescription(
      /Enter to edit.*arrow keys.*Alt/u
    );

    await blockWith(page, "C").focus();
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(blockWith(page, "C")).toHaveAccessibleName(
      "Text Block, Row 1, Column 1, position 2 of 2"
    );
  });

  test("a button in an empty Column says which Column it fills", async ({
    page,
  }) => {
    await open(page, [[["A"], []], [[]]]);

    await expect(
      page.getByRole("button", { name: "Add Text Block here" })
    ).toHaveCount(2);
    await expect(
      page.getByRole("button", {
        exact: true,
        name: "Add Text Block here, Row 1, Column 2",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        exact: true,
        name: "Add Text Block here, Row 2, Column 1",
      })
    ).toBeVisible();
  });

  test("every control shows where focus is", async ({ page }) => {
    await open(page, [[["A"], []]]);
    await textOf(page, "A").click();
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    await expect(linkUrlField(page)).toBeFocused();
    // Browsers only show focus from a script after keyboard use.
    await page.keyboard.press("Tab");

    await expect(controlsWithoutRing(page)).resolves.toEqual([]);

    // The Email settings, and then the Row's.
    await openTab(page, "Settings");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("group", { exact: true, name: "Email" })
    ).toBeVisible();
    await expect(controlsWithoutRing(page)).resolves.toEqual([]);

    await canvas(page).getByRole("button", { name: "Select Row" }).focus();
    await page.keyboard.press("Enter");
    const row = page.getByRole("group", { exact: true, name: "Row" });
    await expect(row).toBeVisible();
    await expect(controlsWithoutRing(page)).resolves.toEqual([]);
  });

  test("the Preview's Close button shows where focus is", async ({ page }) => {
    await open(page, [[["A"]]]);
    await previewButton(page).focus();
    await page.keyboard.press("Enter");
    const close = page.getByRole("button", { name: "Close" });
    await expect(close).toBeFocused();

    await expect(controlsWithoutRing(page)).resolves.toEqual([]);
    await expect(close).toBeFocused();
  });

  test("the Block with focus looks different from one only selected", async ({
    page,
  }) => {
    await open(page, [[["A"]]]);
    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowLeft");

    const outlineWidth = () =>
      blockWith(page, "A").evaluate(
        (element) => getComputedStyle(element).outlineWidth
      );
    const focused = await outlineWidth();
    await blockTool(page, "Move Block up").focus();

    expect(await outlineWidth()).not.toBe(focused);
  });

  const TWELVE = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  // 900px wide, the test host's padding leaves the editor too narrow for the
  // side panel beside the canvas, so it goes below.
  for (const width of [1000, 900]) {
    test(`a selected Block and its toolbar stay in view at ${width}px wide`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 600, width });
      await open(page, [[TWELVE]]);
      await blockWith(page, "L").focus();

      // oxlint-disable no-await-in-loop -- Each press depends on the one before.
      for (const text of ["K", "J", "I", "H", "G", "F", "E", "D", "C", "B"]) {
        await page.keyboard.press("ArrowUp");
        await expect(blockWith(page, text)).toBeFocused();
        await expect
          .poll(() => gapBelowTop(page, text))
          .toBeGreaterThanOrEqual(0);
      }
      // oxlint-enable no-await-in-loop
    });
  }

  test("a Block moved from the keyboard, or by redo, stays in view with its toolbar", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 500, width: 1000 });
    await open(page, [[TWELVE]]);
    await blockWith(page, "L").focus();

    // oxlint-disable no-await-in-loop -- Each press depends on the one before.
    for (const expected of [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]) {
      await page.keyboard.press("Alt+ArrowUp");
      await expect.poll(() => positionOfL(page)).toBe(expected);
      await expect.poll(() => gapBelowTop(page, "L")).toBeGreaterThanOrEqual(0);
    }
    // oxlint-enable no-await-in-loop
    await expect(blockWith(page, "L")).toBeFocused();
    await expect(blockWith(page, "L")).toBeInViewport();

    // Redo brings it back into view too.
    await undoByKey(page);
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(blockWith(page, "L")).not.toBeInViewport();

    // The neighbour is what moves in the DOM here, so focus alone wouldn't scroll.
    await redoByKey(page);

    await expect(blockWith(page, "L")).toBeInViewport();
  });
});

/** The dark theme on the docs' "Theme the editor" page, which claims AA contrast. */
const DARK_THEME = `
  --mq-color-workspace: #0f1115;
  --mq-color-surface: #181b21;
  --mq-color-surface-muted: #20242b;
  --mq-color-surface-hover: #272b33;
  --mq-color-text: #e8eaed;
  --mq-color-text-muted: #a3a9b3;
  --mq-color-border: #2c3038;
  --mq-color-border-strong: #7a828f;
  --mq-color-accent: #7c93ff;
  --mq-color-accent-strong: #a9b8ff;
  --mq-color-accent-soft: rgb(124 147 255 / 16%);
  --mq-color-outline-hover: rgb(124 147 255 / 50%);
  --mq-color-on-accent: #0f1115;
  --mq-color-danger: #ff7a6e;
  --mq-color-tooltip: #e8eaed;
  --mq-color-on-tooltip: #16181d;
  --mq-color-backdrop: rgb(0 0 0 / 65%);
  --mq-color-scheme: dark;
`;

test.describe("automated accessibility checks", () => {
  test("pass with Columns, empty Columns, and no Block or one moved selected", async ({
    page,
  }) => {
    await open(page, [[["A", "B"], []], [["C"]]]);
    expect(await violations(page)).toEqual([]);

    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(announcement(page)).not.toBeEmpty();

    expect(await violations(page)).toEqual([]);
  });

  test("pass with the link field showing its error", async ({ page }) => {
    await open(page, [[["A"]]]);
    await textOf(page, "A").click();
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    await linkUrlField(page).fill("example.com");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });

  test("pass with a Row, the Rows tab, a Heading and the narrow notice showing", async ({
    page,
  }) => {
    await openBlocks(page, ["heading", "text"]);

    await selectRow(page, 1);
    await expect(layoutOption(page, "100")).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await openTab(page, "Rows");
    expect(await violations(page)).toEqual([]);

    await canvas(page).getByRole("group", { name: "Heading Block" }).focus();
    await expect(page.getByLabel("Level", { exact: true })).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await page.setViewportSize({ height: 800, width: 390 });
    await expect(
      canvas(page).getByText("Editing needs more room")
    ).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("pass with a tooltip showing, in the default and the dark theme", async ({
    page,
  }) => {
    await open(page, [[["A"]]]);
    await blockWith(page, "A").focus();
    await undoButton(page).hover();
    await expect(tooltip(page)).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await page.addStyleTag({ content: `mail-quilt { ${DARK_THEME} }` });
    await expect(canvas(page).getByTestId("workspace")).toHaveCSS(
      "background-color",
      "rgb(15, 17, 21)"
    );
    await expect(tooltip(page)).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("pass with the Preview open", async ({ page }) => {
    await open(page, [[["A"]]]);
    await previewButton(page).click();
    await expect(page.getByTitle("Email preview")).toBeVisible();

    expect(
      await violations(page, "mail-quilt", { excludeIframe: true })
    ).toEqual([]);
  });
});
