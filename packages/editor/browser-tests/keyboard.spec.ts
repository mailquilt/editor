import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  canvas,
  emailWith,
  setValue,
  structure,
  textBlock,
} from "./helpers.js";

/** A Block itself, as opposed to the text inside it. */
const blockWith = (page: Page, text: string) =>
  canvas(page)
    .getByRole("group", { name: "Text Block" })
    .filter({ hasText: text });

const deleteBlock = (page: Page) =>
  page.getByRole("button", { name: "Delete Block" });

const open = async (page: Page, rows: string[][][]) => {
  await page.goto("/");
  await setValue(page, emailWith(rows));
  await expect(textBlock(page).first()).toBeVisible();
};

const textOf = (page: Page, text: string) =>
  blockWith(page, text).getByRole("textbox", { name: "Text Block" });

const announcement = (page: Page) => canvas(page).getByRole("status");

const paletteText = (page: Page) =>
  page
    .getByRole("group", { name: "Add content" })
    .getByRole("button", { name: "Text" });

const newBlockText = (page: Page) =>
  canvas(page).locator('[aria-current="true"]').getByRole("textbox");

/** The controls that can't show focus, of those that can take it now. */
const controlsWithoutRing = (page: Page) =>
  canvas(page).evaluate((host) => {
    const root = host.shadowRoot as ShadowRoot;
    const controls = root.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input, .block, .ProseMirror"
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
 * Only the editor, because the test host's CSS is unfriendly on purpose. Legacy
 * mode, because the default mode opens a new page to finish, which hangs in
 * Chromium and WebKit while the Preview's sandboxed iframe is showing.
 */
const violations = async (page: Page) => {
  const { violations: found } = await new AxeBuilder({ page })
    .include("mail-quilt")
    .exclude("iframe")
    .setLegacyMode()
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return found.map(({ id, nodes }) => ({
    id,
    targets: nodes.map(({ target }) => target),
  }));
};

test.describe("selecting a Block", () => {
  test("Tab reaches a Block and selects it, and then its text", async ({
    page,
  }) => {
    await open(page, [[["First"], ["Second"]]]);
    await expect(deleteBlock(page)).toBeDisabled();

    await canvas(page).getByRole("button", { name: "Delete Row" }).focus();
    await page.keyboard.press("Tab");

    await expect(blockWith(page, "First")).toBeFocused();
    await expect(blockWith(page, "First")).toHaveAttribute(
      "aria-current",
      "true"
    );
    await expect(deleteBlock(page)).toBeEnabled();
    await expect(structure(page)).resolves.toEqual([[["First"], ["Second"]]]);

    await page.keyboard.press("Tab");
    await expect(
      blockWith(page, "First").getByRole("textbox", { name: "Text Block" })
    ).toBeFocused();

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

  test("selecting a Block doesn't change the email or fire a change", async ({
    page,
  }) => {
    await open(page, [[["A", "B"]]]);
    const before = await page.getByTestId("change-count").textContent();
    await blockWith(page, "A").focus();

    await page.keyboard.press("ArrowDown");

    await expect(blockWith(page, "B")).toBeFocused();
    await expect(structure(page)).resolves.toEqual([[["A", "B"]]]);
    await expect(page.getByTestId("change-count")).toHaveText(before as string);
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

  test("stops at the edge of a Row", async ({ page }) => {
    await open(page, [[["A"], ["B"]]]);
    await blockWith(page, "A").focus();
    const before = await page.getByTestId("change-count").textContent();

    await page.keyboard.press("Alt+ArrowLeft");
    await blockWith(page, "B").focus();
    await page.keyboard.press("Alt+ArrowRight");

    await expect(structure(page)).resolves.toEqual([[["A"], ["B"]]]);
    await expect(page.getByTestId("change-count")).toHaveText(before as string);
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

  test("a Block already in a Row of its own stays at the top or bottom", async ({
    page,
  }) => {
    await open(page, [[["A"]], [["B"]]]);
    const before = await page.getByTestId("change-count").textContent();
    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowUp");
    await blockWith(page, "B").focus();
    await page.keyboard.press("Alt+ArrowDown");

    await expect(structure(page)).resolves.toEqual([[["A"]], [["B"]]]);
    await expect(page.getByTestId("change-count")).toHaveText(before as string);
  });

  test("each move is one undo step, and focus stays on the Block", async ({
    page,
  }) => {
    await open(page, [[["A"], ["B"]]]);
    await blockWith(page, "A").focus();

    await page.keyboard.press("Alt+ArrowRight");
    await page.keyboard.press("Alt+ArrowUp");
    await expect(structure(page)).resolves.toEqual([[["A"]], [[], ["B"]]]);

    await page.keyboard.press("ControlOrMeta+z");
    await expect(structure(page)).resolves.toEqual([[[], ["A", "B"]]]);
    await expect(blockWith(page, "A")).toBeFocused();

    await page.keyboard.press("ControlOrMeta+z");
    await expect(structure(page)).resolves.toEqual([[["A"], ["B"]]]);
    await expect(blockWith(page, "A")).toBeFocused();

    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(structure(page)).resolves.toEqual([[[], ["A", "B"]]]);
    await expect(blockWith(page, "A")).toBeFocused();
  });

  test("the moved Block stays editable", async ({ page }) => {
    await open(page, [[["A"], ["B"]]]);
    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowRight");

    await page.keyboard.press("Enter");
    await expect(
      blockWith(page, "A").getByRole("textbox", { name: "Text Block" })
    ).toBeFocused();
    await page.keyboard.type("x");

    await expect(structure(page)).resolves.toEqual([[[], ["xA", "B"]]]);
  });
});

const DIRECTIONS = ["up", "down", "left", "right"];

const moveButton = (page: Page, direction: string) =>
  page.getByRole("button", { name: `Move Block ${direction}` });

test.describe("moving a Block with toolbar buttons", () => {
  test("they need a selected Block", async ({ page }) => {
    await open(page, [[["A"]]]);
    await Promise.all(
      DIRECTIONS.map((direction) =>
        expect(moveButton(page, direction)).toBeDisabled()
      )
    );

    await blockWith(page, "A").focus();
    await Promise.all(
      DIRECTIONS.map((direction) =>
        expect(moveButton(page, direction)).toBeEnabled()
      )
    );
  });

  test("from the keyboard, focus stays on the button for the next press", async ({
    page,
  }) => {
    await open(page, [[["A", "B", "C"], []]]);
    await blockWith(page, "A").focus();
    await moveButton(page, "down").focus();

    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["B", "A", "C"], []]]);
    await expect(moveButton(page, "down")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["B", "C", "A"], []]]);
    await expect(moveButton(page, "down")).toBeFocused();

    await moveButton(page, "right").focus();
    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["B", "C"], ["A"]]]);

    await moveButton(page, "left").focus();
    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["A", "B", "C"], []]]);

    await moveButton(page, "down").focus();
    await page.keyboard.press("Enter");
    await moveButton(page, "up").focus();
    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["A", "B", "C"], []]]);
  });

  test("with the mouse, the text keeps focus and its cursor", async ({
    page,
  }) => {
    await open(page, [[["A", "B"]]]);
    await blockWith(page, "A").getByRole("textbox").click();
    await page.keyboard.type("x");

    await moveButton(page, "down").click();

    await expect(structure(page)).resolves.toEqual([[["B", "Ax"]]]);
    await expect(blockWith(page, "Ax").getByRole("textbox")).toBeFocused();
    await page.keyboard.type("y");
    await expect(structure(page)).resolves.toEqual([[["B", "Axy"]]]);
  });

  test("each press is one undo step", async ({ page }) => {
    await open(page, [[["A", "B", "C"]]]);
    await blockWith(page, "A").focus();
    await moveButton(page, "down").click();
    await moveButton(page, "down").click();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(structure(page)).resolves.toEqual([[["B", "A", "C"]]]);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(structure(page)).resolves.toEqual([[["A", "B", "C"]]]);
  });
});

