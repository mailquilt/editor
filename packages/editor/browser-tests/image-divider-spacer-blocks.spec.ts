import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  addBlock,
  addRow,
  blockGroup,
  blockProps,
  blockTypes,
  bottomOf,
  boxOf,
  canvas,
  change,
  drag,
  EXPORT_VIEWPORT,
  setting,
  hostEvents,
  openBlocks,
  openExport,
  rowTag,
  serveImages,
  TALL_VIEWPORT,
  test,
  undo,
  violations,
} from "./helpers.js";

const PHOTO = "https://cdn.example/photo.png";

test.beforeEach(({ context }) => serveImages(context));

test.use({ viewport: TALL_VIEWPORT });

/** An element's size to the nearest pixel. */
const sizeOf = async (locator: Locator) => {
  const { height, width } = await boxOf(locator);
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

const line = (page: Page) =>
  blockGroup(page, "Divider").getByTestId("divider-line");

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
  blockGroup(page, "Spacer").getByTestId("drag-handle");

const makeThin = async (page: Page) => {
  await blockGroup(page, "Spacer").focus();
  await change(await setting(page, "Height (px)"), "1");
};

test.describe("selecting an Image", () => {
  test("is reached with arrow keys, and ignores Enter", async ({ page }) => {
    await openBlocks(page, ["text", "image"]);
    await blockGroup(page, "Text").focus();

    await page.keyboard.press("ArrowDown");
    await expect(blockGroup(page, "Image")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(blockGroup(page, "Image")).toBeFocused();
  });
});

test.describe("an Image", () => {
  test("asks for a URL until it has one", async ({ page }) => {
    await openBlocks(page, ["text"]);
    await addBlock(page, "Image");

    await expect(image(page)).toHaveCount(0);
    await expect(blockGroup(page, "Image")).toContainText("No image URL yet");
  });

  test("shows and exports its URL and alt text", async ({ page }) => {
    await openBlocks(page, ["text"]);
    await addBlock(page, "Image");

    await change(await setting(page, "Image URL"), PHOTO);
    await change(await setting(page, "Alt text"), "A red bicycle");

    await expect(image(page)).toHaveAttribute("src", PHOTO);
    await expect(image(page)).toHaveAttribute("alt", "A red bicycle");
    const { opened } = await openExport(page);
    await expect(
      opened.getByRole("img", { name: "A red bicycle" })
    ).toHaveAttribute("src", PHOTO);
  });

  test("refuses the URL javascript:alert(1), and says so", async ({ page }) => {
    await openBlocks(page, ["image"]);
    await blockGroup(page, "Image").focus();

    // oxlint-disable-next-line no-script-url -- What's being refused.
    await change(await setting(page, "Image URL"), "javascript:alert(1)");

    await expect(await setting(page, "Image URL")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(page.getByRole("alert")).toHaveText(
      /a Merge Tag such as \{\{logo_url\}\}/u
    );
    await expect(blockProps(page)).resolves.toEqual({ src: PHOTO });
  });

  test("offers a link once it has alt text", async ({ page }) => {
    await openBlocks(page, ["image"]);
    await blockGroup(page, "Image").focus();

    await expect(await setting(page, "Link")).toBeDisabled();

    await change(await setting(page, "Alt text"), "A red bicycle");

    await expect(await setting(page, "Link")).toBeEnabled();
    await change(await setting(page, "Link"), "https://shop.example");
    await expect(blockProps(page)).resolves.toEqual({
      alt: "A red bicycle",
      href: "https://shop.example",
      src: PHOTO,
    });
  });

  test("keeps its alt text while it has a link, and says why", async ({
    page,
  }) => {
    await openBlocks(page, ["image"]);
    await blockGroup(page, "Image").focus();
    await change(await setting(page, "Alt text"), "A red bicycle");
    await change(await setting(page, "Link"), "https://shop.example");

    await change(await setting(page, "Alt text"), "");

    await expect(await setting(page, "Alt text")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(page.getByRole("alert")).toContainText("remove the link");
    await expect(blockProps(page)).resolves.toMatchObject({
      alt: "A red bicycle",
    });

    // What was refused is fine now, with nothing more to do in its field.
    await change(await setting(page, "Link"), "");

    await expect(blockProps(page)).resolves.toEqual({ src: PHOTO });
    await expect(await setting(page, "Alt text")).toHaveAttribute(
      "aria-invalid",
      "false"
    );
    await expect(await setting(page, "Link")).toBeDisabled();

    await undo(page);

    await expect(blockProps(page)).resolves.toEqual({
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
    await openBlocks(page, ["image"]);
    await blockGroup(page, "Image").focus();

    await change(await setting(page, "Image URL"), missing);

    await expect(blockGroup(page, "Image")).toContainText(
      `Couldn't load ${missing}`
    );
    await expect(image(page)).toHaveCount(0);
    // The stand-in's least height, 120px, and the Block's 16px padding above and below.
    await expect(sizeOf(blockGroup(page, "Image"))).resolves.toMatchObject({
      height: 152,
    });

    await change(await setting(page, "Image URL"), PHOTO);

    await expect(image(page)).toHaveAttribute("src", PHOTO);

    // Once the URL works, an email the host passes in shows it. The test host
    // passes its own email back after each change, so that comes first.
    await expect(page.getByTestId("latest-document")).toContainText(PHOTO);
    await context.unroute(missing);
    await canvas(page).evaluate((element, src) => {
      const editor = element as MailQuilt;
      const email = editor.value as NonNullable<MailQuilt["value"]>;
      const block = email.rows[0]?.columns[0]?.blocks[0] as { props: object };
      block.props = { src };
      editor.value = email;
    }, missing);

    await expect(image(page)).toHaveAttribute("src", missing);
  });

  test("tries a URL that failed again when it's entered again later", async ({
    context,
    page,
  }) => {
    const missing = "https://cdn.example/missing.png";
    await context.route(missing, (route) => route.abort());
    await openBlocks(page, ["image"]);
    await blockGroup(page, "Image").focus();
    await change(await setting(page, "Image URL"), missing);
    await expect(blockGroup(page, "Image")).toContainText(
      `Couldn't load ${missing}`
    );

    await change(await setting(page, "Image URL"), PHOTO);
    await expect(image(page)).toHaveAttribute("src", PHOTO);

    // As if it had finished uploading.
    await context.unroute(missing);
    await change(await setting(page, "Image URL"), missing);

    await expect(image(page)).toHaveAttribute("src", missing);
  });

  test("tries a URL that failed again when it's typed in again", async ({
    context,
    page,
  }) => {
    const missing = "https://cdn.example/missing.png";
    await context.route(missing, (route) => route.abort());
    await openBlocks(page, ["image"]);
    await blockGroup(page, "Image").focus();
    await change(await setting(page, "Image URL"), missing);
    await expect(blockGroup(page, "Image")).toContainText(
      `Couldn't load ${missing}`
    );

    // As if it had finished uploading.
    await context.unroute(missing);
    const url = await setting(page, "Image URL");
    await url.clear();
    await change(await setting(page, "Image URL"), missing);

    await expect(image(page)).toHaveAttribute("src", missing);
  });

  test("takes a Merge Tag as its URL and link", async ({ page }) => {
    await openBlocks(page, ["image"]);
    await blockGroup(page, "Image").focus();

    await change(await setting(page, "Image URL"), "{{logo_url}}");
    await change(await setting(page, "Alt text"), "{{company}} logo");
    await change(await setting(page, "Link"), "{{site_url}}");

    // There's nothing to load yet, and a request for it would only fail.
    await expect(image(page)).toHaveCount(0);
    await expect(blockGroup(page, "Image")).toContainText("{{logo_url}}");
    await expect(blockProps(page)).resolves.toEqual({
      alt: "{{company}} logo",
      href: "{{site_url}}",
      src: "{{logo_url}}",
    });
  });

  test("links only in the export, as a click on the canvas selects it", async ({
    page,
  }) => {
    await openBlocks(page, ["text", "image"]);
    await blockGroup(page, "Image").focus();
    await change(await setting(page, "Alt text"), "A red bicycle");
    await change(await setting(page, "Link"), "https://shop.example");

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
    await openBlocks(page, ["image"]);
    const drags = await hostEvents(page, "dragstart", []);
    const { x, y } = await boxOf(image(page));

    await page.mouse.move(x + 200, y + 200);
    await page.mouse.down();
    await page.mouse.move(x + 260, y + 260, { steps: 5 });
    await page.mouse.up();

    expect(await drags()).toStrictEqual([]);
  });

  test("fills its Column, on the canvas and in the export", async ({
    page,
  }) => {
    await openBlocks(page, ["image"]);

    const onCanvas = await sizeOf(image(page));
    const { opened } = await openExport(page, EXPORT_VIEWPORT);

    // A 600px email, less the Block's 16px padding on each side.
    expect(onCanvas).toEqual({ height: 568, width: 568 });
    await expect(sizeOf(opened.locator("img"))).resolves.toEqual(onCanvas);
  });

  test("has its width set, centered, on the canvas and in the export", async ({
    page,
  }) => {
    await openBlocks(page, ["image"]);
    await blockGroup(page, "Image").focus();

    await change(await setting(page, "Width (px)"), "120");

    const onCanvas = await sizeOf(image(page));
    expect(onCanvas).toEqual({ height: 120, width: 120 });
    await expect(offCenter(image(page), '[data-testid="email"]')).resolves.toBe(
      0
    );

    const { opened } = await openExport(page, EXPORT_VIEWPORT);
    const exported = opened.locator("img");
    await expect(sizeOf(exported)).resolves.toEqual(onCanvas);
    await expect(offCenter(exported, "body")).resolves.toBe(0);
  });

  test("stops at a narrow Column's width, on the canvas and in the export", async ({
    page,
  }) => {
    await openBlocks(page, ["image"], ["text"]);
    await blockGroup(page, "Image").focus();

    await change(await setting(page, "Width (px)"), "5000");

    const onCanvas = await sizeOf(image(page));
    const { opened } = await openExport(page, EXPORT_VIEWPORT);

    // Half a 600px email, less the Block's 16px padding on each side.
    expect(onCanvas).toEqual({ height: 268, width: 268 });
    await expect(sizeOf(opened.locator("img"))).resolves.toEqual(onCanvas);
  });

  // Its Width is a number field with nothing saved, where what isn't a number
  // reads as empty too.
  test("Escape clears what isn't a number from an empty Width", async ({
    page,
  }) => {
    await openBlocks(page, ["image"]);
    await blockGroup(page, "Image").focus();
    const width = await setting(page, "Width (px)");
    const isBadInput = () =>
      width.evaluate((element: HTMLInputElement) => element.validity.badInput);
    await width.click();
    await page.keyboard.type("-");
    expect(await isBadInput()).toBe(true);

    await page.keyboard.press("Escape");

    expect(await isBadInput()).toBe(false);
  });

  test("scrolling over the focused Width leaves it as it is, with focus still in its popover", async ({
    page,
  }) => {
    await openBlocks(page, ["image"]);
    await blockGroup(page, "Image").focus();
    const width = await setting(page, "Width (px)");
    await change(width, "100");

    await width.focus();
    await width.hover();
    await page.mouse.wheel(0, -200);

    await expect(
      canvas(page).getByRole("dialog", { name: "Width" })
    ).toBeFocused();
    await expect(width).toHaveValue("100");
  });

  test("takes up the same space on the canvas as in the export", async ({
    page,
  }) => {
    await openBlocks(page, ["image", "text"]);
    await blockGroup(page, "Image").focus();
    await change(await setting(page, "Width (px)"), "100");

    const onCanvas = await space(
      blockGroup(page, "Image"),
      blockGroup(page, "Text")
    );
    const { opened } = await openExport(page);

    await expect(
      space(
        opened.locator("img").locator("xpath=ancestor::tr[2]"),
        opened.getByText("Words").locator("xpath=ancestor::tr[1]")
      )
    ).resolves.toBe(onCanvas);
  });
});

test.describe("a Divider", () => {
  test("changes color and thickness, on the canvas and in the export", async ({
    page,
  }) => {
    await openBlocks(page, ["divider"]);
    await blockGroup(page, "Divider").focus();

    await change(await setting(page, "Color"), "#ff0000");
    await change(await setting(page, "Thickness (px)"), "6");

    const onCanvas = await look(line(page));
    const { opened } = await openExport(page, EXPORT_VIEWPORT);

    expect(onCanvas).toMatchObject({
      borderTopColor: "rgb(255, 0, 0)",
      borderTopWidth: "6px",
      height: 6,
    });
    await expect(look(opened.locator("p"))).resolves.toEqual(onCanvas);
  });
});

test.describe("a Spacer", () => {
  test("changes height, on the canvas and in the export", async ({ page }) => {
    await openBlocks(page, ["spacer"]);
    await blockGroup(page, "Spacer").focus();

    await change(await setting(page, "Height (px)"), "70");

    await expect(sizeOf(blockGroup(page, "Spacer"))).resolves.toMatchObject({
      height: 70,
    });
    const { opened } = await openExport(page);
    await expect(sizeOf(exportedSpace(opened))).resolves.toMatchObject({
      height: 70,
    });
  });

  test("can be clicked on when it's as thin as it gets", async ({ page }) => {
    await openBlocks(page, ["text", "spacer"]);
    await makeThin(page);
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
    await openBlocks(page, ["text", "spacer"]);
    const { height, width } = await sizeOf(blockGroup(page, "Text"));

    await expect(
      takesClickAt(blockGroup(page, "Text"), width / 2, height - 3)
    ).resolves.toBeTruthy();
  });

  test("leaves the next Row's tag its clicks, as thin as it gets", async ({
    page,
  }) => {
    await openBlocks(page, ["spacer"]);
    await makeThin(page);
    await addRow(page);
    await blockGroup(page, "Spacer").focus();

    // The next Row's tag shows on hover, over the end of the Spacer's Row.
    await canvas(page)
      .getByTestId("row")
      .nth(1)
      .hover({ position: { x: 300, y: 0 } });
    const { height, width } = await sizeOf(rowTag(page, 2));
    await expect(
      takesClickAt(rowTag(page, 2), width / 2, height / 2)
    ).resolves.toBeTruthy();
  });

  test.describe("as thin as it gets", () => {
    // Its handle fades in, and WebKit in CI has been seen to stop a fade partway
    // until the page is next drawn. Reduced motion turns the fade off.
    test.use({ reducedMotion: "reduce" });

    test("moves by its handle when selected, not what comes next", async ({
      page,
    }) => {
      await openBlocks(page, ["spacer", "text", "heading"]);
      await makeThin(page);

      await drag(
        page,
        spacerHandle(page),
        await bottomOf(blockGroup(page, "Heading"))
      );

      await expect(blockTypes(page)).resolves.toEqual([
        "text",
        "heading",
        "spacer",
      ]);
    });

    test("moves by its handle when selected, with a Row right below", async ({
      page,
    }) => {
      await openBlocks(page, ["spacer"]);
      await makeThin(page);
      await addRow(page);
      await blockGroup(page, "Spacer").focus();

      await drag(
        page,
        spacerHandle(page),
        await bottomOf(
          canvas(page)
            .getByTestId("column")
            .filter({ has: page.getByTestId("placeholder") })
        )
      );

      await expect(blockTypes(page, 0, 0)).resolves.toEqual([]);
      await expect(blockTypes(page, 1, 0)).resolves.toEqual(["spacer"]);
    });

    test("moves by its handle when only hovered", async ({ page }) => {
      await openBlocks(page, ["text", "spacer", "heading"]);
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
      await drag(
        page,
        spacerHandle(page),
        await bottomOf(blockGroup(page, "Heading"))
      );

      await expect(blockTypes(page)).resolves.toEqual([
        "text",
        "heading",
        "spacer",
      ]);
    });

    test("leaves the next Block its own handle, while selected", async ({
      page,
    }) => {
      await openBlocks(page, ["spacer", "text", "heading"]);
      await makeThin(page);
      const text = blockGroup(page, "Text");
      await text.hover();

      await drag(
        page,
        text.getByTestId("drag-handle"),
        await bottomOf(blockGroup(page, "Heading"))
      );

      await expect(blockTypes(page)).resolves.toEqual([
        "spacer",
        "heading",
        "text",
      ]);
    });
  });
});

test.describe("accessibility", () => {
  // One page, each type of Block selected in turn, as tall as the window, so a
  // Block near its bottom has its tools beside the floating toolbar. A selected
  // Text Block and Heading are checked in keyboard.spec.ts.
  test("finds no violations with each type of Block selected, and an Image with no URL", async ({
    page,
  }) => {
    await openBlocks(page, ["image", "divider", "spacer", "button", "text"]);
    const selectable = canvas(page).getByRole("group", {
      name: / Block, Row /u,
    });

    for (const index of [0, 1, 2, 3]) {
      await selectable.nth(index).focus();
      await expect(violations(page)).resolves.toEqual([]);
    }

    await addBlock(page, "Image");
    await expect(
      blockGroup(page, "Image").filter({ hasText: "No image URL yet" })
    ).toBeVisible();
    await expect(violations(page)).resolves.toEqual([]);
  });

  test("finds no problem with an exported email of each type of Block", async ({
    page,
  }) => {
    await openBlocks(page, [
      "heading",
      "text",
      "button",
      "image",
      "divider",
      "spacer",
    ]);
    await blockGroup(page, "Button").focus();
    await change(await setting(page, "Link"), "https://shop.example");
    await blockGroup(page, "Image").focus();
    await change(await setting(page, "Alt text"), "A red bicycle");
    await change(await setting(page, "Link"), "https://shop.example");
    const { opened } = await openExport(page);

    await expect(
      opened.getByRole("heading", { level: 2, name: "Sale" })
    ).toBeVisible();
    await expect(opened.getByRole("link", { name: "Buy" })).toBeVisible();
    await expect(
      opened.getByRole("img", { name: "A red bicycle" })
    ).toBeVisible();
    expect(
      await violations(opened, "html", {
        // MJML writes an empty <title> for every email, whatever its Blocks.
        skipRules: ["document-title"],
      })
    ).toEqual([]);
  });
});
