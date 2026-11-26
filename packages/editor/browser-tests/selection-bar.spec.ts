import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  announcement,
  barButton,
  blockGroup,
  blockProps,
  blockWith,
  boxOf,
  canvas,
  emailWith,
  field,
  morePanel,
  moreAction,
  moreButton,
  openBlocks,
  openEmail,
  openMore,
  selectionBar,
  selectRow,
  setValue,
  structure,
  test,
  textOf,
  tooltip,
  violations,
} from "./helpers.js";

/** The editor this wide, with nothing of the test page around it. */
const editorOf = async (page: Page, width: number) => {
  await page.addStyleTag({
    content: `main { padding: 0 !important } mail-quilt { width: ${width}px !important }`,
  });
};

/** Wide enough for More to dock beside the email and the side panel. */
const WIDE = 1400;

/**
 * Keeps what the editor puts on the clipboard. The browser's copy, which
 * More's Copy and Cut start, fires its event with data of the test's own
 * rather than the system's clipboard, which tests running at once share.
 */
const keepCopies = (page: Page) =>
  page.evaluate(() => {
    const copied: Record<string, string> = {};
    Object.assign(window, { copied });
    const { setData: original } = DataTransfer.prototype;
    DataTransfer.prototype.setData = function setData(format, data) {
      copied[format] = data;
      original.call(this, format, data);
    };
    const execCommand = document.execCommand.bind(document);
    document.execCommand = (command: string, ...rest) => {
      if (command !== "copy") {
        return execCommand(command, ...rest);
      }
      // Not a ClipboardEvent, whose constructor ignores this data in Firefox.
      const event = new Event(command, {
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      Object.defineProperty(event, "clipboardData", {
        value: new DataTransfer(),
      });
      return document.dispatchEvent(event);
    };
  });

const copied = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { copied: Record<string, string> }).copied
  );

/** Gives the clipboard `html`, as the browser would once a person allows it. */
const clipboardHolds = (page: Page, html: string | undefined) =>
  page.evaluate((held) => {
    Object.defineProperty(navigator.clipboard, "read", {
      configurable: true,
      value: () =>
        held === undefined
          ? Promise.reject(new DOMException("Denied", "NotAllowedError"))
          : Promise.resolve([
              {
                getType: (type: string) =>
                  Promise.resolve(
                    new Blob([type === "text/html" ? held : "x"], { type })
                  ),
                types: ["text/html", "text/plain"],
              },
            ]),
    });
  }, html);

test.describe("the Selection bar", () => {
  test("is one Tab stop, and the arrow keys, Home and End go along its controls", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await blockGroup(page, "Button").focus();

    await page.keyboard.press("Tab");
    const chip = barButton(page, "Row 1 / Button");
    await expect(chip).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(
      canvas(page).getByLabel("Link", { exact: true })
    ).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(chip).toBeFocused();
    await page.keyboard.press("End");
    await expect(moreButton(page)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(chip).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(moreButton(page)).toBeFocused();

    // Shift+Tab leaves from its one stop, rather than going back to it.
    await page.keyboard.press("Shift+Tab");
    await expect(chip).not.toBeFocused();
    await expect(blockGroup(page, "Button")).toBeFocused();
  });

  test("in a field, ← and → move the cursor, and go on from either end of its text", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await blockGroup(page, "Button").focus();
    const link = canvas(page).getByLabel("Link", { exact: true });
    await link.fill("{{u}}");
    await link.press("Enter");

    // From the chip, the cursor starts at the text's start, and goes along
    // its five characters before the next press goes on.
    await barButton(page, "Row 1 / Button").focus();
    await page.keyboard.press("ArrowRight");
    for (let step = 0; step < 5; step += 1) {
      await expect(link).toBeFocused();
      await page.keyboard.press("ArrowRight");
    }
    await expect(link).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(
      selectionBar(page).getByRole("button", { name: /^Fill:/u })
    ).toBeFocused();
    // Back in from the other side, at its end.
    await page.keyboard.press("ArrowLeft");
    for (let step = 0; step < 5; step += 1) {
      await expect(link).toBeFocused();
      await page.keyboard.press("ArrowLeft");
    }
    await page.keyboard.press("ArrowLeft");
    await expect(barButton(page, "Row 1 / Button")).toBeFocused();
  });

  test("from one field into the next, the cursor is at the start, and a number is selected to type over", async ({
    page,
  }) => {
    // With nothing selected, the bar has the email's settings.
    await openEmail(page, [[["A"]]]);
    const preheader = field(page, "Preheader");
    const language = field(page, "Language");
    await language.fill("en");
    await language.press("Enter");

    await preheader.focus();
    await page.keyboard.press("ArrowRight");
    await expect(language).toBeFocused();
    await page.keyboard.type("x");
    await expect(language).toHaveValue("xen");

    // With nothing typed, as the arrow keys only move the cursor otherwise.
    await page.keyboard.press("Escape");
    await expect(language).toHaveValue("en");
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("7");
    await expect(field(page, "Width (px)")).toHaveValue("7");
  });

  test("in a Row's popover field, Delete and Backspace edit its text, and don't delete the Row", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"]]]);
    await selectRow(page, 1);
    await barButton(page, "Padding").click();
    const padding = canvas(page).getByLabel("Top padding (px)");
    await expect(padding).toBeFocused();

    await page.keyboard.type("12");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Delete");

    await expect(structure(page)).resolves.toEqual([[["A"]], [["B"]]]);
    await expect(padding).toBeFocused();
  });

  test("Escape goes back to the Block, once it has closed the focused control's tooltip", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await blockGroup(page, "Button").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("End");
    await expect(tooltip(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(moreButton(page)).toBeFocused();
    await page.keyboard.press("Escape");

    await expect(blockGroup(page, "Button")).toBeFocused();
  });
});

