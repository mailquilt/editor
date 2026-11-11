import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { BrowserContext, Locator, Page } from "@playwright/test";

import {
  addRow,
  blockGroup,
  blocks,
  blockTypes,
  canvas,
  change,
  dragTo,
  exportHtml,
  field,
  openBlocks as open,
  openExport,
  palette,
  redo,
  rowTools,
  settle,
  undo,
  violations,
} from "./helpers.js";

const PHOTO = "https://cdn.example/photo.png";

/** A 1×1 PNG, which any box scales it to: its height shows its width was kept. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64"
);

/** The whole context, so that an export opened in a new page has images too. */
const serveImages = (context: BrowserContext) =>
  context.route("https://cdn.example/**", (route) =>
    route.fulfill({ body: PIXEL, contentType: "image/png" })
  );

test.beforeEach(({ context }) => serveImages(context));

// The test host's unfriendly CSS pushes the canvas far down the page.
test.use({ viewport: { height: 1600, width: 1280 } });

const firstBlockProps = async (page: Page) => {
  const found = await blocks(page);
  return found[0]?.props;
};

const box = async (locator: Locator) => {
  const { height, width } = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { height: rect.height, width: rect.width };
  });
  return { height: Math.round(height), width: Math.round(width) };
};

/** How far the middle of an element is from the middle of what's around it. */
const offCenter = (locator: Locator, around: string) =>
  locator.evaluate((element, selector) => {
    const outer = element.closest(selector) as Element;
    const inner = element.getBoundingClientRect();
    const { width, x } = outer.getBoundingClientRect();
    return Math.round(inner.x + inner.width / 2 - (x + width / 2));
  }, around);

const image = (page: Page) => blockGroup(page, "Image").locator("img");

/** How far down it is from one element to the next. */
const space = async (from: Locator, to: Locator) => {
  const [{ y }, { y: end }] = await Promise.all([
    from.evaluate((element) => element.getBoundingClientRect()),
    to.evaluate((element) => element.getBoundingClientRect()),
  ]);
  return Math.round(end - y);
};

const line = (page: Page) => blockGroup(page, "Divider").locator(".divider");

/** The line, and what it's made of. */
const look = (locator: Locator) =>
  locator.evaluate((element) => {
    const { borderTopColor, borderTopWidth } = getComputedStyle(element);
    const { height, width } = element.getBoundingClientRect();
    return { borderTopColor, borderTopWidth, height, width };
  });

const exportedSpace = (opened: Page) =>
  opened.locator("td > div[style*='line-height']");

/** Whether a click at this point inside an element would land in that element. */
const takesClickAt = (locator: Locator, offsetX: number, offsetY: number) =>
  locator.evaluate(
    (element, [dx, dy]) => {
      const { x, y } = element.getBoundingClientRect();
      const root = element.getRootNode() as ShadowRoot;
      return element.contains(
        root.elementFromPoint(x + (dx ?? 0), y + (dy ?? 0))
      );
    },
    [offsetX, offsetY]
  );

const spacerHandle = (page: Page) =>
  blockGroup(page, "Spacer").locator(".drag-handle");

const makeThin = async (page: Page) => {
  await blockGroup(page, "Spacer").focus();
  await change(field(page, "Height (px)"), "1");
};

test.describe("the palette", () => {
  test("offers every type of Block", async ({ page }) => {
    await open(page, ["text"]);

    await expect(
      page.getByRole("group", { name: "Add content" }).getByRole("button")
    ).toHaveText(["Text", "Heading", "Image", "Button", "Divider", "Spacer"]);
  });

  test("adds an Image, selected, and undoes and redoes it", async ({
    page,
  }) => {
    await open(page, ["text"]);

    await palette(page, "Image").click();

    await expect(blockGroup(page, "Image")).toBeFocused();
    await expect(blockTypes(page)).resolves.toEqual(["text", "image"]);

    await undo(page);
    await expect(blockTypes(page)).resolves.toEqual(["text"]);

    await redo(page);
    await expect(blockTypes(page)).resolves.toEqual(["text", "image"]);
  });
});

