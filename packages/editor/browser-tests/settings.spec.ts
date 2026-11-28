import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  addPanel,
  openAddPanel,
  addRow,
  addText,
  barButton,
  blockProps,
  boxOf,
  canvas,
  choose,
  chosen,
  change,
  changeCount,
  changesSince,
  consoleErrors,
  countHostEscapes,
  currentValue,
  morePanel,
  openMore,
  emailWith,
  setting,
  openExport,
  openStyle,
  openTestPage,
  pickStyleColor,
  pickStyleFont,
  redoByKey,
  rowTag,
  rowTools,
  selectedBlock,
  selectionBar,
  selectNothing,
  selectRow,
  setValue,
  structure,
  test,
  textBlock,
  undoByKey,
  violations,
} from "./helpers.js";

/** What a refused value says, wherever its field is. */
const alerts = (page: Page) => canvas(page).getByRole("alert");

/** One of the email's settings, with nothing selected, so the bar shows them. */
const emailField = async (page: Page, name: string) => {
  if (
    (await selectionBar(page).getAttribute("aria-label")) !== "Email settings"
  ) {
    await selectNothing(page);
  }
  return await setting(page, name);
};

const settingsOf = async (page: Page) => {
  const { settings } = await currentValue(page);
  return settings;
};

const textStyle = (locator: Locator) =>
  locator.evaluate((element) => {
    const { color, fontFamily, fontSize, textAlign } =
      getComputedStyle(element);
    return { color, fontFamily, fontSize, textAlign };
  });

const rowBackground = (locator: Locator) =>
  locator.evaluate((element) => getComputedStyle(element).backgroundColor);

const typeFontSize = async (page: Page, size: string) => {
  await setValue(page, emailWith([[["One"]]]));
  await canvas(page).getByText("One", { exact: true }).click();
  const control = await setting(page, "Font size (px)");
  await control.fill(size);
};

const inHostOf = async (page: Page, width: number) => {
  await page.addStyleTag({
    content: `main { padding: 0 !important } mail-quilt { width: ${width}px !important }`,
  });
};

test.beforeEach(async ({ page }) => {
  await openTestPage(page);
});

test.describe("the Selection bar's settings", () => {
  test("are the selected Block's alone", async ({ page }) => {
    await textBlock(page).click();

    await expect(selectionBar(page)).toHaveAccessibleName("Text settings");
    await expect(chosen(page, "Alignment")).toHaveAccessibleName("Left");
    await expect(await setting(page, "Font size (px)")).toHaveValue("16");
    await expect(await setting(page, "Color")).toHaveValue("#000000");
    await expect(canvas(page).getByLabel("Preheader")).toHaveCount(0);
  });

  test("follows the selection", async ({ page }) => {
    await setValue(page, emailWith([[["One", "Two"]]]));
    await canvas(page).getByText("One", { exact: true }).click();
    await change(await setting(page, "Font size (px)"), "30");
    // A refused value stays with its own Block too.
    await change(await setting(page, "Color"), "red");

    await canvas(page).getByText("Two", { exact: true }).click();
    await expect(await setting(page, "Font size (px)")).toHaveValue("16");
    await expect(await setting(page, "Color")).toHaveValue("#000000");
    await expect(alerts(page)).toHaveCount(0);

    await canvas(page).getByText("One", { exact: true }).click();
    await expect(await setting(page, "Font size (px)")).toHaveValue("30");
  });

  test("are the email's once its Block is deleted", async ({ page }) => {
    await textBlock(page).click();
    await barButton(page, "Delete Block").click();

    await expect(selectionBar(page)).toHaveAccessibleName("Email settings");
    await expect(canvas(page).getByLabel("Preheader")).toBeVisible();
  });

  test("shows a saved email's settings", async ({ page }) => {
    const value = emailWith([[["Hi"]]]);
    value.settings = {
      backgroundColor: "rgb(1, 2, 3)",
      fontFamily: "Georgia, 'Times New Roman', serif",
      language: "fr",
      preheader: "Salut",
      width: 500,
    };
    await setValue(page, value);

    await expect(await emailField(page, "Width (px)")).toHaveValue("500");
    await expect(await emailField(page, "Preheader")).toHaveValue("Salut");
    await expect(await emailField(page, "Language")).toHaveValue("fr");
  });
});

