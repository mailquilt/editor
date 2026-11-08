import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  blockGroup,
  canvas,
  currentValue,
  dragTo,
  emailWith,
  openBlocks,
  setValue,
  settle,
  structure,
  textBlock,
} from "./helpers.js";

const blockTools = (page: Page) =>
  canvas(page).getByRole("toolbar", { name: "Block tools" });

const rowTools = (page: Page, position: number) =>
  canvas(page).getByRole("group", { exact: true, name: `Row ${position}` });

const formatBar = (page: Page) =>
  canvas(page).getByRole("toolbar", { name: "Text formatting" });

const namesOf = (locator: Locator) =>
  locator.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label"))
  );

const outlineOf = (page: Page, selector: string) =>
  canvas(page)
    .locator(selector)
    .first()
    .evaluate((element) => {
      const { outlineStyle, outlineWidth } = getComputedStyle(element);
      return outlineStyle === "none"
        ? "none"
        : `${outlineWidth} ${outlineStyle}`;
    });

test.describe("a Block on the canvas", () => {
  test("shows an outline on hover, and a stronger one while selected", async ({
    page,
  }) => {
    await openBlocks(page, ["button", "divider"]);
    expect(await outlineOf(page, ".block")).toBe("none");

    await blockGroup(page, "Button").hover();
    expect(await outlineOf(page, ".block")).toBe("1px solid");

    await blockGroup(page, "Divider").focus();
    await blockGroup(page, "Divider").getByRole("button").first().focus();
    await page.mouse.move(0, 0);
    expect(await outlineOf(page, '.block[aria-current="true"]')).toBe(
      "2px solid"
    );
  });

  test("only the selected one has a toolbar: drag, move four ways, delete", async ({
    page,
  }) => {
    await openBlocks(page, ["button", "divider"]);
    await expect(blockTools(page)).toHaveCount(0);

    await blockGroup(page, "Button").focus();

    await expect(blockTools(page)).toHaveCount(1);
    await expect(
      blockGroup(page, "Button").getByRole("toolbar", { name: "Block tools" })
    ).toBeVisible();
    expect(await namesOf(blockTools(page).getByRole("button"))).toEqual([
      "Move Block up",
      "Move Block down",
      "Move Block left",
      "Move Block right",
      "Delete Block",
    ]);
    await expect(blockTools(page).locator(".drag-handle")).toBeVisible();
  });

  test("its toolbar is one Tab stop, and arrow keys go across it", async ({
    page,
  }) => {
    await openBlocks(page, ["button", "divider"]);
    await blockGroup(page, "Button").focus();

    await page.keyboard.press("Tab");
    const up = blockTools(page).getByRole("button", { name: "Move Block up" });
    await expect(up).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(
      blockTools(page).getByRole("button", { name: "Move Block down" })
    ).toBeFocused();
    await page.keyboard.press("End");
    await expect(
      blockTools(page).getByRole("button", { name: "Delete Block" })
    ).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(blockGroup(page, "Divider")).toBeFocused();
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

  test("Escape in its toolbar goes back to the Block", async ({ page }) => {
    await openBlocks(page, ["button"]);
    await blockGroup(page, "Button").focus();
    await page.keyboard.press("Tab");

    await page.keyboard.press("Escape");

    await expect(blockGroup(page, "Button")).toBeFocused();
  });
});

test.describe("a Row on the canvas", () => {
  test("shows an outline and its toolbar on hover", async ({ page }) => {
    await openBlocks(page, ["button"]);
    await expect(rowTools(page, 1)).toHaveCSS("opacity", "0");

    await canvas(page).locator(".row").hover();

    await expect(rowTools(page, 1)).toHaveCSS("opacity", "1");
    expect(await outlineOf(page, ".row")).toBe("1px dashed");
  });

  test("shows its toolbar while one of its Blocks is selected", async ({
    page,
  }) => {
    await page.goto("/");
    await setValue(page, emailWith([[["A"]], [["B"]]]));
    await page.mouse.move(0, 0);

    await blockGroup(page, "Text").last().focus();

    await expect(rowTools(page, 2)).toHaveCSS("opacity", "1");
    await expect(rowTools(page, 1)).toHaveCSS("opacity", "0");
  });

  test("has Select Row, the Move Row buttons and Delete Row", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);

    await expect(
      namesOf(rowTools(page, 1).getByRole("button"))
    ).resolves.toEqual([
      "Select Row",
      "Move Row up",
      "Move Row down",
      "Delete Row",
    ]);
  });

  test("an empty Row is selected and deleted from the keyboard", async ({
    page,
  }) => {
    await page.goto("/");
    await setValue(page, emailWith([[["A"]], [[]]]));
    const select = rowTools(page, 2).getByRole("button", {
      name: "Select Row",
    });

    await select.focus();
    await expect(rowTools(page, 2)).toHaveCSS("opacity", "1");
    await page.keyboard.press("Enter");
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await expect(select).toBeFocused();

    // Past Move Row up. Move Row down is disabled on the last Row.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(
      rowTools(page, 2).getByRole("button", { name: "Delete Row" })
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["A"]]]);
  });
});

