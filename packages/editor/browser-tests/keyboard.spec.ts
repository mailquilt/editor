import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  addBlock,
  addRow,
  announcement,
  barButton,
  blockTool,
  blockWith,
  boxOf,
  canvas,
  changeCount,
  changesSince,
  chooseLayout,
  countHostEscapes,
  deleteBlock,
  emailWith,
  layoutOption,
  linkUrlField,
  moreAction,
  morePanel,
  moreButton,
  moveCursorToLineStart,
  NARROW_VIEWPORT,
  narrowNotice,
  openBlocks,
  openEmail,
  openAddPanel,
  palette,
  addPanel,
  pretendPlatform,
  checkButton,
  checkPanel,
  inboxFrame,
  openCheck,
  redoByKey,
  selectedText,
  selectionBar,
  selectNothing,
  selectRow,
  settle,
  setValue,
  stopClock,
  structure,
  test,
  textOf,
  tooltip,
  undo,
  undoButton,
  undoByKey,
  violations,
  watchPrevented,
} from "./helpers.js";

/**
 * The controls that can't show focus, of those that can take it now. A group
 * with any tabindex is one, as the floating toolbar takes focus from the editor.
 */
const controlsWithoutRing = (page: Page) =>
  canvas(page).evaluate((host) => {
    const root = host.shadowRoot as ShadowRoot;
    // Focus on a Mode chooses it, so only the chosen one, as the others share
    // its look.
    const controls = root.querySelectorAll<HTMLElement>(
      'button:not(:disabled, [role="tab"][aria-controls^="mode-panel"][aria-selected="false"]), input, select, [role="group"][tabindex], [role="textbox"]'
    );
    return [...controls]
      .filter((control) => {
        control.focus();
        // A field in the Selection bar draws its ring around its icon and its
        // name too, on the label it's in.
        const label = control.closest("label");
        const ringed =
          label && getComputedStyle(label).outlineStyle === "solid"
            ? label
            : control;
        const { outlineStyle, outlineWidth } = getComputedStyle(ringed);
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
 * How far below the Selection bar a Block starts, and so negative if it's cut
 * off there, under the bar that sticks over the email.
 */
const gapBelowTop = async (page: Page, text: string) => {
  const block = await boxOf(blockWith(page, text));
  const bar = await boxOf(selectionBar(page));
  return block.y - Math.max(bar.y + bar.height, 0);
};

/** Where the Block "L" is in the only Column of the only Row. */
const positionOfL = async (page: Page) => {
  const [row] = await structure(page);
  return row?.[0]?.indexOf("L");
};

/** Counts every change a screen reader could be told about in the live region. */
const countAnnouncements = (page: Page) =>
  canvas(page).evaluate((host) => {
    // The editor's own live region, a child of its shadow root.
    const status = [...(host.shadowRoot?.children ?? [])].find(
      (element) => element.getAttribute("role") === "status"
    ) as Element;
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
  test("Tab reaches a Block and selects it, then its text, then the Selection bar, then leaves the email", async ({
    page,
  }) => {
    await openEmail(page, [[["First"], ["Second"]]]);
    await expect(deleteBlock(page)).toHaveCount(0);

    // The Rows list's last control, before the email.
    await canvas(page).getByRole("button", { name: "Add a Row" }).focus();
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

    // The Selection bar is one stop, at its chip.
    await page.keyboard.press("Tab");
    await expect(barButton(page, "Row 1 / Text")).toBeFocused();

    // The email is one stop: Tab passes the other Blocks, and the bar still
    // shows this one.
    await page.keyboard.press("Tab");
    await expect(checkButton(page)).toBeFocused();
    await expect(blockWith(page, "First")).toHaveAttribute(
      "aria-current",
      "true"
    );

    // And back, to the selected Block's text.
    await page.keyboard.press("Shift+Tab");
    await expect(barButton(page, "Row 1 / Text")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(textOf(page, "First")).toBeFocused();
  });

  test("an arrow key selects the next Block that way", async ({ page }) => {
    await openEmail(page, [[["A", "B"]]]);
    await blockWith(page, "A").focus();

    await page.keyboard.press("ArrowDown");

    await expect(blockWith(page, "B")).toBeFocused();
    await expect(blockWith(page, "B")).toHaveAttribute("aria-current", "true");
    await expect(blockWith(page, "A")).not.toHaveAttribute("aria-current");
  });
});

/**
 * Opens the narrow notice, as on Windows and Linux, where Alt+← goes back a
 * page. WebKit is only on Apple devices, so this pretends to be on Windows.
 */
const openNarrowNotice = async (page: Page) => {
  await pretendPlatform(page, "Win32");
  await page.setViewportSize(NARROW_VIEWPORT);
  await page.goto("/");
};

test.describe("moving a Block with Alt+Arrow keys", () => {
  test("moves within a Column, keeping focus for the next press", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B", "C"]]]);
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

  test("each move is one undo step, and focus stays on the Block", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]]]);
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

  test("Alt+← doesn't go back a page from an empty Column or the Add panel", async ({
    page,
  }) => {
    // As on Windows and Linux, where Alt+← goes back a page.
    await pretendPlatform(page, "Win32");
    await openEmail(page, [[["A"], []]]);
    await openAddPanel(page);
    const places = [
      page.getByRole("button", {
        name: "Add a Block, or drop one here, in Row 1, Column 2",
      }),
      palette(page, "Text"),
      addPanel(page).getByRole("textbox", { name: "Search Blocks and Rows" }),
    ];

    for (const place of places) {
      await place.focus();
      // Listening before the key is pressed, so the press can't come first,
      // and anew for each place, so it reads its own press.
      const leftPrevented = await watchPrevented(page, "ArrowLeft");
      await page.keyboard.press("Alt+ArrowLeft");
      await expect.poll(leftPrevented).toBe(true);
      await expect(place).toBeFocused();
    }
  });

  test("Alt+← doesn't go back a page from the narrow notice", async ({
    page,
  }) => {
    await openNarrowNotice(page);
    const leftPrevented = await watchPrevented(page, "ArrowLeft");
    await narrowNotice(page).focus();

    await page.keyboard.press("Alt+ArrowLeft");

    await expect.poll(leftPrevented).toBe(true);
  });

  test("Alt+← doesn't go back a page from the email in Check", async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName === "webkit",
      "WebKit runs no listener in a document whose scripts are off"
    );
    await pretendPlatform(page, "Win32");
    await page.goto("/");
    await openCheck(page);
    const email = inboxFrame(page);
    await expect(email.contentFrame().locator("body")).toContainText("Hello");
    // The email's keys don't reach the host page, so this listens in it.
    await email.evaluate((frame) => {
      (frame as HTMLIFrameElement).contentDocument?.addEventListener(
        "keydown",
        (event) => {
          Object.assign(window, { emailPrevented: event.defaultPrevented });
        }
      );
    });
    await email.contentFrame().locator("body").click();

    await page.keyboard.press("Alt+ArrowLeft");
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "emailPrevented")))
      .toBe(true);
  });
});

