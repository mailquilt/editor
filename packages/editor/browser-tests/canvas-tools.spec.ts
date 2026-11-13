import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  blockGroup,
  boxOf,
  canvas,
  centerOf,
  currentValue,
  emailWith,
  openBlocks,
  rowTools,
  selectRowButton,
  serveImages,
  settle,
  setValue,
  structure,
  textBlock,
  undoByKey,
} from "./helpers.js";

const blockTools = (page: Page) =>
  canvas(page).getByRole("toolbar", { name: "Block tools" });

const formatBar = (page: Page) =>
  canvas(page).getByRole("toolbar", { name: "Text formatting" });

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
  test("only the selected one has a toolbar", async ({ page }) => {
    await openBlocks(page, ["button", "divider"]);
    await expect(blockTools(page)).toHaveCount(0);

    await blockGroup(page, "Button").focus();

    await expect(blockTools(page)).toHaveCount(1);
    await expect(
      blockGroup(page, "Button").getByRole("toolbar", { name: "Block tools" })
    ).toBeVisible();
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

  test("hides its toolbar while one of its Blocks is selected, even on hover", async ({
    page,
  }) => {
    await page.goto("/");
    await setValue(page, emailWith([[["A"]], [["B"]]]));
    await page.mouse.move(0, 0);

    await blockGroup(page, "Text").last().focus();
    await canvas(page)
      .locator(".row")
      .nth(1)
      .hover({ position: { x: 4, y: 4 } });

    await expect(rowTools(page, 2)).toHaveCSS("opacity", "0");
    // Its tag still shows, and selects the Row, which brings the toolbar back.
    const tag = canvas(page).locator(".row-frame").nth(1).locator(".row-tag");
    await expect(tag).toHaveCSS("opacity", "1");
    await tag.click();
    await expect(rowTools(page, 2)).toHaveCSS("opacity", "1");
    await expect(selectRowButton(page, 2)).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("its toolbar is reached by Tab from a selected Block", async ({
    page,
  }) => {
    await page.goto("/");
    await setValue(page, emailWith([[["A"]], [["B"]]]));
    await blockGroup(page, "Text").last().focus();

    await page.keyboard.press("Shift+Tab");

    // One stop for the whole toolbar, at its first tool.
    await expect(selectRowButton(page, 2)).toBeFocused();
    await expect(rowTools(page, 2)).toHaveCSS("opacity", "1");
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
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(
      rowTools(page, 2).getByRole("button", { name: "Delete Row" })
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(structure(page)).resolves.toEqual([[["A"]]]);
  });
});

test.describe("an empty Column", () => {
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
    const document = emailWith([[["A"]], [[]], [[]]]);
    document.settings.language = "de";
    document.rows[2]?.columns[0]?.blocks.push(
      { id: "button", props: { label: "Los" }, type: "button" },
      {
        id: "image",
        props: { alt: "Logo", src: "https://cdn.example/logo.png" },
        type: "image",
      }
    );
    await setValue(page, document);
    await textBlock(page).click();

    const langs = await canvas(page).evaluate((host) => {
      const root = host.shadowRoot as ShadowRoot;
      const langOf = (selector: string) =>
        root.querySelector(selector)?.closest("[lang]")?.getAttribute("lang");
      return {
        block: langOf(".block"),
        blockTools: langOf(".block-toolbar"),
        button: langOf(".button"),
        formatBar: langOf(".format-bar"),
        imageAlt: langOf(".image-block img"),
        placeholder: langOf(".placeholder"),
        rowTools: langOf(".row-toolbar"),
        sidePanel: langOf(".side-panel"),
        status: langOf('[role="status"]'),
        text: langOf(".ProseMirror"),
      };
    });

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
    });
  });

  test("is unknown on the content of an email that has none", async ({
    page,
  }) => {
    await page.goto("/");
    await setValue(page, emailWith([[["A"]]]));

    await expect(textBlock(page)).toBeVisible();

    const lang = await canvas(page).evaluate((host) =>
      host.shadowRoot
        ?.querySelector(".ProseMirror")
        ?.closest("[lang]")
        ?.getAttribute("lang")
    );

    expect(lang).toBe("");
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
  test("sits at the bottom left of the canvas", async ({ page }) => {
    await openBlocks(page, ["text"]);
    const toolbar = canvas(page).getByRole("group", { name: "Email tools" });

    const box = await boxOf(toolbar);
    const area = await boxOf(canvas(page).locator(".canvas-area"));
    const panel = await boxOf(canvas(page).locator(".side-panel"));
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
      const toolbar = root.querySelector(".floating-toolbar") as Element;
      const email = root.querySelector(".email") as Element;
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
  // The test host's unfriendly CSS pushes the canvas far down the page.
  test.use({ viewport: { height: 1600, width: 1280 } });

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

    const area = await boxOf(canvas(page).locator(".canvas-area"));
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
    await page.setViewportSize({ height: 1600, width: 1280 });
    await page.goto("/");
    await setValue(page, emailWith([[["A", "B"]]]));
    await blockGroup(page, "Text").first().focus();
    const handle = await boxOf(blockTools(page).locator(".drag-handle"));
    const area = await boxOf(canvas(page).locator(".canvas-area"));

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