test.describe("announcing a move", () => {
  test("follows a move from the keyboard or the toolbar", async ({ page }) => {
    await open(page, [[["A", "B"], ["C"]], [["D"]]]);
    await expect(announcement(page)).toBeEmpty();
    await blockWith(page, "A").focus();

    await page.keyboard.press("Alt+ArrowDown");
    await expect(announcement(page)).toHaveText(
      "Moved to Row 1, Column 1, position 2 of 2."
    );

    await page.keyboard.press("Alt+ArrowRight");
    await expect(announcement(page)).toHaveText(
      "Moved to Row 1, Column 2, position 2 of 2."
    );

    await moveButton(page, "down").click();
    await expect(announcement(page)).toHaveText(
      "Moved to Row 2, Column 1, position 1 of 2."
    );
  });

  test("says when a Block can't go further", async ({ page }) => {
    await open(page, [[["A"]]]);
    await blockWith(page, "A").focus();

    await page.keyboard.press("Alt+ArrowLeft");
    await expect(announcement(page)).toHaveText("The Block can't move left.");

    await page.keyboard.press("Alt+ArrowUp");
    await expect(announcement(page)).toHaveText("The Block can't move up.");
  });

  test("undo clears it, so the same move made again is read again", async ({
    page,
  }) => {
    await open(page, [[["A", "B"]]]);
    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(announcement(page)).not.toBeEmpty();

    await page.keyboard.press("ControlOrMeta+z");

    await expect(structure(page)).resolves.toEqual([[["A", "B"]]]);
    await expect(announcement(page)).toBeEmpty();
  });

  test("doesn't carry over to another email", async ({ page }) => {
    await open(page, [[["A", "B"]]]);
    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(announcement(page)).not.toBeEmpty();
    // The controlled host sets `value` from the move, which would replace this.
    await expect(page.getByTestId("change-count")).toHaveText("1");

    await setValue(page, emailWith([[["C"]]]));

    await expect(blockWith(page, "C")).toBeVisible();
    await expect(announcement(page)).toBeEmpty();
  });
});