test.describe("moving a Block with the Selection bar's buttons", () => {
  test("from the keyboard, focus stays on the button for the next press", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B", "C"], []]]);
    await blockWith(page, "A").focus();
    await blockTool(page, "Move Block down").focus();

    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["B", "A", "C"], []]]);
    await expect(blockTool(page, "Move Block down")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["B", "C", "A"], []]]);
    await expect(blockTool(page, "Move Block down")).toBeFocused();

    // Into the next Column and back, from More.
    const right = await moreAction(page, "Move to the next Column");
    await right.focus();
    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["B", "C"], ["A"]]]);
    await expect(right).toBeFocused();

    const left = await moreAction(page, "Move to the Column before");
    await left.focus();
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
    await openEmail(page, [[["A", "B"]]]);
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
    await openEmail(page, [[["A"]]]);
    const expectChanges = await changesSince(page);
    await blockWith(page, "A").focus();

    await page.keyboard.press("Alt+ArrowLeft");
    await expect(announcement(page)).toHaveText("The Block can't move left.");

    await page.keyboard.press("Alt+ArrowUp");
    await expect(announcement(page)).toHaveText("The Block can't move up.");
    await expect(structure(page)).resolves.toEqual([[["A"]]]);
    await expectChanges(0);
  });

  test("the same words twice are still two announcements", async ({ page }) => {
    await openEmail(page, [[["A", "B", "C"]]]);
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
    await openEmail(page, [[["A", "B"], ["C"]]]);
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
    await openEmail(page, [[["A", "B"]]]);
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
    await openEmail(page, [[["A"], ["B"], ["C"]]]);
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
    await openEmail(page, [[["A", "B"]]]);
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
    await pretendPlatform(page, "Win32");
    await openEmail(page, [[["one two", "B"], ["C"]]]);
    await textOf(page, "one two").click();
    // Listening before the key is pressed, so the press can't come first.
    const leftPrevented = await watchPrevented(page, "ArrowLeft");

    await page.keyboard.press("Alt+ArrowDown");
    await page.keyboard.press("Alt+ArrowUp");
    await page.keyboard.press("Alt+ArrowLeft");

    await expect(structure(page)).resolves.toEqual([[["one two", "B"], ["C"]]]);
    await expect(textOf(page, "one two")).toBeFocused();
    await expect.poll(leftPrevented).toBe(true);

    await moveCursorToLineStart(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("x");
    await expect(structure(page)).resolves.toEqual([
      [["oxne two", "B"], ["C"]],
    ]);
    await expect(textOf(page, "oxne two")).toBeFocused();
  });

  test("text typed through an input method reaches the email", async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Only Chromium lets a test drive an input method"
    );
    await openEmail(page, [[["A"]]]);
    await textOf(page, "A").click();
    await page.keyboard.press("End");
    const session = await page.context().newCDPSession(page);

    for (const text of ["に", "にほ"]) {
      await session.send("Input.imeSetComposition", {
        selectionEnd: text.length,
        selectionStart: text.length,
        text,
      });
    }
    await session.send("Input.insertText", { text: "日本" });

    // ProseMirror reads the text a moment after the composition ends.
    await expect.poll(() => structure(page)).toEqual([[["A日本"]]]);
    await expect(textOf(page, "A日本")).toBeFocused();
  });

  test("Escape returns to the Block, and Enter to where the cursor was", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"]]]);
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
    await openEmail(page, [[["A"]]]);
    const escapes = await countHostEscapes(page);
    await textOf(page, "A").click();

    await page.keyboard.press("Escape");
    await expect(blockWith(page, "A")).toBeFocused();
    await expect(escapes()).resolves.toBe(0);

    await page.keyboard.press("Escape");
    await expect(escapes()).resolves.toBe(1);
  });

  test("Ctrl/⌘+Z that an input method handled doesn't undo", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await textOf(page, "A").click();
    await page.keyboard.type("B");
    await expect(structure(page)).resolves.toEqual([[["AB"]]]);

    // The shortcut on this platform, ⌘ on Apple devices and Ctrl elsewhere, as
    // WebKit can send it after ending a composition.
    await textOf(page, "AB").evaluate((text) => {
      const apple = /Mac|iPhone|iPod|iPad/u.test(navigator.platform);
      text.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          code: "KeyZ",
          composed: true,
          ctrlKey: !apple,
          key: "z",
          keyCode: 229,
          metaKey: apple,
        })
      );
    });
    await settle(page);

    await expect(structure(page)).resolves.toEqual([[["AB"]]]);
  });

  test("holding Enter on a Block goes to its text and adds nothing", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
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
    await openEmail(page, [[["A"]]]);
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
    await openEmail(page, [[["A", "B"]]]);
    await textOf(page, "A").click();
    await page.keyboard.press("Escape");
    await expect(blockWith(page, "A")).toBeFocused();

    await page.keyboard.type("x");

    await expect(structure(page)).resolves.toEqual([[["A", "B"]]]);
  });
});

