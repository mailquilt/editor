import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  blockGroup,
  blocks,
  blockTypes,
  boxOf,
  canvas,
  change,
  currentValue,
  exportHtml,
  field,
  openBlocks as open,
  openExport,
  palette,
  pasteHtml,
  settle,
  setValue,
  TALL_VIEWPORT,
} from "./helpers.js";

const headingText = (page: Page) =>
  page.getByRole("textbox", { name: "Heading Block" });

/** The part of a Button that looks like one, on the canvas. */
const buttonFace = (page: Page) =>
  blockGroup(page, "Button").getByTestId("button-face");

const lastBlockProps = async (page: Page) => {
  const found = await blocks(page);
  return found.at(-1)?.props;
};

const headingLook = (locator: Locator) =>
  locator.evaluate((element) => {
    const { color, fontSize, fontWeight, textAlign } =
      getComputedStyle(element);
    return { color, fontSize, fontWeight, textAlign };
  });

const buttonLook = (locator: Locator) =>
  locator.evaluate((element) => {
    const {
      backgroundColor,
      borderTopLeftRadius,
      color,
      fontFamily,
      fontSize,
      fontWeight,
      lineHeight,
      paddingLeft,
      paddingTop,
    } = getComputedStyle(element);
    const { height, width, x } = element.getBoundingClientRect();
    return {
      backgroundColor,
      borderTopLeftRadius,
      color,
      fontFamily,
      fontSize,
      fontWeight,
      height,
      lineHeight,
      paddingLeft,
      paddingTop,
      width,
      // Its middle, as the export has no settings panel beside it.
      x: x + width / 2,
    };
  });

/** How far a label's last line, which is short, starts inside its Button. */
const lastLineInset = (face: Locator) =>
  face.evaluate((element) => {
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    const lines = [...range.getClientRects()].filter(({ width }) => width > 0);
    const last = lines.at(-1);
    return Math.round((last?.x ?? 0) - element.getBoundingClientRect().x);
  });

/** Browsers can differ by a fraction of a pixel between two pages. */
const toTenths = (pixels: number) => Math.round(pixels * 10) / 10;

test.use({ viewport: TALL_VIEWPORT });

test.describe("the palette", () => {
  test("adds a Button, selected, with its settings showing", async ({
    page,
  }) => {
    await open(page, ["text"]);

    await palette(page, "Button").click();

    await expect(blockGroup(page, "Button")).toBeFocused();
    await expect(buttonFace(page)).toHaveText("Button");
    await expect(field(page, "Label")).toHaveValue("Button");
    await expect(blockTypes(page)).resolves.toEqual(["text", "button"]);
  });
});

test.describe("a Heading", () => {
  test("changes level, and shows its settings the same on the canvas and in the export", async ({
    page,
  }) => {
    await open(page, ["heading"]);
    await headingText(page).click();
    await expect(field(page, "Font size (px)")).toHaveValue("24");
    await expect(field(page, "Level")).toHaveValue("2");
    await expect(blockGroup(page, "Heading")).toHaveCSS("font-size", "24px");

    await field(page, "Level").selectOption({ label: "Heading 1" });

    await expect(lastBlockProps(page)).resolves.toMatchObject({ level: 1 });
    await expect(field(page, "Font size (px)")).toHaveValue("32");
    await expect(blockGroup(page, "Heading")).toHaveCSS("font-size", "32px");

    await field(page, "Alignment").selectOption("right");
    await change(field(page, "Color"), "#ff0000");
    await change(field(page, "Font size (px)"), "40");

    const expected = {
      color: "rgb(255, 0, 0)",
      fontSize: "40px",
      fontWeight: "700",
      textAlign: "right",
    };

    await expect(headingLook(headingText(page))).resolves.toEqual(expected);
    const { opened } = await openExport(page);
    const exported = opened.getByRole("heading", { level: 1 });
    await expect(exported).toHaveText("Sale");
    await expect(headingLook(exported)).resolves.toEqual(expected);
    await opened.close();
  });

  test("takes up the same space on the canvas as in the export", async ({
    page,
  }) => {
    await open(page, ["heading"]);

    // The canvas's text box has the Block's padding, and the heading doesn't.
    const onCanvas = await headingText(page).evaluate((element) => {
      const { paddingBottom, paddingTop } = getComputedStyle(element);
      return (
        element.getBoundingClientRect().height -
        Number(paddingTop.replace("px", "")) -
        Number(paddingBottom.replace("px", ""))
      );
    });
    const { opened } = await openExport(page);
    const exported = await boxOf(opened.getByRole("heading"));

    expect(toTenths(exported.height)).toBe(toTenths(onCanvas));
  });
});