test.describe("typing inside a Block", () => {
  test("arrow keys move the cursor, not the selection", async ({ page }) => {
    await open(page, [[["AB", "C"]]]);
    await textOf(page, "AB").click();
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
    );

    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("x");

    await expect(structure(page)).resolves.toEqual([[["AxB", "C"]]]);
    await expect(textOf(page, "AxB")).toBeFocused();
  });

  test("Alt+Arrow keys don't move the Block", async ({ page }) => {
    await open(page, [[["one two", "B"], ["C"]]]);
    await textOf(page, "one two").click();

    await page.keyboard.press("Alt+ArrowDown");
    await page.keyboard.press("Alt+ArrowUp");

    await expect(structure(page)).resolves.toEqual([[["one two", "B"], ["C"]]]);
    await expect(textOf(page, "one two")).toBeFocused();
  });

  test("on macOS, Alt+Arrow keys still move the cursor by word", async ({
    page,
  }) => {
    test.skip(process.platform !== "darwin", "A macOS text shortcut");
    await open(page, [[["one two"], ["C"]]]);
    await textOf(page, "one two").click();
    await page.keyboard.press("Meta+ArrowRight");

    await page.keyboard.press("Alt+ArrowLeft");
    await page.keyboard.type("x");

    await expect(structure(page)).resolves.toEqual([[["one xtwo"], ["C"]]]);
  });

  test("Enter starts a new paragraph", async ({ page }) => {
    await open(page, [[["A", "B"]]]);
    await textOf(page, "A").click();

    await page.keyboard.press("Enter");

    await expect(textOf(page, "A").locator("p")).toHaveCount(2);
    await expect(textOf(page, "A")).toBeFocused();
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

  test("Escape during composition stays in the text", async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Only Chromium can simulate an input method"
    );
    await open(page, [[["A"]]]);
    await textOf(page, "A").click();
    const session = await page.context().newCDPSession(page);
    await session.send("Input.imeSetComposition", {
      selectionEnd: 1,
      selectionStart: 1,
      text: "に",
    });

    await page.keyboard.press("Escape");

    await expect(blockWith(page, "A").getByRole("textbox")).toBeFocused();
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
    await paletteText(page).focus();

    await page.keyboard.press("Enter");

    await expect(newBlockText(page)).toBeFocused();
    await page.keyboard.type("New");
    await expect(structure(page)).resolves.toEqual([
      [["A", "New", "B"], ["C"]],
    ]);

    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(structure(page)).resolves.toEqual([[["A", "B"], ["C"]]]);
  });

  test("with no Block selected, adds to the last Column", async ({ page }) => {
    await open(page, [[["A"], ["B"]]]);
    await paletteText(page).focus();

    await page.keyboard.press("Enter");

    await expect(newBlockText(page)).toBeFocused();
    await page.keyboard.type("New");
    await expect(structure(page)).resolves.toEqual([[["A"], ["B", "New"]]]);
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

  test("the toolbar's move buttons name their shortcut", async ({ page }) => {
    await open(page, [[["A"]]]);

    await expect(moveButton(page, "up")).toHaveAttribute(
      "title",
      "Move Block up (Alt+↑)"
    );
  });

  test("every control shows where focus is", async ({ page }) => {
    await open(page, [[["A"], []]]);
    await blockWith(page, "A").getByRole("textbox").click();
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    await expect(page.getByLabel("Link URL")).toBeFocused();
    // Browsers only show focus from a script after keyboard use.
    await page.keyboard.press("Tab");

    await expect(controlsWithoutRing(page)).resolves.toEqual([]);
  });

  test("the Preview's Close button shows where focus is", async ({ page }) => {
    await open(page, [[["A"]]]);
    await page.getByRole("button", { name: "Preview" }).focus();
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
    await moveButton(page, "up").focus();

    expect(await outlineWidth()).not.toBe(focused);
  });

  test("a Block with focus isn't hidden behind the sticky toolbar", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 500, width: 1000 });
    await open(page, [
      [["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]],
    ]);
    await blockWith(page, "L").focus();

    // oxlint-disable no-await-in-loop -- Each press depends on the one before.
    for (const text of [
      "K",
      "J",
      "I",
      "H",
      "G",
      "F",
      "E",
      "D",
      "C",
      "B",
      "A",
    ]) {
      await page.keyboard.press("ArrowUp");
      await expect(blockWith(page, text)).toBeFocused();
      const block = await blockWith(page, text).boundingBox();
      const toolbar = await page
        .getByRole("group", { name: "Email tools" })
        .boundingBox();
      expect(block?.y).toBeGreaterThanOrEqual(
        (toolbar?.y ?? 0) + (toolbar?.height ?? 0)
      );
    }
    // oxlint-enable no-await-in-loop
  });
});