test.describe("Enter on a Block in the Add panel", () => {
  test("inserts after the selected Block, in its Column, as one undo step", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"], ["C"]]]);
    await blockWith(page, "A").focus();
    await openAddPanel(page);
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
    await openEmail(page, [[["A"]]]);
    await openAddPanel(page);
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
    await openEmail(page, [...above, [["A"], ["B"]]]);
    await openAddPanel(page);
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
    await openEmail(page, [[["A"], ["B", "C"]]]);

    await expect(blockWith(page, "C")).toHaveAccessibleName(
      "Text Block, Row 1, Column 2, position 2 of 2"
    );
    await expect(blockWith(page, "C")).toHaveAccessibleDescription(
      /Enter to edit.*ArrowUp.*Alt\+ArrowUp/u
    );

    await blockWith(page, "C").focus();
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(blockWith(page, "C")).toHaveAccessibleName(
      "Text Block, Row 1, Column 1, position 2 of 2"
    );
  });

  test("an empty Column is one Tab stop, a button named for where it is", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"], []]]);
    await textOf(page, "B").click();

    await page.keyboard.press("Tab");
    await expect(
      canvas(page).getByRole("button", {
        exact: true,
        name: "Add a Block, or drop one here, in Row 2, Column 2",
      })
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(barButton(page, "Row 2 / Text")).toBeFocused();
  });

  test("every control shows where focus is", async ({ page }) => {
    await openEmail(page, [[["A"], []]]);
    await textOf(page, "A").click();
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    await expect(linkUrlField(page)).toBeFocused();
    // Browsers only show focus from a script after keyboard use.
    await page.keyboard.press("Tab");

    await expect(controlsWithoutRing(page)).resolves.toEqual([]);

    // The Block's More, the email's settings, and then the Row's, all from
    // the keyboard, as a press with the pointer turns the rings off.
    await moreButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(morePanel(page)).toBeVisible();
    await expect(controlsWithoutRing(page)).resolves.toEqual([]);

    // The Block's Column, from the chip's menu, then the email, its last.
    await barButton(page, "Row 1 / Text").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(selectionBar(page)).toHaveAccessibleName("Column 1 settings");
    await expect(controlsWithoutRing(page)).resolves.toEqual([]);

    await barButton(page, "Row 1 / Text").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await expect(selectionBar(page)).toHaveAccessibleName("Email settings");
    await expect(controlsWithoutRing(page)).resolves.toEqual([]);

    // Past its text and the empty Column's toolbar, to the bar's chip.
    await blockWith(page, "A").focus();
    for (const _ of [1, 2, 3]) {
      await page.keyboard.press("Tab");
    }
    await expect(barButton(page, "Row 1 / Text")).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(selectionBar(page)).toHaveAccessibleName("Row 1 settings");
    await expect(controlsWithoutRing(page)).resolves.toEqual([]);
  });

  test("Check's fix buttons and switch show where focus is", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await canvas(page).evaluate((element) => {
      Object.assign(element, { mergeTags: [{ name: "a", sample: "b" }] });
    });
    // From the keyboard, as only focus from the keys shows its ring.
    await canvas(page).getByRole("tab", { name: "Edit" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(checkPanel(page)).toContainText("2 things to fix.");

    await expect(controlsWithoutRing(page)).resolves.toEqual([]);
  });

  test("the Block with focus looks different from one only selected", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
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

  test("a selected Block stays in view below the Selection bar", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 600, width: 1000 });
    await openEmail(page, [[TWELVE]]);
    await blockWith(page, "L").focus();

    for (const text of ["K", "J", "I", "H", "G", "F", "E", "D", "C", "B"]) {
      await page.keyboard.press("ArrowUp");
      await expect(blockWith(page, text)).toBeFocused();
      await expect
        .poll(() => gapBelowTop(page, text))
        .toBeGreaterThanOrEqual(0);
    }
  });

  test("a Block moved from the keyboard, or by redo, stays in view below the Selection bar", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 500, width: 1000 });
    await openEmail(page, [[TWELVE]]);
    await blockWith(page, "L").focus();

    for (const expected of [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]) {
      await page.keyboard.press("Alt+ArrowUp");
      await expect.poll(() => positionOfL(page)).toBe(expected);
      await expect.poll(() => gapBelowTop(page, "L")).toBeGreaterThanOrEqual(0);
    }
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

