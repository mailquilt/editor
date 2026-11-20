import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  blockGroup,
  blockTools,
  blockWith,
  boxOf,
  canvas,
  centerOf,
  currentValue,
  emailWith,
  linkUrlField,
  moveCursorToLineEnd,
  openBlocks,
  openEmail,
  previewEmail,
  rowTag,
  rowTools,
  selectedBlock,
  selectRowButton,
  serveImages,
  settle,
  setValue,
  TALL_VIEWPORT,
  textBlock,
  textOf,
  undoByKey,
} from "./helpers.js";

const formatBar = (page: Page) =>
  canvas(page).getByRole("toolbar", { name: "Text formatting" });

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

  test("Alt+↑ in its toolbar moves the Block, as its tooltip says", async ({
    page,
  }) => {
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

    await canvas(page).getByTestId("row").hover();

    await expect(rowTools(page, 1)).toHaveCSS("opacity", "1");
  });

  test("hides its toolbar while one of its Blocks is selected, even on hover", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"]]]);
    await page.mouse.move(0, 0);

    await blockGroup(page, "Text").last().focus();
    await canvas(page)
      .getByTestId("row")
      .nth(1)
      .hover({ position: { x: 4, y: 4 } });

    await expect(rowTools(page, 2)).toHaveCSS("opacity", "0");
    // Its tag still shows, and selects the Row, which brings the toolbar back.
    const tag = rowTag(page, 2);
    await expect(tag).toHaveCSS("opacity", "1");
    await tag.click();
    await expect(rowTools(page, 2)).toHaveCSS("opacity", "1");
    await expect(rowTools(page, 2)).toHaveAttribute("aria-current", "true");
  });

  test("its toolbar is reached by Tab from a selected Block", async ({
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
    await column.hover();
    // Once the buttons have faded in, over the label that has faded out.
    await expect(column.getByTestId("add-blocks")).toHaveCSS("opacity", "1");
    await expect(column.getByTestId("placeholder-label")).toHaveCSS(
      "opacity",
      "0"
    );

    // A plain press where the button shows, as a person's pointer makes.
    const { x, y } = await centerOf(
      column.getByRole("button", { name: /^Add Image Block here/u })
    );
    await page.mouse.click(x, y);

    const { rows } = await currentValue(page);
    expect(rows[0]?.columns[1]?.blocks.map(({ type }) => type)).toEqual([
      "image",
    ]);
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
      status: canvas(page).getByRole("status"),
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
    await openBlocks(page, ["text", "button"]);
    await expect(formatBar(page)).toHaveCount(0);

    await blockGroup(page, "Text").focus();
    await expect(formatBar(page)).toBeHidden();

    await textBlock(page).click();
    await expect(formatBar(page)).toBeVisible();

    await blockGroup(page, "Button").focus();
    await expect(formatBar(page)).toHaveCount(0);
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
 * be on top. The editor clips what reaches past it.
 */
const unpressable = async (page: Page) => {
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
    // oxlint-disable-next-line no-await-in-loop -- Each scroll moves the page for the next.
    await control.scrollIntoViewIfNeeded();
    // oxlint-disable-next-line no-await-in-loop -- As above.
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
      return reached
        ? undefined
        : (element.getAttribute("aria-label") ?? element.textContent?.trim());
    });
    if (name !== undefined) {
      missed.push(name || "drag handle");
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

    expect(await unpressable(page)).toEqual([]);
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
      // oxlint-disable-next-line no-await-in-loop -- Keys go in order.
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

  test("Control or Command+K on the Block opens the link field in its text, and on a Button reaches the host page", async ({
    page,
  }) => {
    await openBlocks(page, ["button", "text"]);
    await page.evaluate(() => {
      Object.assign(window, { hostLinkKeys: 0 });
      document.addEventListener("keydown", (event) => {
        if (event.key === "k" && !event.defaultPrevented) {
          Reflect.set(
            window,
            "hostLinkKeys",
            Reflect.get(window, "hostLinkKeys") + 1
          );
        }
      });
    });
    const hostLinkKeys = () =>
      page.evaluate(() => Reflect.get(window, "hostLinkKeys"));
    const linkUrl = linkUrlField(page);
    await blockGroup(page, "Button").focus();

    await page.keyboard.press("ControlOrMeta+k");

    await expect(linkUrl).toHaveCount(0);
    await expect(blockGroup(page, "Button")).toBeFocused();
    await expect.poll(hostLinkKeys).toBe(1);

    await blockGroup(page, "Text").focus();
    await page.keyboard.press("ControlOrMeta+k");

    await expect(linkUrl).toBeFocused();
    expect(await hostLinkKeys()).toBe(1);
  });

  test("a click on another Block's handle leaves the tabs showing", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"]]]);
    await blockGroup(page, "Text").first().focus();
    await canvas(page)
      .getByRole("button", { exact: true, name: "Back" })
      .click();

    const b = blockWith(page, "B");
    await b.hover();
    await b.getByTestId("drag-handle").click();

    await expect(
      canvas(page).getByRole("tab", { name: "Content" })
    ).toBeVisible();
  });
});

const notice = (page: Page) =>
  canvas(page).getByText("Editing needs more room");

test.describe("on a screen too narrow to edit in", () => {
  test.use({ viewport: { height: 800, width: 390 } });

  test("says so instead of the editor, and still previews the email", async ({
    page,
  }) => {
    await page.goto("/");
    await page.addStyleTag({
      content:
        "main { padding: 0 !important } * { font-size: 16px !important }",
    });

    await expect(notice(page)).toBeVisible();
    await expect(canvas(page).getByRole("tab")).toHaveCount(0);
    await expect(textBlock(page)).toBeHidden();

    await canvas(page).getByRole("button", { name: "Preview email" }).click();
    await expect(previewEmail(page)).toContainText("Hello");
  });

  test("stays out of sight with a size the host gives the frame", async ({
    page,
  }) => {
    await page.goto("/");
    await page.addStyleTag({
      content:
        "mail-quilt::part(frame) { flex-grow: 1; height: 700px; min-height: 700px }",
    });
    await expect(notice(page)).toBeVisible();

    await expect(
      canvas(page)
        .getByTestId("editor")
        .evaluate((editor) => editor.getBoundingClientRect().height)
    ).resolves.toBe(0);
  });

  test("gives the editor back, with the same email, once there's room", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(notice(page)).toBeVisible();

    await page.setViewportSize({ height: 800, width: 1280 });

    await expect(notice(page)).toHaveCount(0);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("gives the editor back in a host sized to fit its content", async ({
    page,
  }) => {
    await page.goto("/");
    // Not a page error or a console message, so collectErrors can't see it.
    await page.evaluate(() => {
      const reported: string[] = [];
      Object.assign(window, { reported });
      window.addEventListener("error", ({ message }) => reported.push(message));
    });
    // As a flex item that isn't stretched takes the width of what's inside, up
    // to the width there is.
    await page.addStyleTag({
      content:
        "mail-quilt { align-self: flex-start !important; max-width: 100% !important }",
    });
    await expect(notice(page)).toBeVisible();

    await page.setViewportSize({ height: 800, width: 1280 });

    await expect(notice(page)).toHaveCount(0);
    await expect(textBlock(page)).toHaveText("Hello");
    await expect(
      page.evaluate(() => Reflect.get(window, "reported"))
    ).resolves.toEqual([]);
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
    await expect(
      canvas(page).getByRole("tab", { name: "Content" })
    ).toBeVisible();
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