test.describe("an empty Column", () => {
  test("says to drop a Block there, and keeps its buttons", async ({
    page,
  }) => {
    await openBlocks(page, ["button"], []);

    const column = canvas(page).locator(".column").nth(1);
    await expect(column).toContainText("Drop a Block here");
    await expect(
      column.getByRole("button", {
        exact: true,
        name: "Add Text Block here, Row 1, Column 2",
      })
    ).toBeVisible();
  });

  test("every add button takes the pointer's click", async ({ page }) => {
    await openBlocks(page, ["button"], []);
    const column = canvas(page).locator(".column").nth(1);
    await column.hover();
    // Once the buttons have faded in, over the label that has faded out.
    await expect(column.locator(".add-blocks")).toHaveCSS("opacity", "1");
    await expect(column.locator(".placeholder-label")).toHaveCSS(
      "opacity",
      "0"
    );

    // A plain press where the button shows, as a person's pointer makes.
    const button = await column
      .getByRole("button", { name: /^Add Image Block here/u })
      .boundingBox();
    if (!button) {
      throw new Error("No button to press");
    }
    await page.mouse.click(
      button.x + button.width / 2,
      button.y + button.height / 2
    );

    const { rows } = await currentValue(page);
    expect(rows[0]?.columns[1]?.blocks.map(({ type }) => type)).toEqual([
      "image",
    ]);
  });
});

test.describe("the email's language", () => {
  test("stays with the email, not the tools on it", async ({ page }) => {
    await page.goto("/");
    const document = emailWith([[["A"]], [[]]]);
    document.settings.language = "de";
    await setValue(page, document);
    await textBlock(page).click();

    const langs = await canvas(page).evaluate((host) => {
      const root = host.shadowRoot as ShadowRoot;
      const langOf = (selector: string) =>
        root.querySelector(selector)?.closest("[lang]")?.getAttribute("lang");
      return {
        blockTools: langOf(".block-toolbar"),
        formatBar: langOf(".format-bar"),
        placeholder: langOf(".placeholder"),
        rowTools: langOf(".row-toolbar"),
        text: langOf(".ProseMirror"),
      };
    });

    expect(langs).toEqual({
      blockTools: "en",
      formatBar: "en",
      placeholder: "en",
      rowTools: "en",
      text: "de",
    });
  });
});

test.describe("an empty Column on a touch screen", () => {
  // Only Chromium emulates a device with no hover.
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 900, width: 1280 },
  });

  test("shows its add buttons alone, not under its label", async ({ page }) => {
    await openBlocks(page, ["button"], []);
    const column = canvas(page).locator(".column").nth(1);
    expect(await page.evaluate(() => matchMedia("(hover: none)").matches)).toBe(
      true
    );

    await expect(column.locator(".add-blocks")).toHaveCSS("opacity", "1");
    await expect(column.locator(".placeholder-label")).toHaveCSS(
      "opacity",
      "0"
    );
  });
});