test.describe("automated accessibility checks", () => {
  test("pass with Columns, empty Columns, and no Block or one moved selected", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"], []], [["C"]]]);
    expect(await violations(page)).toEqual([]);

    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(announcement(page)).not.toBeEmpty();

    expect(await violations(page)).toEqual([]);
  });

  test("pass with the link field showing its error", async ({ page }) => {
    await openEmail(page, [[["A"]]]);
    await textOf(page, "A").click();
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    await linkUrlField(page).fill("example.com");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });

  test("pass with a Row, the Add panel, a Heading and the narrow notice showing", async ({
    page,
  }) => {
    await openBlocks(page, ["heading", "text"]);

    await selectRow(page, 1);
    await expect(layoutOption(page, "100")).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await openAddPanel(page);
    expect(await violations(page)).toEqual([]);

    await canvas(page).getByRole("group", { name: "Heading Block" }).focus();
    await expect(
      selectionBar(page).getByRole("group", { name: "Level" })
    ).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await page.setViewportSize(NARROW_VIEWPORT);
    await expect(narrowNotice(page)).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("pass with a tooltip showing", async ({ page }) => {
    await openEmail(page, [[["A"]]]);
    await blockWith(page, "A").focus();
    await undoButton(page).hover();
    await expect(tooltip(page)).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });

  test("pass in the dark theme, in each surface and state the light theme's checks cover", async ({
    page,
  }) => {
    // About a dozen scans in one test, which ran past the timeout in CI with
    // four workers sharing the runner.
    test.slow();
    // With an empty Column, whose placeholder is drawn on the email.
    await openEmail(page, [[["A", "B"], []], [["C"]]]);
    await canvas(page).evaluate((element) => {
      element.setAttribute("theme", "dark");
    });
    await expect(canvas(page).getByTestId("workspace")).toHaveCSS(
      "background-color",
      "rgb(16, 17, 19)"
    );
    expect(await violations(page)).toEqual([]);

    await addBlock(page, "Heading");
    await canvas(page).getByRole("group", { name: "Heading Block" }).focus();
    await expect(
      selectionBar(page).getByRole("group", { name: "Level" })
    ).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await blockWith(page, "A").focus();
    await undoButton(page).hover();
    await expect(tooltip(page)).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await textOf(page, "A").click();
    // ProseMirror learns of the cursor a moment after the click, and Ctrl/⌘+B
    // before then sometimes left Bold unpressed.
    await settle(page);
    await page.keyboard.press("ControlOrMeta+b");
    const bold = canvas(page).getByRole("button", {
      exact: true,
      name: "Bold",
    });
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    expect(await violations(page)).toEqual([]);

    await page.getByRole("button", { exact: true, name: "Link" }).click();
    await linkUrlField(page).fill("example.com");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await canvas(page).evaluate((element) => {
      (element as MailQuilt).mergeTags = [
        { label: "First name", name: "first_name" },
        { name: "company" },
      ];
    });
    await textOf(page, "A").click();
    await page.keyboard.type("{{");
    await page.keyboard.press("ArrowDown");
    await expect(
      canvas(page).getByRole("option", { name: "company" })
    ).toHaveAttribute("aria-selected", "true");
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");

    await selectRow(page, 2);
    await expect(layoutOption(page, "100")).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await openAddPanel(page);
    expect(await violations(page)).toEqual([]);
    await canvas(page)
      .getByRole("button", {
        name: "Add a Block, or drop one here, in Row 1, Column 2",
      })
      .click();
    await expect(canvas(page).getByTestId("add-picker")).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");

    // The email's settings, with a field showing a value it refused.
    await selectNothing(page);
    const language = canvas(page).getByLabel("Language", { exact: true });
    await language.fill("English");
    await language.press("Enter");
    await expect(page.getByRole("alert")).toBeVisible();
    expect(await violations(page)).toEqual([]);

    for (const name of ["Style", "Edit"]) {
      await canvas(page).getByRole("tab", { exact: true, name }).click();
      expect(await violations(page)).toEqual([]);
    }

    await page.setViewportSize(NARROW_VIEWPORT);
    await expect(narrowNotice(page)).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("pass in Check with nothing to fix", async ({ page }) => {
    await openEmail(page, [[["A"]]]);
    await canvas(page).evaluate((element) => {
      const quilt = element as MailQuilt;
      const email = structuredClone(quilt.value);
      if (email) {
        email.settings = { ...email.settings, language: "en", preheader: "Hi" };
        quilt.value = email;
      }
    });
    await openCheck(page);
    await expect(checkPanel(page)).toContainText("Ready to export");

    expect(
      await violations(page, "mail-quilt", { excludeIframe: true })
    ).toEqual([]);
  });
});
