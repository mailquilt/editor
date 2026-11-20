import { BLOCK_TYPES } from "@mailquilt/core";
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  announcement,
  backButton,
  blockGroup,
  blockTools,
  blockTypes,
  blockWith,
  boxOf,
  canvas,
  centerOf,
  currentValue,
  emailWith,
  formatBar,
  hoverRow,
  linkUrlField,
  moveCursorToLineEnd,
  openBlocks,
  openEmail,
  panelTab,
  rowTag,
  rowTools,
  selectedBlock,
  selectRowButton,
  serveImages,
  settle,
  setValue,
  TALL_VIEWPORT,
  test,
  textBlock,
  textOf,
  undoButton,
  undoByKey,
} from "./helpers.js";

/** The language an element is in, from the nearest element that says. */
const langOf = (locator: Locator) =>
  locator
    .first()
    .evaluate((element) => element.closest("[lang]")?.getAttribute("lang"));

test.describe("a Block on the canvas", () => {
  test("only the selected one has a toolbar", async ({ page }) => {
    await openBlocks(page, ["button", "divider"]);
    await expect(blockTools(page)).toHaveCount(0);

    await blockGroup(page, "Button").focus();

    await expect(blockTools(page)).toHaveCount(1);
    await expect(
      blockGroup(page, "Button").getByRole("toolbar", { name: "Block tools" })
    ).toBeVisible();
    await expect(blockTools(page).getByTestId("drag-handle")).toBeVisible();
  });

  test("Alt+↑ in its toolbar moves the Block", async ({ page }) => {
    await openBlocks(page, ["button", "divider"]);
    await blockGroup(page, "Divider").focus();
    await page.keyboard.press("Tab");
    await expect(
      blockTools(page).getByRole("button", { name: "Move Block up" })
    ).toBeFocused();

    await page.keyboard.press("Alt+ArrowUp");

    const { rows } = await currentValue(page);
    expect(rows[0]?.columns[0]?.blocks.map(({ type }) => type)).toEqual([
      "divider",
      "button",
    ]);
  });
});

test.describe("a Row on the canvas", () => {
  test("shows its toolbar on hover", async ({ page }) => {
    await openBlocks(page, ["button"]);
    await expect(rowTools(page, 1)).toHaveCSS("opacity", "0");

    await hoverRow(page, 1);

    await expect(rowTools(page, 1)).toHaveCSS("opacity", "1");
  });

  test("hides its toolbar while one of its Blocks is selected, even on hover", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"]]]);
    await page.mouse.move(0, 0);

    await blockGroup(page, "Text").last().focus();
    await hoverRow(page, 2);

    await expect(rowTools(page, 2)).toHaveCSS("opacity", "0");
    // Its tag still shows, and selects the Row, which brings the toolbar back.
    const tag = rowTag(page, 2);
    await expect(tag).toHaveCSS("opacity", "1");
    await tag.click();
    await expect(rowTools(page, 2)).toHaveCSS("opacity", "1");
    await expect(rowTools(page, 2)).toHaveAttribute("aria-current", "true");
  });

  test("Shift+Tab from one of its Blocks reaches its toolbar in one stop, and from further along leaves it", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"]]]);
    await blockGroup(page, "Text").last().focus();

    await page.keyboard.press("Shift+Tab");

    // One stop for the whole toolbar, at its first tool.
    await expect(selectRowButton(page, 2)).toBeFocused();
    await expect(rowTools(page, 2)).toHaveCSS("opacity", "1");

    // Shift+Tab from further along leaves it, rather than going back to that stop.
    await page.keyboard.press("ArrowRight");
    await expect(
      rowTools(page, 2).getByRole("button", { name: "Move Row up" })
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(selectRowButton(page, 2)).not.toBeFocused();
    await expect(
      rowTools(page, 2).getByRole("button", { name: "Move Row up" })
    ).not.toBeFocused();
  });
});