test.describe("dragging a Block", () => {
  // The test host's unfriendly CSS pushes the canvas far down the page.
  test.use({ viewport: { height: 1600, width: 1280 } });

  test("highlights where it can land and shows a line where it will", async ({
    page,
  }) => {
    await page.goto("/");
    await setValue(page, emailWith([[["A", "B"], ["C"]]]));
    const handle = canvas(page)
      .locator(".block", { hasText: "A" })
      .locator(".drag-handle");
    const target = canvas(page).locator(".column").nth(1);
    const start = await handle.boundingBox();
    const end = await target.boundingBox();
    if (!(start && end)) {
      throw new Error("Nothing to drag");
    }

    await page.mouse.move(start.x + 4, start.y + 4);
    await page.mouse.down();
    await page.mouse.move(start.x + 12, start.y + 12, { steps: 2 });
    await page.mouse.move(end.x + end.width / 2, end.y + end.height - 4, {
      steps: 8,
    });
    await settle(page);

    await expect(canvas(page).locator(".email")).toHaveAttribute(
      "data-dragging"
    );
    await expect(target).toHaveAttribute("data-drop-target");
    await expect(canvas(page).locator(".column").first()).not.toHaveAttribute(
      "data-drop-target"
    );
    await expect(canvas(page).locator(".drop-indicator")).toBeVisible();

    await page.mouse.up();
    await settle(page);
    await expect(canvas(page).locator("[data-drop-target]")).toHaveCount(0);
    await expect(canvas(page).locator(".email")).not.toHaveAttribute(
      "data-dragging"
    );
    await expect(structure(page)).resolves.toEqual([[["B"], ["C", "A"]]]);
  });

  test("from the Content tab onto an empty Column", async ({ page }) => {
    await openBlocks(page, ["button"], []);

    await dragTo(
      page,
      canvas(page)
        .getByRole("group", { name: "Add content" })
        .getByRole("button", { exact: true, name: "Divider" }),
      canvas(page).locator(".column").nth(1)
    );

    await expect(blockGroup(page, "Divider")).toBeVisible();
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
    expect(await namesOf(formatBar(page).getByRole("button"))).toEqual([
      "Bold",
      "Italic",
      "Underline",
      "Link",
      "Line break",
    ]);

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
    await page.keyboard.press("Escape");
    await expect(textBlock(page)).toBeFocused();
    await expect(formatBar(page)).toBeVisible();
  });

  test("isn't a stop for Tab from the text", async ({ page }) => {
    await openBlocks(page, ["text", "button"]);
    await textBlock(page).click();

    await page.keyboard.press("Tab");

    await expect(blockTools(page).getByRole("button").first()).toBeFocused();
  });
});

test.describe("the floating toolbar", () => {
  test("holds Undo, Redo and Preview at the bottom left of the canvas", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    const toolbar = canvas(page).getByRole("group", { name: "Email tools" });

    expect(await namesOf(toolbar.getByRole("button"))).toEqual([
      "Undo",
      "Redo",
      "Preview",
    ]);
    const box = await toolbar.boundingBox();
    const area = await canvas(page).locator(".canvas-area").boundingBox();
    const panel = await canvas(page).locator(".side-panel").boundingBox();
    if (!(box && area && panel)) {
      throw new Error("Nothing to measure");
    }
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
    await page.goto("/");
    await setValue(
      page,
      emailWith([[["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]]])
    );

    // The host page's own text is above the editor.
    await canvas(page).evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });

    const toolbar = canvas(page).getByRole("group", { name: "Email tools" });
    await expect(toolbar).toBeInViewport();
    const box = await toolbar.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(500);
  });
});

test.describe("the side panel", () => {
  test("is docked on the right of the canvas", async ({ page }) => {
    await openBlocks(page, ["text"]);

    const email = await canvas(page).locator(".email").boundingBox();
    const panel = await canvas(page).locator(".side-panel").boundingBox();
    const host = await canvas(page).boundingBox();
    expect(panel?.x).toBeGreaterThan((email?.x ?? 0) + (email?.width ?? 0));
    expect((panel?.x ?? 0) + (panel?.width ?? 0)).toBe(
      (host?.x ?? 0) + (host?.width ?? 0)
    );
  });

  test("the email card keeps its width on the workspace", async ({ page }) => {
    await openBlocks(page, ["text"]);

    await expect(canvas(page).locator(".email")).toHaveCSS("width", "600px");
    await expect(canvas(page).locator(".canvas-area")).not.toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)"
    );
    await expect(canvas(page).locator(".email")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)"
    );
  });
});