test.describe("automated accessibility checks", () => {
  test("reach inside the Shadow DOM", async ({ page }) => {
    await open(page, [[["A"]]]);
    await canvas(page).evaluate((host) => {
      const undo = host.shadowRoot?.querySelector(".toolbar button");
      undo?.replaceChildren();
      undo?.removeAttribute("title");
    });

    expect(await violations(page)).toEqual([
      expect.objectContaining({ id: "button-name" }),
    ]);
  });

  test("pass with Columns, empty Columns and no Block selected", async ({
    page,
  }) => {
    await open(page, [[["A", "B"], []], [["C"]]]);

    expect(await violations(page)).toEqual([]);
  });

  test("pass with a Block selected, after a move", async ({ page }) => {
    await open(page, [[["A", "B"], []]]);
    await blockWith(page, "A").focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(canvas(page).getByRole("status")).not.toBeEmpty();

    expect(await violations(page)).toEqual([]);
  });

  test("pass with the link field showing its error", async ({ page }) => {
    await open(page, [[["A"]]]);
    await blockWith(page, "A").getByRole("textbox").click();
    await page.getByRole("button", { exact: true, name: "Link" }).click();
    await page.getByLabel("Link URL").fill("example.com");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });

  test("pass with the Preview open", async ({ page }) => {
    await open(page, [[["A"]]]);
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByTitle("Email preview")).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });
});