test.describe("an empty Column", () => {
  test("every add button takes the pointer's click", async ({ page }) => {
    await openBlocks(page, ["button"], []);
    const column = canvas(page).getByTestId("column").nth(1);
    await expect(
      column.getByRole("button", { name: / Block here, /u })
    ).toHaveCount(BLOCK_TYPES.length);

    for (const { label, type } of BLOCK_TYPES) {
      await column.hover();
      // Once the buttons have faded in, over the label that has faded out.
      await expect(column.getByTestId("add-blocks")).toHaveCSS("opacity", "1");
      await expect(column.getByTestId("placeholder-label")).toHaveCSS(
        "opacity",
        "0"
      );

      // A plain press where the button shows, as a person's pointer makes.
      const { x, y } = await centerOf(
        column.getByRole("button", { name: `Add ${label} Block here, ` })
      );
      await page.mouse.click(x, y);

      expect(await blockTypes(page, 0, 1)).toEqual([type]);
      await undoButton(page).click();
      expect(await blockTypes(page, 0, 1)).toEqual([]);
    }
  });
});

test.describe("the email's language", () => {
  test("is on each Block's content, not on the Block or its tools", async ({
    page,
  }) => {
    // So the image loads rather than showing its stand-in.
    await serveImages(page.context());
    await page.goto("/");
    const email = emailWith([[["A"]], [[]], [[]]]);
    email.settings.language = "de";
    email.rows[2]?.columns[0]?.blocks.push(
      { id: "button", props: { label: "Los" }, type: "button" },
      {
        id: "image",
        props: { alt: "Logo", src: "https://cdn.example/logo.png" },
        type: "image",
      }
    );
    await setValue(page, email);
    await textBlock(page).click();

    const elements = {
      block: blockGroup(page, "Text"),
      blockTools: blockTools(page),
      button: canvas(page).getByTestId("button-face"),
      formatBar: formatBar(page),
      imageAlt: blockGroup(page, "Image").getByRole("img"),
      placeholder: canvas(page).getByTestId("placeholder"),
      rowTools: rowTools(page, 1),
      sidePanel: canvas(page).getByTestId("side-panel"),
      status: announcement(page),
      text: textBlock(page).locator("p"),
      textBox: textBlock(page),
    };
    const langs = Object.fromEntries(
      await Promise.all(
        Object.entries(elements).map(
          async ([name, locator]) => [name, await langOf(locator)] as const
        )
      )
    );

    expect(langs).toEqual({
      block: "en",
      blockTools: "en",
      button: "de",
      formatBar: "en",
      imageAlt: "de",
      placeholder: "en",
      rowTools: "en",
      sidePanel: "en",
      status: "en",
      text: "de",
      textBox: "en",
    });
  });

  test("is unknown on the content of an email that has none", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);

    const lang = await textBlock(page)
      .locator("p")
      .evaluate((text) => text.closest("[lang]")?.getAttribute("lang"));

    expect(lang).toBe("");
  });
});

test.describe("an empty Column on a touch screen", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 900, width: 1280 },
  });

  test("shows its add buttons alone, not under its label", async ({ page }) => {
    await openBlocks(page, ["button"], []);
    const column = canvas(page).getByTestId("column").nth(1);
    expect(await page.evaluate(() => matchMedia("(hover: none)").matches)).toBe(
      true
    );

    await expect(column.getByTestId("add-blocks")).toHaveCSS("opacity", "1");
    await expect(column.getByTestId("placeholder-label")).toHaveCSS(
      "opacity",
      "0"
    );
    // With no hover to show them, a Block's drag handle always shows, and a
    // Row's tag, which selects the Row and shows its tools.
    await expect(
      blockGroup(page, "Button").getByTestId("drag-handle")
    ).toHaveCSS("opacity", "1");
    const tag = canvas(page).getByTestId("row-tag");
    await expect(tag).toHaveCSS("opacity", "1");
    await tag.tap();
    await expect(rowTools(page, 1)).toHaveCSS("opacity", "1");
  });
});

test.describe("the format bar", () => {
  test("shows only while a Text or Heading Block's text is edited", async ({
    page,
  }) => {
    await openBlocks(page, ["text", "heading", "button"]);
    await expect(formatBar(page)).toHaveCount(0);

    await blockGroup(page, "Text").focus();
    await expect(formatBar(page)).toBeHidden();

    await textBlock(page).click();
    await expect(formatBar(page)).toBeVisible();

    await blockGroup(page, "Button").focus();
    await expect(formatBar(page)).toHaveCount(0);

    await canvas(page).getByRole("textbox", { name: "Heading Block" }).click();
    await expect(formatBar(page)).toBeVisible();
  });

  test("Alt+F10 reaches it from the text, and Escape goes back", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await textBlock(page).click();
    await page.keyboard.press("ControlOrMeta+a");

    await page.keyboard.press("Alt+F10");
    const bold = formatBar(page).getByRole("button", { name: "Bold" });
    await expect(bold).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(
      formatBar(page).getByRole("button", { name: "Italic" })
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(textBlock(page)).toBeFocused();
    await expect(textBlock(page).locator("em")).toHaveText("Words");

    await page.keyboard.press("Alt+F10");
    await expect(bold).toBeFocused();
    // The first only closes Bold's tooltip.
    await page.keyboard.press("Escape");
    await expect(bold).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(textBlock(page)).toBeFocused();
    await expect(formatBar(page)).toBeVisible();
  });
});