test.describe("review fixes", () => {
  // The test host's unfriendly CSS pushes the canvas far down the page.
  test.use({ viewport: { height: 1600, width: 1280 } });

  test("a short drag let go over the toolbar it started from moves nothing", async ({
    page,
  }) => {
    await page.goto("/");
    await setValue(page, emailWith([[["A"], ["B"]]]));
    await blockGroup(page, "Text").last().focus();
    const handle = await blockTools(page).locator(".drag-handle").boundingBox();
    if (!handle) {
      throw new Error("No handle");
    }

    await page.mouse.move(handle.x + 10, handle.y + 10);
    await page.mouse.down();
    await page.mouse.move(handle.x + 16, handle.y + 18, { steps: 4 });
    await settle(page);
    await page.mouse.up();
    await settle(page);

    await expect(structure(page)).resolves.toEqual([[["A"], ["B"]]]);
  });

  test("a drag that left the toolbar lands where the toolbar was", async ({
    page,
  }) => {
    await page.goto("/");
    await setValue(page, emailWith([[["A"], ["B"]]]));
    await blockGroup(page, "Text").last().focus();
    const handle = await blockTools(page).locator(".drag-handle").boundingBox();
    if (!handle) {
      throw new Error("No handle");
    }

    // Away from the toolbar, then back over where it was, in the first Column.
    await page.mouse.move(handle.x + 10, handle.y + 10);
    await page.mouse.down();
    await page.mouse.move(handle.x - 120, handle.y + 120, { steps: 8 });
    await page.mouse.move(handle.x + 10, handle.y + 20, { steps: 8 });
    await settle(page);
    await expect(canvas(page).locator(".drop-indicator")).toBeVisible();
    await page.mouse.up();
    await settle(page);

    // Above A, whose top half the toolbar sat beside.
    await expect(structure(page)).resolves.toEqual([[["B", "A"], []]]);
  });

  test("Control or Command+K on the Block opens the link field in its text", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await blockGroup(page, "Text").focus();

    await page.keyboard.press("ControlOrMeta+k");

    await expect(
      canvas(page).getByRole("textbox", { name: "Link URL" })
    ).toBeFocused();
  });

  test("a click on another Block's handle leaves the tabs showing", async ({
    page,
  }) => {
    await page.goto("/");
    await setValue(page, emailWith([[["A", "B"]]]));
    await blockGroup(page, "Text").first().focus();
    await canvas(page)
      .getByRole("button", { exact: true, name: "Back" })
      .click();

    const b = canvas(page).locator(".block").last();
    await b.hover();
    await b.locator(".drag-handle").click();

    await expect(
      canvas(page).getByRole("tab", { name: "Content" })
    ).toBeVisible();
  });
});

const notice = (page: Page) =>
  canvas(page).getByText("Editing needs more room");

test.describe("on a screen too narrow to edit in", () => {
  test.use({ viewport: { height: 800, width: 390 } });

  test("says so in place of the editor, and still previews the email", async ({
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
    await expect(
      page
        .getByRole("dialog", { name: "Preview" })
        .frameLocator("iframe")
        .getByText("Hello")
    ).toBeVisible();
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

    const area = await canvas(page).locator(".canvas-area").boundingBox();
    if (!area) {
      throw new Error("No canvas");
    }
    await page.mouse.click(area.x + 10, area.y + 10);

    await expect(blockTools(page)).toHaveCount(0);
    await expect(canvas(page).locator('[aria-current="true"]')).toHaveCount(0);
    await expect(
      canvas(page).getByRole("tab", { name: "Content" })
    ).toBeVisible();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(textBlock(page)).toHaveText("Words");
  });

  test("leaves the selection after a drag that ends there", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 1600, width: 1280 });
    await page.goto("/");
    await setValue(page, emailWith([[["A", "B"]]]));
    await blockGroup(page, "Text").first().focus();
    const handle = await blockTools(page).locator(".drag-handle").boundingBox();
    const area = await canvas(page).locator(".canvas-area").boundingBox();
    if (!(handle && area)) {
      throw new Error("Nothing to drag");
    }

    await page.mouse.move(handle.x + 10, handle.y + 10);
    await page.mouse.down();
    await page.mouse.move(handle.x + 20, handle.y + 20, { steps: 3 });
    await page.mouse.move(area.x + 10, area.y + 10, { steps: 6 });
    await settle(page);
    await page.mouse.up();
    await settle(page);

    await expect(canvas(page).locator('[aria-current="true"]')).toHaveCount(1);
  });
});