test.describe("Text settings", () => {
  test("look the same on the canvas and in the export", async ({ page }) => {
    await setValue(page, emailWith([[["Styled"]]]));
    await canvas(page).getByText("Styled", { exact: true }).click();

    await choose(page, "Alignment", "Center");
    await change(await setting(page, "Color"), "#ff0000");
    await change(await setting(page, "Font size (px)"), "24");

    expect(await blockProps(page)).toMatchObject({
      align: "center",
      color: "#ff0000",
      fontSize: 24,
    });

    const expected = {
      color: "rgb(255, 0, 0)",
      fontSize: "24px",
      textAlign: "center",
    };
    expect(await textStyle(textBlock(page).locator("p"))).toMatchObject(
      expected
    );
    const { opened } = await openExport(page);
    expect(await textStyle(opened.getByText("Styled"))).toMatchObject(expected);
    await opened.close();
  });

  test("keep the text, and focus in the field", async ({ page }) => {
    await textBlock(page).click();
    const before = await structure(page);

    await change(await setting(page, "Font size (px)"), "20");

    expect(await structure(page)).toStrictEqual(before);
    await expect(await setting(page, "Font size (px)")).toBeFocused();
  });

  test("go back to the default when emptied, even with spaces left", async ({
    page,
  }) => {
    await textBlock(page).click();
    await change(await setting(page, "Color"), "#ff0000");

    await change(await setting(page, "Color"), "  ");

    expect(await blockProps(page)).not.toHaveProperty("color");
    await expect(await setting(page, "Color")).toHaveValue("#000000");
  });
});