/**
 * What a pointer can't press of the selected Block's text and controls, by
 * name, once each is scrolled to: its middle and the middle of each edge must
 * be on top. The editor clips what reaches past it. The format bar and the
 * Block's toolbar show a moment after the text takes focus, and are fitted
 * into the canvas after that, so this waits for both before it reads.
 */
const unpressable = async (page: Page) => {
  await expect(formatBar(page)).toBeVisible();
  await expect(blockTools(page)).toBeVisible();
  await settle(page);
  const controls = [
    selectedBlock(page).getByRole("textbox", {
      exact: true,
      name: "Text Block",
    }),
    ...(await formatBar(page).getByRole("button").all()),
    ...(await formatBar(page).getByRole("textbox").all()),
    ...(await blockTools(page).getByRole("button").all()),
    blockTools(page).getByTestId("drag-handle"),
  ];
  const missed: string[] = [];
  for (const control of controls) {
    await control.scrollIntoViewIfNeeded();
    const name = await control.evaluate((element) => {
      const root = element.getRootNode() as ShadowRoot;
      const { bottom, left, right, top } = element.getBoundingClientRect();
      const [x, y] = [(left + right) / 2, (top + bottom) / 2];
      const points = [
        [x, y],
        [left + 2, y],
        [right - 2, y],
        [x, top + 2],
        [x, bottom - 2],
      ] as const;
      const reached = points.every(([px, py]) =>
        element.contains(root.elementFromPoint(px, py))
      );
      // The link field is named by the label around it, and the drag handle
      // by its test id.
      const named =
        element instanceof HTMLInputElement ? element.labels?.[0] : element;
      return reached
        ? undefined
        : element.getAttribute("aria-label") ||
            named?.textContent?.trim() ||
            element.dataset.testid ||
            element.localName;
    });
    if (name !== undefined) {
      missed.push(name);
    }
  }
  return missed;
};

/** A Row of four one-line Columns. */
const FOUR_COLUMNS = [["W"], ["X"], ["Y"], ["Z"]];

/** How far apart two elements are, up and down. */
const verticalGap = async (a: Locator, b: Locator) => {
  const [first, second] = [await boxOf(a), await boxOf(b)];
  return Math.max(
    first.y - (second.y + second.height),
    second.y - (first.y + first.height)
  );
};