test.describe("a Row of empty Columns", () => {
  test("is selected by focus in one of its Columns' toolbars, so Tab reaches its settings", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [[], []]]);
    await blockWith(page, "A").focus();

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(
      canvas(page)
        .getByRole("toolbar", { name: "Add a Block to Row 2, Column 1" })
        .getByRole("button", { name: "Add Text Block here" })
    ).toBeFocused();
    await expect(selectionBar(page)).toHaveAccessibleName("Row 2 settings");

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(barButton(page, "Row 2")).toBeFocused();
  });
});

test.describe("a popover from the Selection bar", () => {
  test("opens with focus in its field, and Escape closes it back on its button", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await blockGroup(page, "Button").focus();
    const fill = selectionBar(page).getByRole("button", {
      name: /^Fill:/u,
    });
    await fill.focus();

    await page.keyboard.press("Enter");

    const popover = canvas(page).getByRole("dialog", {
      name: "Background color",
    });
    await expect(fill).toHaveAttribute("aria-expanded", "true");
    const hex = popover.getByLabel("Background color", { exact: true });
    await expect(hex).toBeFocused();
    await hex.fill("#ff0000");
    await hex.press("Enter");
    expect(await blockProps(page)).toMatchObject({
      backgroundColor: "#ff0000",
    });

    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(fill).toBeFocused();
  });

  test("closes with a press outside it, and when the selection changes", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"]]]);
    await blockWith(page, "A").focus();
    await selectionBar(page)
      .getByRole("button", { name: /^Color:/u })
      .click();
    await expect(canvas(page).getByRole("dialog")).toBeVisible();

    await textOf(page, "B").click();

    await expect(canvas(page).getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("the Selection bar's chip", () => {
  test("has a menu that selects the Block's Row, or nothing, for the email's settings", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"]]]);
    await blockWith(page, "B").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const chip = barButton(page, "Row 2 / Text");
    await expect(chip).toBeFocused();

    await page.keyboard.press("Enter");
    const menu = canvas(page).getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Row 2" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(chip).toBeFocused();

    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(selectionBar(page)).toHaveAccessibleName("Row 2 settings");
    await expect(barButton(page, "Row 2")).toBeFocused();

    await page.keyboard.press("Enter");
    await canvas(page).getByRole("menuitem", { name: "Email" }).press("Enter");
    await expect(selectionBar(page)).toHaveAccessibleName("Email settings");
    await expect(
      canvas(page).getByLabel("Preheader", { exact: true })
    ).toBeFocused();
  });
});

test.describe("More", () => {
  test("docks beside the email where it fits, and floats over the Canvas where it doesn't", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await editorOf(page, WIDE);
    await blockGroup(page, "Text").focus();

    await moreButton(page).click();

    // Beside the email and before the side panel, once the editor has laid
    // itself out at its new width. A poll that throws stops, so a box not
    // there yet, as More moves, is a "not yet".
    await expect
      .poll(async () => {
        const email = await canvas(page).getByTestId("email").boundingBox();
        const docked = await morePanel(page).boundingBox();
        const side = await canvas(page).getByTestId("side-panel").boundingBox();
        return Boolean(
          email &&
          docked &&
          side &&
          docked.x >= email.x + email.width &&
          docked.x + docked.width <= side.x
        );
      })
      .toBe(true);

    await editorOf(page, 1100);
    const workspace = await boxOf(canvas(page).getByTestId("workspace"));
    await expect
      .poll(async () => {
        const floating = await morePanel(page).boundingBox();
        return Boolean(
          floating &&
          floating.x + floating.width <= workspace.x + workspace.width
        );
      })
      .toBe(true);
  });

  test("over the email, closes when a Block takes focus from the keyboard, so it never hides it", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"], ["C"], ["D"]]]);
    await editorOf(page, 1000);
    await blockWith(page, "A").focus();
    await moreButton(page).click();
    await expect(morePanel(page)).toBeVisible();

    // A click keeps it open, as the person sees where it went.
    await textOf(page, "B").click();
    await expect(morePanel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    await expect(blockWith(page, "D")).toBeFocused();
    await expect(morePanel(page)).toHaveCount(0);
  });

  test("from the keyboard takes focus to its first control, and Escape goes back to More", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await blockGroup(page, "Button").focus();
    await moreButton(page).focus();

    await page.keyboard.press("Enter");

    await expect(
      morePanel(page).getByLabel("Label", { exact: true })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(morePanel(page)).toHaveCount(0);
    await expect(moreButton(page)).toBeFocused();
  });

  test("shows whatever is selected while it's open, and the email's settings with nothing selected", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await blockGroup(page, "Button").focus();
    await moreButton(page).click();
    await expect(morePanel(page).getByLabel("Label")).toBeVisible();

    await barButton(page, "Row 1 / Button").click();
    await canvas(page).getByRole("menuitem", { name: "Email" }).click();

    await expect(
      morePanel(page).getByRole("heading", { name: "Email" })
    ).toBeVisible();
    await expect(
      morePanel(page).getByLabel("Font", { exact: true })
    ).toBeVisible();
  });

  test("Copy and Cut put the Block on the clipboard, as Ctrl/⌘+C and X do", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"]]]);
    await keepCopies(page);
    await blockWith(page, "A").focus();

    const copy = await moreAction(page, "Copy");
    await copy.click();
    const copies = await copied(page);
    expect(copies["text/plain"]).toBe("A");
    await expect(announcement(page)).toHaveText(
      "Block copied, Row 1, Column 1, position 1 of 2."
    );

    const cut = await moreAction(page, "Cut");
    await cut.click();
    await expect(structure(page)).resolves.toEqual([[["B"]]]);
    await expect(announcement(page)).toHaveText(
      "Block cut, Row 1, Column 1, position 1 of 2."
    );
  });

  test("Paste below pastes what's on the clipboard after the Block, or says why it can't", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"]]]);
    await blockWith(page, "A").focus();

    await clipboardHolds(page, "<p>Pasted</p>");
    const paste = await moreAction(page, "Paste below");
    await paste.click();
    await expect.poll(() => structure(page)).toEqual([[["A", "Pasted", "B"]]]);

    await clipboardHolds(page, undefined);
    await paste.click();
    await expect(announcement(page)).toHaveText(
      "Can't paste. The browser didn't let the editor read the clipboard. Paste with the keyboard or the browser's Edit menu instead."
    );
  });

  test("Paste below drops what it read when the host gave another email meanwhile", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await blockWith(page, "A").focus();
    // The clipboard is read once the test lets it be, as a person allows it.
    await page.evaluate(() => {
      Object.defineProperty(navigator.clipboard, "read", {
        configurable: true,
        value: () =>
          // oxlint-disable-next-line promise/avoid-new -- The test settles the read.
          new Promise((resolve) => {
            Object.assign(window, {
              allowRead: () =>
                resolve([
                  {
                    // Says when the editor has read it, after which the
                    // paste goes on without waiting for anything.
                    getType: () =>
                      Promise.resolve({
                        text: () => {
                          Object.assign(window, { readDone: true });
                          return Promise.resolve("<p>Pasted</p>");
                        },
                      }),
                    types: ["text/html"],
                  },
                ]),
            });
          }),
      });
    });
    const paste = await moreAction(page, "Paste below");
    await paste.click();

    await setValue(page, emailWith([[["Other"]]]));
    await page.evaluate(() =>
      (window as unknown as { allowRead: () => void }).allowRead()
    );
    await page.waitForFunction(
      () => (window as unknown as { readDone?: boolean }).readDone === true
    );
    // Once what's left of the paste has run.
    await page.evaluate(
      () =>
        // oxlint-disable-next-line promise/avoid-new -- A task after the paste's.
        new Promise((resolve) => {
          setTimeout(resolve, 0);
        })
    );

    await expect(blockWith(page, "Other")).toBeVisible();
    expect(await structure(page)).toEqual([[["Other"]]]);
  });

  test("moves the Block into the next Column, and says why it can't in the only one", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"], []]]);
    await blockWith(page, "A").focus();

    const right = await moreAction(page, "Move to the next Column");
    await expect(right).toHaveAttribute("aria-disabled", "true");
    await right.hover();
    await expect(tooltip(page)).toHaveText("It's in the only Column");
    // Off, though still reachable, so a press does nothing.
    await right.click({ force: true });
    await expect(structure(page)).resolves.toEqual([[["A"]], [["B"], []]]);

    await blockWith(page, "B").focus();
    await right.click();
    await expect(structure(page)).resolves.toEqual([[["A"]], [[], ["B"]]]);
  });

  test("where the bar's actions go into More with focus on one, focus goes to More's button", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]], [["C"]]]);
    await editorOf(page, 1800);
    await selectRow(page, 1);
    await barButton(page, "Duplicate Row").focus();

    await editorOf(page, 645);

    await expect(barButton(page, "Duplicate Row")).toBeHidden();
    await expect(moreButton(page)).toBeFocused();
  });

  test("has the bar's own actions where the bar is short of room, and only there", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]], [["C"]]]);
    // Room for the bar beside the side panel and a docked More.
    await editorOf(page, 1800);
    await selectRow(page, 1);
    await expect(barButton(page, "Move Row down")).toBeVisible();
    const more = await openMore(page);
    await expect(
      more.getByRole("button", { name: "Move Row down" })
    ).toBeHidden();

    // A Row of two Columns has the widest bar, too wide at the least width
    // the editor works at.
    await editorOf(page, 645);

    await expect(barButton(page, "Move Row down")).toBeHidden();
    const down = await moreAction(page, "Move Row down");
    await down.click();
    await expect(structure(page)).resolves.toEqual([[["C"]], [["A"], ["B"]]]);

    // At the end, it stays where focus is, off, and says why.
    await down.focus();
    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["C"]], [["A"], ["B"]]]);
    await expect(down).toBeFocused();
    await expect(down).toHaveAttribute("aria-disabled", "true");
    // From elsewhere, as the pointer is still where the click left it.
    await page.mouse.move(0, 0);
    await down.hover();
    await expect(tooltip(page)).toHaveText("It's the last Row");
  });
});

test.describe("automated accessibility checks of the Selection bar", () => {
  // So the checks read what's opened as it ends, not as it fades in.
  test.use({ reducedMotion: "reduce" });

  test("pass with a popover, the chip's menu and More open", async ({
    page,
  }) => {
    await openBlocks(page, ["button", "social"]);
    await editorOf(page, WIDE);
    await blockGroup(page, "Button").focus();
    await selectionBar(page)
      .getByRole("button", { name: /^Fill:/u })
      .click();
    expect(await violations(page)).toEqual([]);

    await barButton(page, "Row 1 / Button").click();
    await expect(canvas(page).getByRole("menu")).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await page.keyboard.press("Escape");
    await moreButton(page).click();
    await expect(morePanel(page)).toBeVisible();
    expect(await violations(page)).toEqual([]);

    // Floating, over the Canvas.
    await editorOf(page, 1100);
    await expect(morePanel(page)).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