test.describe("Row settings", () => {
  test("show on the canvas", async ({ page }) => {
    await setValue(page, emailWith([[["In"]], [["Out"]]]));
    await selectRow(page, 1);

    await change(await setting(page, "Background color"), "#00ff00");

    const { rows } = await currentValue(page);
    expect(rows.map(({ props }) => props)).toStrictEqual([
      { backgroundColor: "#00ff00" },
      {},
    ]);
    expect(await rowBackground(canvas(page).getByTestId("row").first())).toBe(
      "rgb(0, 255, 0)"
    );
    expect(await rowBackground(canvas(page).getByTestId("row").last())).toBe(
      "rgba(0, 0, 0, 0)"
    );
  });

  test("pad the Row on the canvas", async ({ page }) => {
    await setValue(page, emailWith([[["In"]]]));
    await selectRow(page, 1);

    await expect(await setting(page, "Left padding (px)")).toHaveValue("0");
    await change(await setting(page, "Left padding (px)"), "40");

    const { rows } = await currentValue(page);
    expect(rows[0]?.props).toStrictEqual({ paddingLeft: 40 });
    await expect(canvas(page).getByTestId("row")).toHaveCSS(
      "padding-left",
      "40px"
    );
  });

  test("show the Row on desktop only from More, and mark it on its tag", async ({
    page,
  }) => {
    await setValue(page, emailWith([[["Left"], ["Right"]]]));
    await selectRow(page, 1);
    const stack = await setting(page, "Stack Columns on phones");
    await expect(stack).toBeChecked();
    await openMore(page);
    const showOn = morePanel(page).getByRole("group", { name: "Show on" });
    await expect(
      showOn.getByRole("button", { name: "All devices" })
    ).toHaveAttribute("aria-pressed", "true");

    await showOn.getByRole("button", { name: "Desktop only" }).click();

    const { rows } = await currentValue(page);
    expect(rows[0]?.props).toStrictEqual({ showOn: "desktop" });
    await expect(
      showOn.getByRole("button", { name: "Desktop only" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      rowTag(page, 1).locator('[data-tooltip="Desktop only"]')
    ).toBeVisible();
    // Said too, as the tag isn't read.
    await expect(rowTools(page, 1)).toHaveAccessibleDescription("Desktop only");
    expect(await violations(page)).toStrictEqual([]);
  });
});

test.describe("Email settings", () => {
  test("look the same on the canvas and in the export", async ({ page }) => {
    const verdana = "Verdana, Geneva, sans-serif";
    await setValue(page, emailWith([[["Styled"]]]));
    await change(await emailField(page, "Width (px)"), "500");
    await change(await emailField(page, "Preheader"), "Hello {{first_name}}");
    await change(await emailField(page, "Language"), "pt-BR");
    // The email's look is set in Style.
    await openStyle(page);
    await pickStyleColor(page, "Page", "#eeeeee");
    await pickStyleFont(page, "Body", "Verdana");

    expect(await settingsOf(page)).toStrictEqual({
      backgroundColor: "#eeeeee",
      fontFamily: verdana,
      language: "pt-BR",
      preheader: "Hello {{first_name}}",
      width: 500,
    });

    await expect
      .poll(() =>
        textBlock(page).evaluate((text) =>
          text.querySelector("p")?.getAttribute("lang")
        )
      )
      .toBe("pt-BR");
    const onCanvas = canvas(page).getByTestId("email");
    await expect(onCanvas).toHaveCSS("background-color", "rgb(238, 238, 238)");
    await expect(onCanvas).toHaveCSS("width", "500px");
    expect(await textStyle(textBlock(page).locator("p"))).toMatchObject({
      fontFamily: verdana,
    });

    const { html, opened } = await openExport(page);
    expect(html).toContain('<html lang="pt-BR"');
    await expect(opened.locator("body")).toHaveCSS(
      "background-color",
      "rgb(238, 238, 238)"
    );
    expect(
      await textStyle(opened.getByText("Styled", { exact: true }))
    ).toMatchObject({ fontFamily: verdana });
    await expect(opened.locator('[role="article"] > div').last()).toHaveCSS(
      "max-width",
      "500px"
    );
    await expect(opened.getByText("Hello {{first_name}}")).toBeHidden();
    await opened.close();
  });
});

test.describe("undo", () => {
  test("takes back one change at a time", async ({ page }) => {
    await textBlock(page).click();
    await change(await setting(page, "Color"), "#ff0000");
    await choose(page, "Alignment", "Right");
    await selectRow(page, 1);
    await change(await setting(page, "Background color"), "#00ff00");
    await change(await emailField(page, "Width (px)"), "500");

    await undoByKey(page);
    await expect(await emailField(page, "Width (px)")).toHaveValue("600");
    await selectRow(page, 1);
    await undoByKey(page);
    await expect(await setting(page, "Background color")).toHaveValue("");
    await textBlock(page).click();
    await undoByKey(page);
    await expect(chosen(page, "Alignment")).toHaveAccessibleName("Left");
    await expect(await setting(page, "Color")).toHaveValue("#ff0000");
    await undoByKey(page);
    await expect(await setting(page, "Color")).toHaveValue("#000000");
    await expect(textBlock(page).locator("p")).toHaveCSS(
      "color",
      "rgb(0, 0, 0)"
    );

    await redoByKey(page);
    await expect(await setting(page, "Color")).toHaveValue("#ff0000");
    await expect(textBlock(page).locator("p")).toHaveCSS(
      "color",
      "rgb(255, 0, 0)"
    );
  });

  test("works from a choice in the bar, and from a Block afterwards", async ({
    page,
  }) => {
    await textBlock(page).click();
    await choose(page, "Alignment", "Right");

    await chosen(page, "Alignment").focus();
    await undoByKey(page);
    await expect(chosen(page, "Alignment")).toHaveAccessibleName("Left");

    await redoByKey(page);
    await textBlock(page).click();
    await undoByKey(page);
    await expect(chosen(page, "Alignment")).toHaveAccessibleName("Left");
  });

  test("leaves what's being typed to the field's own undo", async ({
    page,
  }) => {
    await change(await emailField(page, "Width (px)"), "500");
    const language = await emailField(page, "Language");
    await language.click();
    await page.keyboard.type("en");

    await undoByKey(page);

    const { width } = await settingsOf(page);
    expect(width).toBe(500);
    // The field's own undo took back what was typed.
    await expect(language).not.toHaveValue("en");
  });

  test("reports each change once", async ({ page }) => {
    const expectChanges = await changesSince(page);

    await change(await emailField(page, "Width (px)"), "500");
    await page.keyboard.press("Tab");

    await expectChanges(1);
  });

  test("makes no step for the value it already has", async ({ page }) => {
    await change(await emailField(page, "Width (px)"), "500");
    const before = await currentValue(page);

    await change(await emailField(page, "Width (px)"), "500");
    const width = await emailField(page, "Width (px)");
    await width.fill("0500");
    await page.keyboard.press("Tab");

    expect(await currentValue(page)).toStrictEqual(before);
    await undoByKey(page);
    await expect(await emailField(page, "Width (px)")).toHaveValue("600");
  });
});

test.describe("validation", () => {
  test("refuses a bad value and explains", async ({ page }) => {
    const errors = consoleErrors(page);
    await textBlock(page).click();
    const before = await currentValue(page);
    const color = await setting(page, "Color");

    await change(color, "red");

    const error = alerts(page);
    await expect(error).toHaveText(
      "Use a color such as #ff0000, rgb(255, 0, 0) or rgba(255, 0, 0, 0.5)."
    );
    await expect(color).toHaveAttribute("aria-invalid", "true");
    await expect(color).toHaveAccessibleDescription(
      "Use a color such as #ff0000, rgb(255, 0, 0) or rgba(255, 0, 0, 0.5)."
    );
    await expect(color).toHaveValue("red");
    expect(await currentValue(page)).toStrictEqual(before);
    await expect(changeCount(page)).toHaveText("0");
    expect(errors).toStrictEqual([]);

    // The same reason again is a new alert, so it's read out again.
    await error.evaluate((element) => {
      element.dataset.seen = "true";
    });
    await change(color, "blue");
    await expect(error).toBeVisible();
    await expect(error).not.toHaveAttribute("data-seen");

    await change(color, "#ff0000");

    await expect(error).toHaveCount(0);
    await expect(color).toHaveAttribute("aria-invalid", "false");
    await expect(changeCount(page)).toHaveText("1");
  });

  test("refuses text that isn't a number, rather than read it as empty", async ({
    page,
  }) => {
    await textBlock(page).click();
    const size = await setting(page, "Font size (px)");
    await change(size, "30");
    const before = await currentValue(page);

    // Typed, as a number field won't be filled with what isn't a number.
    await size.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("1e");
    await page.keyboard.press("Enter");

    await expect(size).toHaveAttribute("aria-invalid", "true");
    await expect(alerts(page)).toBeVisible();
    expect(await currentValue(page)).toStrictEqual(before);
  });

  test("Escape brings back the current value, and goes no further", async ({
    page,
  }) => {
    const hostEscapes = await countHostEscapes(page);
    const language = await emailField(page, "Language");
    await change(language, "English");

    await language.press("Escape");

    await expect(language).toHaveValue("");
    await expect(hostEscapes()).resolves.toBe(0);
    await expect(alerts(page)).toHaveCount(0);
    await expect(language).toHaveAttribute("aria-invalid", "false");

    // With nothing typed, it's the host's.
    await language.press("Escape");
    await expect(hostEscapes()).resolves.toBe(1);
  });

  test("undo clears a refused value", async ({ page }) => {
    await change(await emailField(page, "Width (px)"), "500");
    await change(await emailField(page, "Language"), "English");

    const width = await emailField(page, "Width (px)");
    await width.focus();
    await undoByKey(page);

    await expect(await emailField(page, "Language")).toHaveValue("");
    await expect(alerts(page)).toHaveCount(0);
    await expect(await emailField(page, "Width (px)")).toHaveValue("600");
  });

  test("the color picker replaces a refused value", async ({ page }) => {
    await textBlock(page).click();
    const color = await setting(page, "Color");
    await change(color, "red");

    const picker = await setting(page, "Color picker");
    await picker.fill("#00ff00");

    await expect(color).toHaveValue("#00ff00");
    await expect(alerts(page)).toHaveCount(0);
    expect(await blockProps(page)).toMatchObject({ color: "#00ff00" });
  });
});

test.describe("typing in a field", () => {
  test("doesn't reach the Block's text", async ({ page }) => {
    await textBlock(page).click();
    await page.keyboard.type("Hi");
    const before = await structure(page);

    const preheader = await emailField(page, "Preheader");
    await preheader.click();
    await page.keyboard.type("Typed here");
    await page.keyboard.press("Backspace");

    expect(await structure(page)).toStrictEqual(before);
    await expect(await emailField(page, "Preheader")).toHaveValue("Typed her");
  });
});

test.describe("text that hasn't been committed", () => {
  // addRow opens the Add panel first, which takes focus, and so commits it.
  test("is committed when another control is pressed, as one undo step apart from that control's", async ({
    page,
  }) => {
    await typeFontSize(page, "24");

    await addRow(page);
    await undoByKey(page);

    expect(await structure(page)).toHaveLength(1);
    expect(await blockProps(page)).toMatchObject({ fontSize: 24 });
    await undoByKey(page);
    expect(await blockProps(page)).not.toHaveProperty("fontSize");
  });

  test("is committed when a drag handle is pressed", async ({ page }) => {
    await typeFontSize(page, "24");
    // The selected Block's, which shows. A press keeps focus where it is.
    const handle = selectedBlock(page).getByTestId("drag-handle");
    await expect(handle).toBeVisible();
    const box = await boxOf(handle);

    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.down();
    await page.mouse.up();

    expect(await blockProps(page)).toMatchObject({ fontSize: 24 });
  });

  test("still shows why when a button is pressed", async ({ page }) => {
    const language = await emailField(page, "Language");
    await language.fill("English");

    await addRow(page);
    // The new Row is selected, so the bar shows its settings.
    await expect(alerts(page)).toHaveCount(0);

    await expect(await emailField(page, "Language")).toHaveValue("English");
    await expect(alerts(page)).toHaveCount(1);
    expect(await structure(page)).toHaveLength(2);
  });
});

test.describe("focus", () => {
  test("stays in an Email field when undo removes the Block's settings and redo brings them back", async ({
    page,
  }) => {
    await setValue(page, emailWith([[[]]]));
    await addText(page);
    const language = await emailField(page, "Language");
    await language.click();
    await undoByKey(page);
    await expect(textBlock(page)).toHaveCount(0);
    await expect(language).toBeFocused();

    await redoByKey(page);

    await expect(textBlock(page)).toHaveCount(1);

    await expect(language).toBeFocused();
    await page.keyboard.type("en");
    await page.keyboard.press("Enter");
    expect(await settingsOf(page)).toMatchObject({ language: "en" });
  });
});

test.describe("the color picker", () => {
  // Over a dark email, so white is a change the picker can make.
  test("shows what's behind a Row with no color, and can pick white", async ({
    page,
  }) => {
    const value = emailWith([[["Hi"]]]);
    value.settings.backgroundColor = "#000";
    await setValue(page, value);
    await selectRow(page, 1);

    await expect(await setting(page, "Background color")).toHaveValue("");
    // In full, as a color picker only takes six digits.
    await expect(await setting(page, "Background color picker")).toHaveValue(
      "#000000"
    );

    const picker = await setting(page, "Background color picker");
    await picker.fill("#ffffff");

    const { rows } = await currentValue(page);
    expect(rows[0]?.props).toStrictEqual({ backgroundColor: "#ffffff" });
  });
});

test.describe("the Add panel's layout", () => {
  test("floats over the Canvas's edge rather than squeeze the email", async ({
    page,
  }) => {
    await inHostOf(page, 900);
    await openAddPanel(page);
    const onCanvas = canvas(page).getByTestId("email");
    await expect(onCanvas).toHaveCSS("width", "600px");
    const panelBox = await boxOf(addPanel(page));
    const hostBox = await boxOf(canvas(page));
    expect(panelBox.x).toBeCloseTo(hostBox.x, 0);
  });

  test("docks at the Canvas's start when the email fits beside it", async ({
    page,
  }) => {
    await inHostOf(page, 1100);
    await openAddPanel(page);

    const emailBox = await boxOf(canvas(page).getByTestId("email"));
    const panelBox = await boxOf(addPanel(page));
    const hostBox = await boxOf(canvas(page));
    const topBar = await boxOf(canvas(page).locator('[part="top-bar"]'));
    expect(panelBox.y).toBeCloseTo(topBar.y + topBar.height, 0);
    expect(panelBox.x).toBeCloseTo(hostBox.x, 0);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(emailBox.x);
  });
});

test.describe("accessibility", () => {
  test("has no violations while showing a refused value", async ({ page }) => {
    await textBlock(page).click();
    await change(await setting(page, "Color"), "red");
    expect(await violations(page)).toStrictEqual([]);
    await change(await emailField(page, "Language"), "English");

    expect(await violations(page)).toStrictEqual([]);
  });
});
