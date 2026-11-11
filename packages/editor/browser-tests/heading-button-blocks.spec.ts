import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  blockGroup,
  blocks,
  blockTypes,
  canvas,
  change,
  currentValue,
  exportHtml,
  field,
  openBlocks as open,
  openExport,
  palette,
  panelBlock,
  redo,
  setValue,
  settle,
  undo,
  violations,
} from "./helpers.js";

const headingText = (page: Page) =>
  page.getByRole("textbox", { name: "Heading Block" });

/** The part of a Button that looks like one, on the canvas. */
const buttonFace = (page: Page) =>
  blockGroup(page, "Button").locator(".button");

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

// The test host's unfriendly CSS pushes the canvas far down the page.
test.use({ viewport: { height: 1600, width: 1280 } });

test.describe("the palette", () => {
  test("adds a Heading, ready to type in", async ({ page }) => {
    await open(page, ["text"]);

    await palette(page, "Heading").click();
    await page.keyboard.type("Big news");

    await expect(headingText(page)).toHaveText("Big news");
    await expect(blockTypes(page)).resolves.toEqual(["text", "heading"]);
    await expect(lastBlockProps(page)).resolves.toMatchObject({ level: 1 });
  });

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
  test("stays one heading after Enter, as two lines", async ({ page }) => {
    await open(page, ["heading"]);
    await headingText(page).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("One");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Two");

    const { opened } = await openExport(page);

    await expect(opened.getByRole("heading")).toHaveCount(1);
    await expect(opened.getByRole("heading", { level: 2 })).toHaveText(
      "OneTwo"
    );
  });

  test("changes level, on the canvas, in the panel and in the export", async ({
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
    const { opened } = await openExport(page);
    await expect(opened.getByRole("heading", { level: 1 })).toHaveText("Sale");
    await expect(opened.getByRole("heading", { level: 1 })).toHaveCSS(
      "font-size",
      "32px"
    );
    await opened.close();

    await page.keyboard.press("ControlOrMeta+z");

    await expect(lastBlockProps(page)).resolves.toMatchObject({ level: 2 });
    await expect(field(page, "Level")).toHaveValue("2");
  });

  test("shows its settings the same on the canvas and in the export", async ({
    page,
  }) => {
    await open(page, ["heading"]);
    await headingText(page).click();
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
    await expect(headingLook(opened.getByRole("heading"))).resolves.toEqual(
      expected
    );
  });

  test("takes up the same space on the canvas as in the export", async ({
    page,
  }) => {
    await open(page, ["heading"]);

    const onCanvas = await headingText(page).boundingBox();
    const { opened } = await openExport(page);
    const exported = await opened.getByRole("heading").boundingBox();

    // The canvas's box has the Block's padding, and the heading's doesn't.
    expect(exported?.height).toBe((onCanvas?.height ?? 0) - 32);
  });
});

test.describe("Bold in a Heading, which is already bold", () => {
  test("isn't offered, while the other formats are", async ({ page }) => {
    await open(page, ["heading"]);
    await headingText(page).click();

    await expect(page.getByRole("button", { name: "Bold" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Italic" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Underline" })).toBeEnabled();
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

  test("stays on a saved Heading that has it, which still opens", async ({
    page,
  }) => {
    await open(page, ["heading"]);
    const email = await currentValue(page);
    const block = email.rows[0]?.columns[0]?.blocks[0];
    if (block) {
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

test.describe("an empty Column", () => {
  test("gets a Text from its own control, by keyboard", async ({ page }) => {
    await open(page, ["text"], []);
    const add = page.getByRole("button", {
      name: "Add Text Block here, Row 1, Column 2",
    });
    await add.focus();

    await page.keyboard.press("Enter");

    await expect(blockTypes(page, 0, 1)).resolves.toEqual(["text"]);

    await undo(page);
    await expect(blockTypes(page, 0, 1)).resolves.toEqual([]);
  });

  test("keeps its controls inside a narrow Column", async ({ page }) => {
    await open(page, ["text"], [], [], []);
    const column = canvas(page).locator(".column").nth(1);
    const box = await column.boundingBox();

    const controls = await column.getByRole("button").all();
    expect(controls).toHaveLength(6);
    for (const control of controls) {
      // oxlint-disable-next-line no-await-in-loop -- One at a time, to name the one that's out.
      const inner = await control.boundingBox();
      expect(inner?.x).toBeGreaterThanOrEqual(box?.x ?? 0);
      expect((inner?.x ?? 0) + (inner?.width ?? 0)).toBeLessThanOrEqual(
        (box?.x ?? 0) + (box?.width ?? 0)
      );
    }
  });
});

test.describe("a Button", () => {
  test("doesn't select its label when dragged across", async ({ page }) => {
    await open(page, ["button"]);
    const box = await buttonFace(page).boundingBox();
    const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;

    await page.mouse.move((box?.x ?? 0) + 2, y);
    await page.mouse.down();
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) - 2, y, {
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
    await canvas(page).locator(".block").first().focus();
    await field(page, "Alignment").waitFor();
    const url = page.url();

    await buttonFace(page).click();

    await expect(blockGroup(page, "Button")).toHaveAttribute(
      "aria-current",
      "true"
    );
    await expect(field(page, "Label")).toHaveValue("Buy");
    expect(page.url()).toBe(url);
  });

  test("describes the keys that work on it, with none for editing text", async ({
    page,
  }) => {
    await open(page, ["button"]);

    await expect(blockGroup(page, "Button")).toHaveAccessibleDescription(
      "Use arrow keys to select another Block, and Alt with arrow keys to move this one."
    );
  });

  test("changes its label as one undo step", async ({ page }) => {
    await open(page, ["button"]);
    await blockGroup(page, "Button").focus();

    await change(field(page, "Label"), "Shop {{season}}");

    await expect(buttonFace(page)).toHaveText("Shop {{season}}");

    await undo(page);
    await expect(buttonFace(page)).toHaveText("Buy");
    await expect(field(page, "Label")).toHaveValue("Buy");

    await redo(page);
    await expect(buttonFace(page)).toHaveText("Shop {{season}}");
  });

  test("shows a label as text, whatever it holds", async ({ page }) => {
    await open(page, ["button"]);
    await blockGroup(page, "Button").focus();

    await change(field(page, "Label"), "<img src=x onerror=alert(1)>");

    await expect(buttonFace(page)).toHaveText("<img src=x onerror=alert(1)>");
    await expect(buttonFace(page).locator("img")).toHaveCount(0);
    const { html } = await openExport(page);
    expect(html).not.toContain("<img");
  });

  test("refuses the link javascript:alert(1)", async ({ page }) => {
    await open(page, ["button"]);
    await blockGroup(page, "Button").focus();

    // oxlint-disable-next-line no-script-url -- What's being refused.
    await change(field(page, "Link"), "javascript:alert(1)");

    await expect(field(page, "Link")).toHaveAttribute("aria-invalid", "true");
    await expect(panelBlock(page).getByRole("alert")).toContainText(
      "Merge Tag"
    );
    await expect(lastBlockProps(page)).resolves.toEqual({ label: "Buy" });
  });

  test("links to https://shop.example/sale in the export, and undoes it", async ({
    page,
  }) => {
    const href = "https://shop.example/sale";
    await open(page, ["button"]);
    await blockGroup(page, "Button").focus();

    await change(field(page, "Link"), href);

    await expect(field(page, "Link")).toHaveAttribute("aria-invalid", "false");
    const { opened } = await openExport(page);
    await expect(opened.getByRole("link", { name: "Buy" })).toHaveAttribute(
      "href",
      href
    );
    await opened.close();

    await undo(page);
    await expect(lastBlockProps(page)).resolves.toEqual({ label: "Buy" });
    await expect(field(page, "Link")).toHaveValue("");
  });

  test("removes its link when the field is cleared", async ({ page }) => {
    await open(page, ["button"]);
    await blockGroup(page, "Button").focus();
    await change(field(page, "Link"), "https://shop.example");

    await change(field(page, "Link"), "");

    await expect(lastBlockProps(page)).resolves.toEqual({ label: "Buy" });
    const { opened } = await openExport(page);
    await expect(opened.getByRole("link")).toHaveCount(0);
    await expect(opened.getByText("Buy")).toBeVisible();
  });

  test("looks the same on the canvas and in the export", async ({ page }) => {
    await open(page, ["button"]);
    await blockGroup(page, "Button").focus();
    await change(field(page, "Link"), "https://shop.example");
    await change(field(page, "Label"), "Buy it all today");
    await change(field(page, "Background color"), "#112233");
    await change(field(page, "Text color"), "#ddeeff");
    await field(page, "Alignment").selectOption("center");

    const onCanvas = await buttonLook(buttonFace(page));
    const email = await canvas(page)
      .locator(".email")
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

  for (const align of ["left", "right"]) {
    test(`sits ${align} on the canvas and in the export`, async ({ page }) => {
      await open(page, ["button"]);
      await blockGroup(page, "Button").focus();
      await field(page, "Alignment").selectOption(align);

      const side = async (face: Locator, container: Locator) => {
        const inner = await face.boundingBox();
        const outer = await container.boundingBox();
        return toTenths(
          align === "left"
            ? (inner?.x ?? 0) - (outer?.x ?? 0)
            : (outer?.x ?? 0) +
                (outer?.width ?? 0) -
                (inner?.x ?? 0) -
                (inner?.width ?? 0)
        );
      };

      await expect(
        side(buttonFace(page), blockGroup(page, "Button"))
      ).resolves.toBe(16);
      const { opened } = await openExport(page);
      await opened.setViewportSize({ height: 800, width: 800 });
      await expect(
        side(opened.getByText("Buy"), opened.locator("body > div"))
      ).resolves.toBe(116);
    });
  }
});

test.describe("accessibility", () => {
  test("finds no violations with a Button selected", async ({ page }) => {
    await open(page, ["text", "button"]);
    await blockGroup(page, "Button").focus();

    await expect(violations(page)).resolves.toEqual([]);
  });

  test("finds no problem with the exported heading or link", async ({
    page,
  }) => {
    await open(page, ["heading", "button"]);
    await blockGroup(page, "Button").focus();
    await change(field(page, "Link"), "https://shop.example");
    const { opened } = await openExport(page);

    await expect(
      opened.getByRole("heading", { level: 2, name: "Sale" })
    ).toBeVisible();
    await expect(opened.getByRole("link", { name: "Buy" })).toBeVisible();
    const { violations: found } = await new AxeBuilder({ page: opened })
      // MJML writes an empty <title> for every email, whatever its Blocks.
      .disableRules(["document-title"])
      .setLegacyMode()
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(found.map(({ id }) => id)).toEqual([]);
  });
});