test.describe("moving an Image", () => {
  test("by its handle, within a Column", async ({ page }) => {
    await open(page, ["text", "image"]);
    const block = blockGroup(page, "Image");
    await block.hover();

    await dragTo(
      page,
      block.locator(".drag-handle"),
      blockGroup(page, "Text"),
      0.25
    );

    await expect(blockTypes(page)).resolves.toEqual(["image", "text"]);

    await undo(page);
    await expect(blockTypes(page)).resolves.toEqual(["text", "image"]);
  });

  test("by its handle, to another Column", async ({ page }) => {
    await open(page, ["image"], []);
    const block = blockGroup(page, "Image");
    await block.hover();

    await dragTo(
      page,
      block.locator(".drag-handle"),
      canvas(page).locator(".column").nth(1)
    );

    await expect(blockTypes(page, 0, 1)).resolves.toEqual(["image"]);
    await expect(blockTypes(page, 0, 0)).resolves.toEqual([]);
  });

  test("by keyboard", async ({ page }) => {
    await open(page, ["text", "image"]);
    await blockGroup(page, "Image").focus();

    await page.keyboard.press("Alt+ArrowUp");

    await expect(blockTypes(page)).resolves.toEqual(["image", "text"]);
    await expect(blockGroup(page, "Image")).toBeFocused();
    await expect(canvas(page).getByRole("status")).toHaveText(
      "Moved to Row 1, Column 1, position 1 of 2."
    );

    await page.keyboard.press("ControlOrMeta+z");
    await expect(blockTypes(page)).resolves.toEqual(["text", "image"]);
  });

  test("is reached with arrow keys, and ignores Enter", async ({ page }) => {
    await open(page, ["text", "image"]);
    await blockGroup(page, "Text").focus();

    await page.keyboard.press("ArrowDown");
    await expect(blockGroup(page, "Image")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(blockGroup(page, "Image")).toBeFocused();
  });

  test("can be deleted, and comes back with undo", async ({ page }) => {
    await open(page, ["text", "image"]);
    await blockGroup(page, "Image").focus();

    await page.getByRole("button", { name: "Delete Block" }).click();
    await expect(blockTypes(page)).resolves.toEqual(["text"]);

    await undo(page);
    await expect(blockTypes(page)).resolves.toEqual(["text", "image"]);
    await expect(blockGroup(page, "Image")).toBeVisible();
  });
});

test.describe("dragging a tall Block", () => {
  test("keeps the page where it is, scrolled to its end", async ({ page }) => {
    await open(page, ["text", "image"]);
    const block = blockGroup(page, "Image");
    await block.hover();
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    );
    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled).toBeGreaterThan(0);
    const start = (await block
      .locator(".drag-handle")
      .boundingBox()) as DOMRect;

    await page.mouse.move(start.x + 8, start.y + 12);
    await page.mouse.down();
    await page.mouse.move(start.x + 16, start.y + 20, { steps: 2 });
    await settle(page);

    await expect(page.evaluate(() => window.scrollY)).resolves.toBe(scrolled);
    await page.mouse.up();
  });
});