test.describe("the selected Block's tools", () => {
  // In the last Column, the Block's toolbar is in the way of its text's end.
  for (const [column, text, where, rows, nextToText] of [
    ["first", "W", "at the email's start", [FOUR_COLUMNS], true],
    ["last", "Z", "at the email's start", [FOUR_COLUMNS], false],
    // Taller than the canvas's least height, so the email ends with the canvas.
    [
      "first",
      "W",
      "at the email's end",
      [[[..."ABCDEFGHI"]], FOUR_COLUMNS],
      true,
    ],
    [
      "last",
      "Z",
      "at the email's end",
      [[[..."ABCDEFGHI"]], FOUR_COLUMNS],
      false,
    ],
  ] as const) {
    test(`in the ${column} of four Columns ${where}, the text and every button of the Block's toolbar, the format bar and the link field take the pointer`, async ({
      page,
    }) => {
      await openEmail(
        page,
        rows.map((row) => row.map((texts) => [...texts]))
      );
      await textOf(page, text).click();
      expect(await unpressable(page)).toEqual([]);

      await page.keyboard.press("ControlOrMeta+k");
      await expect(linkUrlField(page)).toBeFocused();
      expect(await unpressable(page)).toEqual([]);
      if (nextToText) {
        // No further than the gap the editor leaves between them.
        expect(
          await verticalGap(formatBar(page), selectedBlock(page))
        ).toBeLessThanOrEqual(6);
      }
    });
  }

  test("on a page that scales the editor, the link field in the first of four Columns takes the pointer, next to its text", async ({
    page,
  }) => {
    await openEmail(page, [FOUR_COLUMNS]);
    await canvas(page).evaluate((element) => {
      element.style.transform = "scale(0.5)";
      element.style.transformOrigin = "0 0";
    });
    await textOf(page, "W").click();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(linkUrlField(page)).toBeFocused();

    expect(await unpressable(page)).toEqual([]);
    // Half the gap unscaled, at half the size.
    expect(
      await verticalGap(formatBar(page), selectedBlock(page))
    ).toBeLessThanOrEqual(3);
  });

  test("the format bar keeps clear of the Block's toolbar as its text gets more lines", async ({
    page,
  }) => {
    // Little room beside a narrow email, so the format bar is above the Block.
    await page.setViewportSize({ height: 900, width: 930 });
    await page.goto("/");
    const email = emailWith([[["A", "B", "C", "D", "E"], ["X"], ["Y"], ["Z"]]]);
    email.settings.width = 300;
    await setValue(page, email);
    await textOf(page, "Z").click();
    await moveCursorToLineEnd(page);

    // The first Column is taller, so only the Block grows.
    for (const _ of [1, 2, 3]) {
      await page.keyboard.press("Enter");
    }

    await expect.poll(() => unpressable(page)).toEqual([]);
  });

  test("the tools stay in reach when the host gets narrower", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 720, width: 1600 });
    await openEmail(page, [FOUR_COLUMNS]);
    await textOf(page, "Z").click();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(linkUrlField(page)).toBeFocused();

    // The Side panel goes below, so the canvas ends where the editor does.
    await page.setViewportSize({ height: 720, width: 1100 });

    await expect.poll(() => unpressable(page)).toEqual([]);
  });

  test("a tooltip that shows for a tool moves with it", async ({ page }) => {
    await page.setViewportSize({ height: 720, width: 1600 });
    await openEmail(page, [FOUR_COLUMNS]);
    await textOf(page, "Z").click();
    // From focus, as content moving under the pointer can hover another control.
    await page.mouse.move(0, 0);
    await page.keyboard.press("Alt+F10");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    const bold = formatBar(page).getByRole("button", { name: "Bold" });
    await expect(bold).toBeFocused();
    const tooltip = canvas(page).getByRole("tooltip");
    await expect(tooltip).toBeVisible();

    // The Side panel goes below, and the email and its tools move.
    await page.setViewportSize({ height: 720, width: 1100 });

    await expect
      .poll(async () => {
        const [tip, button] = [await boxOf(tooltip), await boxOf(bold)];
        return Math.abs(tip.x + tip.width / 2 - (button.x + button.width / 2));
      })
      .toBeLessThan(2);
  });

  test("the floating toolbar doesn't cover the link field", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 400, width: 1280 });
    await openEmail(page, [FOUR_COLUMNS]);
    await textOf(page, "W").click();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(linkUrlField(page)).toBeFocused();
    // At the window's bottom, where the floating toolbar stays.
    await formatBar(page).evaluate((bar) => {
      bar.scrollIntoView({ block: "end" });
    });

    expect(await unpressable(page)).toEqual([]);
  });
});