test.describe("Bold in a Heading, which is already bold", () => {
  test("isn't offered, while the other formats are", async ({ page }) => {
    await open(page, ["heading"]);
    await headingText(page).click();

    await expect(page.getByRole("button", { name: "Bold" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Italic" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Underline" })).toBeEnabled();

    // Alt+F10 goes to the first button that's offered.
    await page.keyboard.press("Alt+F10");
    await expect(page.getByRole("button", { name: "Italic" })).toBeFocused();
  });

  test("is offered again in a Text Block", async ({ page }) => {
    await open(page, ["heading", "text"]);
    await headingText(page).click();
    await page.getByRole("textbox", { name: "Text Block" }).click();

    await expect(page.getByRole("button", { name: "Bold" })).toBeEnabled();
  });

  for (const keys of ["ControlOrMeta+b", "ControlOrMeta+Shift+b"]) {
    test(`does nothing with ${keys}`, async ({ page }) => {
      await open(page, ["heading"]);
      await headingText(page).click();
      await page.keyboard.press("ControlOrMeta+a");

      await page.keyboard.press(keys);
      await settle(page);

      const props = await lastBlockProps(page);
      expect(JSON.stringify(props)).not.toContain("bold");
      await expect(headingText(page).locator("strong")).toHaveCount(0);
    });
  }

  test("is left out of pasted text, which keeps its other formats", async ({
    page,
  }) => {
    await open(page, ["heading"]);
    await headingText(page).click();

    await pasteHtml(headingText(page), "<strong><em>Big</em></strong>");

    await expect(headingText(page).locator("em")).toHaveText("Big");
    const props = await lastBlockProps(page);
    expect(JSON.stringify(props)).toContain("italic");
    expect(JSON.stringify(props)).not.toContain("bold");
  });

  test("stays on a saved Heading that has it, which still opens", async ({
    page,
  }) => {
    await open(page, ["heading"]);
    const email = await currentValue(page);
    const block = email.rows[0]?.columns[0]?.blocks[0];
    if (block?.type === "heading") {
      block.props.content = {
        content: [
          {
            content: [
              { marks: [{ type: "bold" }], text: "Saved", type: "text" },
            ],
            type: "paragraph",
          },
        ],
        type: "doc",
      };
    }

    await setValue(page, email);

    await expect(headingText(page)).toHaveText("Saved");
    await expect(exportHtml(page)).resolves.toContain(
      "<strong>Saved</strong></h2>"
    );
  });
});

test.describe("a Button", () => {
  test("doesn't select its label when dragged across", async ({ page }) => {
    await open(page, ["button"]);
    const box = await boxOf(buttonFace(page));
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, y, {
      steps: 5,
    });
    await page.mouse.up();

    const selected = await page.evaluate(() =>
      (globalThis.getSelection()?.toString() ?? "").trim()
    );
    expect(selected).toBe("");
  });

  test("centers a label that wraps, on the canvas as in the export", async ({
    page,
  }) => {
    await open(page, ["button"], []);
    await blockGroup(page, "Button").focus();
    await change(
      field(page, "Label"),
      "Buy every single thing you see in the shop today"
    );

    const onCanvas = await lastLineInset(buttonFace(page));
    const { opened } = await openExport(page);
    await opened.setViewportSize({ height: 800, width: 800 });
    const exported = await lastLineInset(opened.locator("td[bgcolor] > p"));

    expect(onCanvas).toBeGreaterThan(25);
    expect(onCanvas).toBe(exported);
  });

  test("is selected by a click on it, without going anywhere", async ({
    page,
  }) => {
    await open(page, ["text", "button"]);
    // With a link, which a click could otherwise follow.
    await blockGroup(page, "Button").focus();
    await change(field(page, "Link"), "https://shop.example");
    await blockGroup(page, "Text").focus();
    await expect(field(page, "Label")).toHaveCount(0);
    const url = page.url();

    await buttonFace(page).click();

    await expect(blockGroup(page, "Button")).toHaveAttribute(
      "aria-current",
      "true"
    );
    await expect(field(page, "Label")).toHaveValue("Buy");
    await settle(page);
    expect(page.url()).toBe(url);
  });

  test("describes the keys that work on it, with none for editing text", async ({
    page,
  }) => {
    await open(page, ["button"]);

    await expect(blockGroup(page, "Button")).toHaveAccessibleDescription(
      "Press ArrowUp, ArrowDown, ArrowLeft, or ArrowRight to select another Block, and Alt+ArrowUp, Alt+ArrowDown, Alt+ArrowLeft, or Alt+ArrowRight to move this one."
    );
  });

  test("shows a label as text, whatever it holds", async ({ page }) => {
    await open(page, ["button"]);
    await blockGroup(page, "Button").focus();

    await change(field(page, "Label"), "<img src=x onerror=alert(1)>");

    await expect(buttonFace(page)).toHaveText("<img src=x onerror=alert(1)>");
    await expect(buttonFace(page).locator("img")).toHaveCount(0);
  });

  test("looks the same on the canvas and in the export", async ({ page }) => {
    await open(page, ["button"]);
    await blockGroup(page, "Button").focus();
    await change(field(page, "Link"), "https://shop.example");
    await change(field(page, "Label"), "Buy it all today");
    await change(field(page, "Background color"), "#112233");
    await change(field(page, "Text color"), "#ddeeff");
    await field(page, "Alignment").selectOption("right");

    const onCanvas = await buttonLook(buttonFace(page));
    const email = await canvas(page)
      .getByTestId("email")
      .evaluate((element) => {
        const { width, x } = element.getBoundingClientRect();
        return x + width / 2;
      });
    const { opened } = await openExport(page);
    await opened.setViewportSize({ height: 800, width: 800 });
    const exported = await buttonLook(
      opened.getByRole("link", { name: "Buy" })
    );

    expect({
      ...exported,
      width: toTenths(exported.width),
      x: toTenths(exported.x),
    }).toEqual({
      ...onCanvas,
      width: toTenths(onCanvas.width),
      // The export is centered on an 800px page.
      x: toTenths(onCanvas.x - email + 400),
    });
  });
});