test.describe("an Image", () => {
  test("asks for a URL until it has one, and exports nothing", async ({
    page,
  }) => {
    await open(page, ["text"]);
    await palette(page, "Image").click();

    await expect(image(page)).toHaveCount(0);
    await expect(blockGroup(page, "Image")).toContainText("No image URL yet");
    await expect(exportHtml(page)).resolves.not.toContain("<img");
  });

  test("shows and exports its URL and alt text, and undoes each", async ({
    page,
  }) => {
    await open(page, ["text"]);
    await palette(page, "Image").click();

    await change(field(page, "Image URL"), PHOTO);
    await change(field(page, "Alt text"), "A red bicycle");

    await expect(image(page)).toHaveAttribute("src", PHOTO);
    await expect(image(page)).toHaveAttribute("alt", "A red bicycle");
    const { opened } = await openExport(page);
    await expect(
      opened.getByRole("img", { name: "A red bicycle" })
    ).toHaveAttribute("src", PHOTO);

    await undo(page);
    await expect(image(page)).not.toHaveAttribute("alt", "A red bicycle");

    await undo(page);
    await expect(image(page)).toHaveCount(0);
  });

  test("refuses the URL javascript:alert(1), and says so", async ({ page }) => {
    await open(page, ["image"]);
    await blockGroup(page, "Image").focus();

    // oxlint-disable-next-line no-script-url -- What's being refused.
    await change(field(page, "Image URL"), "javascript:alert(1)");

    await expect(field(page, "Image URL")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(page.getByRole("alert")).toHaveText(
      /a Merge Tag such as \{\{logo_url\}\}/u
    );
    await expect(firstBlockProps(page)).resolves.toEqual({ src: PHOTO });
  });

  test("refuses the link javascript:alert(1), and says so", async ({
    page,
  }) => {
    await open(page, ["image"]);
    await blockGroup(page, "Image").focus();
    await change(field(page, "Alt text"), "A red bicycle");

    // oxlint-disable-next-line no-script-url -- What's being refused.
    await change(field(page, "Link"), "javascript:alert(1)");

    await expect(field(page, "Link")).toHaveAttribute("aria-invalid", "true");
    await expect(firstBlockProps(page)).resolves.toEqual({
      alt: "A red bicycle",
      src: PHOTO,
    });
  });

  test("offers a link once it has alt text", async ({ page }) => {
    await open(page, ["image"]);
    await blockGroup(page, "Image").focus();

    await expect(field(page, "Link")).toBeDisabled();

    await change(field(page, "Alt text"), "A red bicycle");

    await expect(field(page, "Link")).toBeEnabled();
    await change(field(page, "Link"), "https://shop.example");
    await expect(firstBlockProps(page)).resolves.toEqual({
      alt: "A red bicycle",
      href: "https://shop.example",
      src: PHOTO,
    });
  });

  test("keeps its alt text while it has a link, and says why", async ({
    page,
  }) => {
    await open(page, ["image"]);
    await blockGroup(page, "Image").focus();
    await change(field(page, "Alt text"), "A red bicycle");
    await change(field(page, "Link"), "https://shop.example");

    await change(field(page, "Alt text"), "");

    await expect(field(page, "Alt text")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(page.getByRole("alert")).toContainText("remove the link");
    await expect(firstBlockProps(page)).resolves.toMatchObject({
      alt: "A red bicycle",
    });

    // What was refused is fine now, with nothing more to do in its field.
    await change(field(page, "Link"), "");

    await expect(firstBlockProps(page)).resolves.toEqual({ src: PHOTO });
    await expect(field(page, "Alt text")).toHaveAttribute(
      "aria-invalid",
      "false"
    );
    await expect(field(page, "Link")).toBeDisabled();

    await undo(page);

    await expect(firstBlockProps(page)).resolves.toEqual({
      alt: "A red bicycle",
      src: PHOTO,
    });
  });

  test("says so when its URL can't be loaded, and recovers with a new one", async ({
    context,
    page,
  }) => {
    const missing = "https://cdn.example/missing.png";
    await context.route(missing, (route) => route.abort());
    await open(page, ["image"]);
    await blockGroup(page, "Image").focus();

    await change(field(page, "Image URL"), missing);

    await expect(blockGroup(page, "Image")).toContainText(
      `Couldn't load ${missing}`
    );
    await expect(image(page)).toHaveCount(0);
    await expect(box(blockGroup(page, "Image"))).resolves.toMatchObject({
      height: 152,
    });
    await expect(exportHtml(page)).resolves.toContain(`src="${missing}"`);

    await change(field(page, "Image URL"), PHOTO);

    await expect(image(page)).toHaveAttribute("src", PHOTO);
  });

  test("takes a Merge Tag as its URL and link, as far as the export", async ({
    page,
  }) => {
    await open(page, ["image"]);
    await blockGroup(page, "Image").focus();

    await change(field(page, "Image URL"), "{{logo_url}}");
    await change(field(page, "Alt text"), "{{company}} logo");
    await change(field(page, "Link"), "{{site_url}}");

    // There's nothing to load yet, and a request for it would only fail.
    await expect(image(page)).toHaveCount(0);
    await expect(blockGroup(page, "Image")).toContainText("{{logo_url}}");
    const html = await exportHtml(page);
    expect(html).toContain('src="{{logo_url}}"');
    expect(html).toContain('href="{{site_url}}"');
  });

  test("links only in the export, as a click on the canvas selects it", async ({
    page,
  }) => {
    await open(page, ["text", "image"]);
    await blockGroup(page, "Image").focus();
    await change(field(page, "Alt text"), "A red bicycle");
    await change(field(page, "Link"), "https://shop.example");

    await expect(blockGroup(page, "Image").locator("a")).toHaveCount(0);
    await blockGroup(page, "Text").focus();

    await image(page).click();

    await expect(blockGroup(page, "Image")).toBeFocused();
    await expect(page).not.toHaveURL(/shop\.example/u);

    const { opened } = await openExport(page);
    await expect(opened.getByRole("link")).toHaveAttribute(
      "href",
      "https://shop.example"
    );
  });

  test("isn't picked up by the browser when dragged across", async ({
    page,
  }) => {
    await open(page, ["image"]);
    await page.evaluate(() => {
      window.addEventListener("dragstart", () => {
        document.body.dataset.dragged = "true";
      });
    });
    const { x, y } = (await image(page).boundingBox()) as DOMRect;

    await page.mouse.move(x + 200, y + 200);
    await page.mouse.down();
    await page.mouse.move(x + 260, y + 260, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator("body")).not.toHaveAttribute("data-dragged");
  });

  test("fills its Column, on the canvas and in the export", async ({
    page,
  }) => {
    await open(page, ["image"]);

    const onCanvas = await box(image(page));
    const { opened } = await openExport(page);
    await opened.setViewportSize({ height: 800, width: 800 });

    expect(onCanvas).toEqual({ height: 568, width: 568 });
    await expect(box(opened.locator("img"))).resolves.toEqual(onCanvas);
  });

  test("has its width set, centered, on the canvas and in the export", async ({
    page,
  }) => {
    await open(page, ["image"]);
    await blockGroup(page, "Image").focus();

    await change(field(page, "Width (px)"), "120");

    const onCanvas = await box(image(page));
    expect(onCanvas).toEqual({ height: 120, width: 120 });
    await expect(offCenter(image(page), ".email")).resolves.toBe(0);

    const { opened } = await openExport(page);
    await opened.setViewportSize({ height: 800, width: 800 });
    const exported = opened.locator("img");
    await expect(box(exported)).resolves.toEqual(onCanvas);
    await expect(offCenter(exported, "body")).resolves.toBe(0);
  });

  test("stops at a narrow Column's width, on the canvas and in the export", async ({
    page,
  }) => {
    await open(page, ["image"], ["text"]);
    await blockGroup(page, "Image").focus();

    await change(field(page, "Width (px)"), "5000");

    const onCanvas = await box(image(page));
    const { opened } = await openExport(page);
    await opened.setViewportSize({ height: 800, width: 800 });

    expect(onCanvas).toEqual({ height: 268, width: 268 });
    await expect(box(opened.locator("img"))).resolves.toEqual(onCanvas);
  });

  test("goes back to filling its Column when the width is cleared", async ({
    page,
  }) => {
    await open(page, ["image"]);
    await blockGroup(page, "Image").focus();
    await change(field(page, "Width (px)"), "120");

    await change(field(page, "Width (px)"), "");

    await expect(firstBlockProps(page)).resolves.toEqual({ src: PHOTO });
    await expect(box(image(page))).resolves.toMatchObject({ width: 568 });
  });

  test("takes up the same space on the canvas as in the export", async ({
    page,
  }) => {
    await open(page, ["image", "text"]);
    await blockGroup(page, "Image").focus();
    await change(field(page, "Width (px)"), "100");

    const onCanvas = await space(
      blockGroup(page, "Image"),
      blockGroup(page, "Text")
    );
    const { opened } = await openExport(page);

    expect(onCanvas).toBe(132);
    await expect(
      space(
        opened.locator("img").locator("xpath=ancestor::tr[2]"),
        opened.getByText("Words").locator("xpath=ancestor::tr[1]")
      )
    ).resolves.toBe(onCanvas);
  });
});

test.describe("a Divider", () => {
  test("looks the same on the canvas and in the export, as it starts", async ({
    page,
  }) => {
    await open(page, ["divider"]);

    const onCanvas = await look(line(page));
    const { opened } = await openExport(page);
    await opened.setViewportSize({ height: 800, width: 800 });

    expect(onCanvas).toEqual({
      borderTopColor: "rgb(212, 212, 216)",
      borderTopWidth: "1px",
      height: 1,
      width: 568,
    });
    await expect(look(opened.locator("p"))).resolves.toEqual(onCanvas);
  });

  test("changes color and thickness, on the canvas and in the export", async ({
    page,
  }) => {
    await open(page, ["divider"]);
    await blockGroup(page, "Divider").focus();

    await change(field(page, "Color"), "#ff0000");
    await change(field(page, "Thickness (px)"), "6");

    const onCanvas = await look(line(page));
    const { opened } = await openExport(page);
    await opened.setViewportSize({ height: 800, width: 800 });

    expect(onCanvas).toMatchObject({
      borderTopColor: "rgb(255, 0, 0)",
      borderTopWidth: "6px",
      height: 6,
    });
    await expect(look(opened.locator("p"))).resolves.toEqual(onCanvas);
  });

  test("refuses a thickness of 0, and says so", async ({ page }) => {
    await open(page, ["divider"]);
    await blockGroup(page, "Divider").focus();

    await change(field(page, "Thickness (px)"), "0");

    await expect(field(page, "Thickness (px)")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(page.getByRole("alert")).toHaveText(
      "Use a whole number from 1 to 100."
    );
  });
});

test.describe("a Spacer", () => {
  test("has the same height on the canvas and in the export", async ({
    page,
  }) => {
    await open(page, ["spacer"]);

    const onCanvas = await box(blockGroup(page, "Spacer"));
    const { opened } = await openExport(page);

    expect(onCanvas.height).toBe(24);
    await expect(box(exportedSpace(opened))).resolves.toMatchObject({
      height: 24,
    });
  });

  test("changes height, on the canvas and in the export, and undoes it", async ({
    page,
  }) => {
    await open(page, ["spacer"]);
    await blockGroup(page, "Spacer").focus();

    await change(field(page, "Height (px)"), "70");

    await expect(box(blockGroup(page, "Spacer"))).resolves.toMatchObject({
      height: 70,
    });
    const { opened } = await openExport(page);
    await expect(box(exportedSpace(opened))).resolves.toMatchObject({
      height: 70,
    });

    await undo(page);
    await expect(firstBlockProps(page)).resolves.toEqual({});
    await expect(box(blockGroup(page, "Spacer"))).resolves.toMatchObject({
      height: 24,
    });
  });

  test("can be clicked on when it's as thin as it gets", async ({ page }) => {
    await open(page, ["text", "spacer"]);
    await blockGroup(page, "Spacer").focus();
    await change(field(page, "Height (px)"), "1");
    await blockGroup(page, "Text").focus();
    const { x, y, width } = await blockGroup(page, "Spacer").evaluate(
      (element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, x: rect.x, y: rect.y };
      }
    );

    // Just above the line, as a pointer can't be sure of one pixel.
    await page.mouse.click(x + width / 2, y - 3);

    await expect(blockGroup(page, "Spacer")).toBeFocused();
  });

  test("leaves the Block next to it its clicks, once it's tall enough", async ({
    page,
  }) => {
    await open(page, ["text", "spacer"]);
    const { height, width } = await box(blockGroup(page, "Text"));

    await expect(
      takesClickAt(blockGroup(page, "Text"), width / 2, height - 3)
    ).resolves.toBeTruthy();
  });

  test("leaves its Row's toolbar its clicks, as thin as it gets", async ({
    page,
  }) => {
    await open(page, ["spacer"]);
    await makeThin(page);
    await addRow(page);
    await blockGroup(page, "Spacer").focus();
    const selectRowIn = (position: number) =>
      rowTools(page, position).getByRole("button", { name: "Select Row" });
    const takesClicks = async (position: number) => {
      const { height, width } = await box(selectRowIn(position));
      return takesClickAt(selectRowIn(position), width / 2, height / 2);
    };

    // A Row's toolbar takes clicks once it shows, on hover.
    await canvas(page)
      .locator(".row")
      .nth(1)
      .hover({ position: { x: 300, y: 0 } });
    await expect(takesClicks(2)).resolves.toBeTruthy();

    // The Spacer's own Row shows its toolbar once its tag selects the Row.
    await canvas(page)
      .locator(".row")
      .first()
      .hover({ position: { x: 300, y: 0 } });
    await canvas(page).locator(".row-tag").first().click();
    await expect(takesClicks(1)).resolves.toBeTruthy();
  });

  test.describe("as thin as it gets", () => {
    test("moves by its handle when selected, not what comes next", async ({
      page,
    }) => {
      await open(page, ["spacer", "text", "heading"]);
      await makeThin(page);

      await dragTo(page, spacerHandle(page), blockGroup(page, "Heading"));

      await expect(blockTypes(page)).resolves.toEqual([
        "text",
        "heading",
        "spacer",
      ]);
    });

    test("moves by its handle when selected, with a Row right below", async ({
      page,
    }) => {
      await open(page, ["spacer"]);
      await makeThin(page);
      await addRow(page);
      await blockGroup(page, "Spacer").focus();

      await dragTo(
        page,
        spacerHandle(page),
        canvas(page).locator(".column.empty")
      );

      await expect(blockTypes(page, 0, 0)).resolves.toEqual([]);
      await expect(blockTypes(page, 1, 0)).resolves.toEqual(["spacer"]);
    });

    test("moves by its handle when only hovered", async ({ page }) => {
      await open(page, ["text", "spacer", "heading"]);
      await makeThin(page);
      await blockGroup(page, "Text").focus();
      const { x, y, width } = await blockGroup(page, "Spacer").evaluate(
        (element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, x: rect.x, y: rect.y };
        }
      );

      // Along the line, as a pointer finds the handle by finding the Spacer.
      await page.mouse.move(x + width / 2, y);
      await page.mouse.move(x + 8, y, { steps: 8 });
      await expect(spacerHandle(page)).toHaveCSS("opacity", "1");
      await dragTo(page, spacerHandle(page), blockGroup(page, "Heading"));

      await expect(blockTypes(page)).resolves.toEqual([
        "text",
        "heading",
        "spacer",
      ]);
    });

    test("leaves the next Block its own handle, while selected", async ({
      page,
    }) => {
      await open(page, ["spacer", "text", "heading"]);
      await makeThin(page);
      const text = blockGroup(page, "Text");
      await text.hover();

      await dragTo(
        page,
        text.locator(".drag-handle"),
        blockGroup(page, "Heading")
      );

      await expect(blockTypes(page)).resolves.toEqual([
        "spacer",
        "heading",
        "text",
      ]);
    });
  });

  test("refuses a height of 0, and says so", async ({ page }) => {
    await open(page, ["spacer"]);
    await blockGroup(page, "Spacer").focus();

    await change(field(page, "Height (px)"), "0");

    await expect(field(page, "Height (px)")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(page.getByRole("alert")).toHaveText(
      "Use a whole number from 1 to 1000."
    );
  });
});

test.describe("the floating toolbar", () => {
  test("stays above the email when the page scrolls it underneath", async ({
    page,
  }) => {
    await open(page, [
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

test.describe("accessibility", () => {
  for (const [name, type] of [
    ["an Image", "image"],
    ["a Divider", "divider"],
    ["a Spacer", "spacer"],
  ] as const) {
    test(`finds no violations with ${name} selected`, async ({ page }) => {
      await open(page, [type, "text"]);
      await canvas(page).locator(".block").first().focus();

      await expect(violations(page)).resolves.toEqual([]);
    });
  }

  test("finds no violations with an Image that has no URL", async ({
    page,
  }) => {
    await open(page, ["text"]);
    await palette(page, "Image").click();

    await expect(violations(page)).resolves.toEqual([]);
  });

  test("finds no problem with an exported Image, Divider and Spacer", async ({
    page,
  }) => {
    await open(page, ["image", "divider", "spacer"]);
    await canvas(page).locator(".block").first().focus();
    await change(field(page, "Alt text"), "A red bicycle");
    await change(field(page, "Link"), "https://shop.example");
    const { opened } = await openExport(page);

    await expect(
      opened.getByRole("img", { name: "A red bicycle" })
    ).toBeVisible();
    const { violations: found } = await new AxeBuilder({ page: opened })
      // MJML writes an empty <title> for every email, whatever its Blocks.
      .disableRules(["document-title"])
      .setLegacyMode()
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(found.map(({ id }) => id)).toEqual([]);
  });
});