test.describe("the floating toolbar", () => {
  test("Undo and Redo are disabled while there's nothing to undo or redo", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    const toolbar = canvas(page).getByRole("group", { name: "Email tools" });
    const undo = toolbar.getByRole("button", { name: "Undo" });
    const redo = toolbar.getByRole("button", { name: "Redo" });
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();

    await textBlock(page).click();
    await page.keyboard.type("Hi");
    await expect(undo).toBeEnabled();
    await expect(redo).toBeDisabled();

    await undo.focus();
    await page.keyboard.press("Enter");

    await expect(undo).toBeDisabled();
    await expect(redo).toBeEnabled();
    // As for any control that an update disables.
    await expect(toolbar).toBeFocused();
  });

  test("sits at the bottom left of the canvas", async ({ page }) => {
    await openBlocks(page, ["text"]);
    const toolbar = canvas(page).getByRole("group", { name: "Email tools" });

    const box = await boxOf(toolbar);
    const area = await boxOf(canvas(page).getByTestId("workspace"));
    const panel = await boxOf(canvas(page).getByTestId("side-panel"));
    // In the corner, rather than anywhere along the canvas.
    expect(box.x - area.x).toBeLessThan(80);
    expect(box.x + box.width).toBeLessThan(panel.x);
    // At the bottom of the canvas, or of the window while the canvas goes on.
    const bottom = Math.min(
      area.y + area.height,
      page.viewportSize()?.height ?? 0
    );
    expect(bottom - (box.y + box.height)).toBeLessThan(40);
  });

  test("stays in view at the bottom of a long email", async ({ page }) => {
    await page.setViewportSize({ height: 500, width: 1280 });
    await openEmail(page, [
      [["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]],
    ]);

    // The host page's own text is above the editor.
    await canvas(page).evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });

    const toolbar = canvas(page).getByRole("group", { name: "Email tools" });
    await expect(toolbar).toBeInViewport();
    const box = await boxOf(toolbar);
    expect(box.y + box.height).toBeLessThanOrEqual(500);
  });

  test("stays above the email when the page scrolls it underneath", async ({
    page,
  }) => {
    await openBlocks(page, [
      "text",
      "spacer",
      "text",
      "spacer",
      "text",
      "spacer",
      "text",
      "spacer",
      "text",
      "spacer",
    ]);
    await page.setViewportSize({ height: 400, width: 1000 });
    await page.addStyleTag({
      content:
        "main { padding: 0 !important } mail-quilt { width: 1000px !important }",
    });
    await blockGroup(page, "Text").first().focus();

    const onTop = await canvas(page).evaluate((host) => {
      const root = host.shadowRoot as ShadowRoot;
      const toolbar = root.querySelector(
        '[role="group"][aria-label="Email tools"]'
      ) as Element;
      const email = root.querySelector('[data-testid="email"]') as Element;
      // Halfway down the email, which goes on below the window.
      window.scrollBy(0, email.getBoundingClientRect().y);
      const { height, width, x, y } = toolbar.getBoundingClientRect();
      const under = email.getBoundingClientRect();
      const hit = root.elementFromPoint(x + width / 2, y + height / 2);
      return {
        emailUnder: under.left < x + width && under.bottom > y,
        toolbar: toolbar.contains(hit),
      };
    });

    expect(onTop).toEqual({ emailUnder: true, toolbar: true });
  });
});

test.describe("a Block's drag handle and link shortcut", () => {
  test.use({ viewport: TALL_VIEWPORT });

  test("Control or Command+K on a Block opens the link field in its text", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await blockGroup(page, "Text").focus();

    await page.keyboard.press("ControlOrMeta+k");

    await expect(linkUrlField(page)).toBeFocused();
  });

  test("a click on another Block's handle leaves the tabs showing", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"]]]);
    await blockGroup(page, "Text").first().focus();
    await backButton(page).click();

    const b = blockWith(page, "B");
    await b.hover();
    await b.getByTestId("drag-handle").click();

    await expect(panelTab(page, "Content")).toBeVisible();
  });
});

test.describe("a click on the workspace, outside the email", () => {
  test("clears the selection, and undo still works from the keyboard", async ({
    page,
  }) => {
    await openBlocks(page, ["text", "button"]);
    await textBlock(page).click();
    await page.keyboard.type("!");
    await expect(blockTools(page)).toBeVisible();

    const area = await boxOf(canvas(page).getByTestId("workspace"));
    await page.mouse.click(area.x + 10, area.y + 10);

    await expect(blockTools(page)).toHaveCount(0);
    await expect(canvas(page).locator('[aria-current="true"]')).toHaveCount(0);
    await expect(panelTab(page, "Content")).toBeVisible();
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Words");
  });

  test("leaves the selection after a drag that ends there", async ({
    page,
  }) => {
    await page.setViewportSize(TALL_VIEWPORT);
    await openEmail(page, [[["A", "B"]]]);
    await blockGroup(page, "Text").first().focus();
    const handle = await boxOf(blockTools(page).getByTestId("drag-handle"));
    const area = await boxOf(canvas(page).getByTestId("workspace"));

    await page.mouse.move(handle.x + 10, handle.y + 10);
    await page.mouse.down();
    await page.mouse.move(handle.x + 20, handle.y + 20, { steps: 3 });
    await page.mouse.move(area.x + 10, area.y + 10, { steps: 6 });
    await settle(page);
    await page.mouse.up();
    await settle(page);

    await expect(canvas(page).locator('[aria-current="true"]')).toHaveCount(1);
    await expect(blockWith(page, "A")).toHaveAttribute("aria-current", "true");
  });
});
