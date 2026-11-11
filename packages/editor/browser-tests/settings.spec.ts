import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  addRow,
  canvas,
  change,
  chooseLayout,
  currentValue,
  emailWith,
  exportHtml,
  openExport,
  openTab,
  redoByKey,
  selectRow,
  setValue,
  showPalette,
  structure,
  textBlock,
  undoByKey,
  violations,
} from "./helpers.js";

const section = (page: Page, name: string) =>
  page
    .getByRole("group", { name: "Settings" })
    .getByRole("group", { exact: true, name });

const email = (page: Page) => section(page, "Email");
const row = (page: Page) => section(page, "Row");
const block = (page: Page) => section(page, "Block");

const field = (page: Page, name: string, within = email(page)) =>
  within.getByLabel(name, { exact: true });

const settingsOf = async (page: Page) => {
  const { settings } = await currentValue(page);
  return settings;
};

const blockProps = async (page: Page, index = 0) => {
  const { rows } = await currentValue(page);
  return rows[0]?.columns[0]?.blocks[index]?.props;
};

const changeCount = (page: Page) => page.getByTestId("change-count");

const textStyle = (locator: Locator) =>
  locator.evaluate((element) => {
    const { color, fontFamily, fontSize, textAlign } =
      getComputedStyle(element);
    return { color, fontFamily, fontSize, textAlign };
  });

const rowBackground = (locator: Locator) =>
  locator.evaluate((element) => getComputedStyle(element).backgroundColor);

/** The ring is the accent color, which the test sets to this. */
const ACCENT = "rgb(1, 2, 3)";

const expectNamedWithFocusRing = async (control: Locator) => {
  await control.focus();
  await expect(control).toBeFocused();
  await expect(control).toHaveCSS("outline-style", "solid");
  await expect(control).toHaveCSS("outline-color", ACCENT);
  const named = await control.evaluate((element) => {
    const { labels } = element as HTMLInputElement;
    return (labels?.length ?? 0) > 0 || element.hasAttribute("aria-label");
  });
  expect(named).toBeTruthy();
};

/** Every control in a settings section has a name and a focus ring. */
const expectEach = async (within: Locator) => {
  await expect(within).toBeVisible();
  const controls = await within.locator("input, select").all();
  expect(controls.length).toBeGreaterThan(0);
  // One at a time, because each one takes focus from the last.
  for (const control of controls) {
    // oxlint-disable-next-line no-await-in-loop -- See above.
    await expectNamedWithFocusRing(control);
  }
};

const typeFontSize = async (page: Page, size: string) => {
  await setValue(page, emailWith([[["One"]]]));
  await canvas(page).getByText("One", { exact: true }).click();
  await field(page, "Font size (px)", block(page)).fill(size);
};

const addText = async (page: Page) => {
  const text = await showPalette(page, "Text");
  await text.click();
};

const inHostOf = async (page: Page, width: number) => {
  await page.addStyleTag({
    content: `main { padding: 0 !important } mail-quilt { width: ${width}px !important }`,
  });
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toBeVisible();
  await openTab(page, "Settings");
});

test.describe("the panel", () => {
  test("shows the email's settings with nothing selected", async ({ page }) => {
    await expect(field(page, "Width (px)")).toHaveValue("600");
    await expect(field(page, "Background color")).toHaveValue("#ffffff");
    await expect(field(page, "Font")).toHaveValue(
      "Arial, Helvetica, sans-serif"
    );
    await expect(field(page, "Preheader")).toHaveValue("");
    await expect(field(page, "Language")).toHaveValue("");
    await expect(block(page)).toHaveCount(0);
    await expect(row(page)).toHaveCount(0);
  });

  test("shows the settings of the selected Block alone", async ({ page }) => {
    await textBlock(page).click();

    await expect(field(page, "Alignment", block(page))).toHaveValue("left");
    await expect(field(page, "Color", block(page))).toHaveValue("#000000");
    await expect(field(page, "Font size (px)", block(page))).toHaveValue("16");
    await expect(row(page)).toHaveCount(0);
    await expect(email(page)).toHaveCount(0);
  });

  test("follows the selection", async ({ page }) => {
    await setValue(page, emailWith([[["One", "Two"]]]));
    await canvas(page).getByText("One", { exact: true }).click();
    await change(field(page, "Font size (px)", block(page)), "30");

    await canvas(page).getByText("Two", { exact: true }).click();
    await expect(field(page, "Font size (px)", block(page))).toHaveValue("16");

    await canvas(page).getByText("One", { exact: true }).click();
    await expect(field(page, "Font size (px)", block(page))).toHaveValue("30");
  });

  test("leaves when its Block is deleted", async ({ page }) => {
    await textBlock(page).click();
    await page.getByRole("button", { name: "Delete Block" }).click();

    await expect(block(page)).toHaveCount(0);
    await expect(email(page)).toBeVisible();
  });

  test("keeps a saved font that isn't on the list", async ({ page }) => {
    const document = emailWith([[["Hi"]]]);
    document.settings.fontFamily = "Papyrus, fantasy";
    await setValue(page, document);

    await expect(field(page, "Font")).toHaveValue("Papyrus, fantasy");
    await expect(
      field(page, "Font").getByRole("option", { name: "Papyrus, fantasy" })
    ).toHaveCount(1);
  });

  test("shows a saved email's settings", async ({ page }) => {
    const document = emailWith([[["Hi"]]]);
    document.settings = {
      backgroundColor: "rgb(1, 2, 3)",
      fontFamily: "Georgia, 'Times New Roman', serif",
      language: "fr",
      preheader: "Salut",
      width: 500,
    };
    await setValue(page, document);

    await expect(field(page, "Width (px)")).toHaveValue("500");
    await expect(field(page, "Background color")).toHaveValue("rgb(1, 2, 3)");
    await expect(field(page, "Background color picker")).toHaveValue("#010203");
    await expect(field(page, "Font")).toHaveValue(
      "Georgia, 'Times New Roman', serif"
    );
    await expect(field(page, "Preheader")).toHaveValue("Salut");
    await expect(field(page, "Language")).toHaveValue("fr");
  });
});

test.describe("Text settings", () => {
  test("look the same on the canvas and in the export", async ({ page }) => {
    await setValue(page, emailWith([[["Styled"]]]));
    await canvas(page).getByText("Styled", { exact: true }).click();

    await field(page, "Alignment", block(page)).selectOption("center");
    await change(field(page, "Color", block(page)), "#ff0000");
    await change(field(page, "Font size (px)", block(page)), "24");

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
    expect(
      await textStyle(canvas(page).locator(".ProseMirror p"))
    ).toMatchObject(expected);
    const { opened } = await openExport(page);
    expect(await textStyle(opened.getByText("Styled"))).toMatchObject(expected);
    await opened.close();
  });

  test("keep the text, and focus in the field", async ({ page }) => {
    await textBlock(page).click();
    const before = await structure(page);

    await change(field(page, "Font size (px)", block(page)), "20");

    expect(await structure(page)).toStrictEqual(before);
    await expect(field(page, "Font size (px)", block(page))).toBeFocused();
  });

  test("can be set with the color picker", async ({ page }) => {
    await textBlock(page).click();

    await field(page, "Color picker", block(page)).fill("#00ff00");

    expect(await blockProps(page)).toMatchObject({ color: "#00ff00" });
    await expect(field(page, "Color", block(page))).toHaveValue("#00ff00");
  });

  test("go back to the default when emptied, even with spaces left", async ({
    page,
  }) => {
    await textBlock(page).click();
    await change(field(page, "Color", block(page)), "#ff0000");

    await change(field(page, "Color", block(page)), "  ");

    expect(await blockProps(page)).not.toHaveProperty("color");
    await expect(field(page, "Color", block(page))).toHaveValue("#000000");
  });
});

test.describe("Row settings", () => {
  test("look the same on the canvas and in the export", async ({ page }) => {
    await setValue(page, emailWith([[["In"]], [["Out"]]]));
    await selectRow(page, 1);

    await change(field(page, "Background color", row(page)), "#00ff00");

    const { rows } = await currentValue(page);
    expect(rows.map(({ props }) => props)).toStrictEqual([
      { backgroundColor: "#00ff00" },
      {},
    ]);
    expect(await rowBackground(canvas(page).locator(".row").first())).toBe(
      "rgb(0, 255, 0)"
    );
    expect(await rowBackground(canvas(page).locator(".row").last())).toBe(
      "rgba(0, 0, 0, 0)"
    );
    const { html, opened } = await openExport(page);
    expect(html).toContain("background-color:#00ff00");
    await expect(opened.getByText("In", { exact: true })).toBeVisible();
    await opened.close();
  });
});

test.describe("Email settings", () => {
  test("look the same on the canvas and in the export", async ({ page }) => {
    const verdana = "Verdana, Geneva, sans-serif";
    await setValue(page, emailWith([[["Styled"]]]));
    await change(field(page, "Width (px)"), "500");
    await change(field(page, "Background color"), "#eeeeee");
    await field(page, "Font").selectOption(verdana);
    await change(field(page, "Preheader"), "Hello {{first_name}}");
    await change(field(page, "Language"), "pt-BR");

    expect(await settingsOf(page)).toStrictEqual({
      backgroundColor: "#eeeeee",
      fontFamily: verdana,
      language: "pt-BR",
      preheader: "Hello {{first_name}}",
      width: 500,
    });

    const onCanvas = canvas(page).locator(".email");
    await expect(onCanvas).toHaveAttribute("lang", "pt-BR");
    await expect(onCanvas).toHaveCSS("background-color", "rgb(238, 238, 238)");
    await expect(onCanvas).toHaveCSS("width", "500px");
    expect(
      await textStyle(canvas(page).locator(".ProseMirror p"))
    ).toMatchObject({ fontFamily: verdana });

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
    await change(field(page, "Color", block(page)), "#ff0000");
    await field(page, "Alignment", block(page)).selectOption("right");
    await selectRow(page, 1);
    await change(field(page, "Background color", row(page)), "#00ff00");
    await openTab(page, "Settings");
    await change(field(page, "Width (px)"), "500");

    await undoByKey(page);
    await expect(field(page, "Width (px)")).toHaveValue("600");
    await selectRow(page, 1);
    await undoByKey(page);
    await expect(field(page, "Background color", row(page))).toHaveValue("");
    // A click on the Block shows its settings again.
    await textBlock(page).click();
    await undoByKey(page);
    await expect(field(page, "Alignment", block(page))).toHaveValue("left");
    await expect(field(page, "Color", block(page))).toHaveValue("#ff0000");
    await undoByKey(page);
    await expect(field(page, "Color", block(page))).toHaveValue("#000000");
    await expect(canvas(page).locator(".ProseMirror p")).toHaveCSS(
      "color",
      "rgb(0, 0, 0)"
    );

    await redoByKey(page);
    await expect(field(page, "Color", block(page))).toHaveValue("#ff0000");
    await expect(canvas(page).locator(".ProseMirror p")).toHaveCSS(
      "color",
      "rgb(255, 0, 0)"
    );
  });

  test("works from a select, and from a Block afterwards", async ({ page }) => {
    await textBlock(page).click();
    await field(page, "Alignment", block(page)).selectOption("right");

    await field(page, "Alignment", block(page)).focus();
    await undoByKey(page);
    await expect(field(page, "Alignment", block(page))).toHaveValue("left");

    await redoByKey(page);
    await textBlock(page).click();
    await undoByKey(page);
    await expect(field(page, "Alignment", block(page))).toHaveValue("left");
  });

  test("leaves what's being typed to the field's own undo", async ({
    page,
  }) => {
    await change(field(page, "Width (px)"), "500");
    await field(page, "Language").click();
    await page.keyboard.type("en");

    await undoByKey(page);

    const { width } = await settingsOf(page);
    expect(width).toBe(500);
  });

  test("reports each change once", async ({ page }) => {
    const before = Number(await changeCount(page).textContent());

    await change(field(page, "Width (px)"), "500");
    await page.keyboard.press("Tab");

    await expect(changeCount(page)).toHaveText(String(before + 1));
  });

  test("makes no step for the value it already has", async ({ page }) => {
    await change(field(page, "Width (px)"), "600");
    await field(page, "Width (px)").fill("0600");
    await page.keyboard.press("Tab");

    await expect(changeCount(page)).toHaveText("0");
    await undoByKey(page);
    await expect(changeCount(page)).toHaveText("0");
  });
});

test.describe("validation", () => {
  test("refuses a bad value and explains", async ({ page }) => {
    const messages: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        messages.push(message.text());
      }
    });
    await textBlock(page).click();
    const before = await currentValue(page);
    const color = field(page, "Color", block(page));

    await change(color, "red");

    const error = block(page).getByRole("alert");
    await expect(error).toHaveText(
      "Use a color such as #ff0000, or rgb(255, 0, 0)."
    );
    await expect(color).toHaveAttribute("aria-invalid", "true");
    await expect(color).toHaveAccessibleDescription(
      "Use a color such as #ff0000, or rgb(255, 0, 0)."
    );
    await expect(color).toHaveValue("red");
    expect(await currentValue(page)).toStrictEqual(before);
    await expect(changeCount(page)).toHaveText("0");
    expect(messages).toStrictEqual([]);

    await change(color, "#ff0000");

    await expect(error).toHaveCount(0);
    await expect(color).toHaveAttribute("aria-invalid", "false");
    await expect(changeCount(page)).toHaveText("1");
  });

  test("refuses an empty width in the email's settings", async ({ page }) => {
    const before = await currentValue(page);

    await change(field(page, "Width (px)"), "");

    await expect(email(page).getByRole("alert")).toHaveCount(1);
    expect(await currentValue(page)).toStrictEqual(before);
  });

  test("Escape brings back the current value", async ({ page }) => {
    const language = field(page, "Language");
    await change(language, "English");

    await language.press("Escape");

    await expect(language).toHaveValue("");
    await expect(email(page).getByRole("alert")).toHaveCount(0);
    await expect(language).toHaveAttribute("aria-invalid", "false");
  });

  test("undo clears a refused value", async ({ page }) => {
    await change(field(page, "Width (px)"), "500");
    await change(field(page, "Language"), "English");

    await field(page, "Width (px)").focus();
    await undoByKey(page);

    await expect(field(page, "Language")).toHaveValue("");
    await expect(email(page).getByRole("alert")).toHaveCount(0);
    await expect(field(page, "Width (px)")).toHaveValue("600");
  });

  test("a refused value stays with its own Block", async ({ page }) => {
    await setValue(page, emailWith([[["One", "Two"]]]));
    await canvas(page).getByText("One", { exact: true }).click();
    await change(field(page, "Color", block(page)), "red");

    await canvas(page).getByText("Two", { exact: true }).click();

    await expect(field(page, "Color", block(page))).toHaveValue("#000000");
    await expect(block(page).getByRole("alert")).toHaveCount(0);
  });

  test("the color picker replaces a refused value", async ({ page }) => {
    await textBlock(page).click();
    const color = field(page, "Color", block(page));
    await change(color, "red");

    await field(page, "Color picker", block(page)).fill("#00ff00");

    await expect(color).toHaveValue("#00ff00");
    await expect(block(page).getByRole("alert")).toHaveCount(0);
  });

  test("escapes what it can't refuse", async ({ page }) => {
    await change(field(page, "Preheader"), '<script>alert("x")</script>');

    const html = await exportHtml(page);

    expect(html).not.toContain("<script>");
  });
});

test.describe("typing in a field", () => {
  test("doesn't reach the Block's text", async ({ page }) => {
    await textBlock(page).click();
    await page.keyboard.type("Hi");
    const before = await structure(page);
    await openTab(page, "Settings");

    await field(page, "Preheader").click();
    await page.keyboard.type("Typed here");
    await page.keyboard.press("Backspace");

    expect(await structure(page)).toStrictEqual(before);
    await expect(field(page, "Preheader")).toHaveValue("Typed her");
  });
});

test.describe("text that hasn't been committed", () => {
  test("is committed when Back is pressed", async ({ page }) => {
    await typeFontSize(page, "24");

    await canvas(page)
      .getByRole("button", { exact: true, name: "Back" })
      .click();

    expect(await blockProps(page)).toMatchObject({ fontSize: 24 });
    await canvas(page).getByText("One", { exact: true }).click();
    await expect(field(page, "Font size (px)", block(page))).toHaveValue("24");
    await expect(block(page).getByRole("alert")).toHaveCount(0);
  });

  test("is one undo step apart from the button's own", async ({ page }) => {
    await typeFontSize(page, "24");

    await addRow(page);
    await undoByKey(page);

    expect(await structure(page)).toHaveLength(1);
    expect(await blockProps(page)).toMatchObject({ fontSize: 24 });
    await undoByKey(page);
    expect(await blockProps(page)).not.toHaveProperty("fontSize");
  });

  test("is committed when a Row control is pressed", async ({ page }) => {
    await typeFontSize(page, "24");

    await chooseLayout(page, 1, "50/50");

    expect(await blockProps(page)).toMatchObject({ fontSize: 24 });
  });

  test("is committed when a drag handle is pressed", async ({ page }) => {
    await typeFontSize(page, "24");
    const handle = canvas(page).locator(".drag-handle").first();
    const box = await handle.boundingBox();
    if (!box) {
      throw new Error("The handle has no box");
    }

    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.down();
    await page.mouse.up();

    expect(await blockProps(page)).toMatchObject({ fontSize: 24 });
  });

  test("is in the Preview when that's pressed", async ({ page }) => {
    const preview = page.getByRole("button", { name: "Preview" });
    await preview.click();
    const body = page
      .frameLocator('iframe[title="Email preview"]')
      .locator("body");
    await expect(body).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await page.getByRole("button", { name: "Close" }).click();

    await field(page, "Background color").fill("#eeeeee");
    await preview.click();

    await expect(body).toHaveCSS("background-color", "rgb(238, 238, 238)");
  });

  test("still shows why when a button is pressed", async ({ page }) => {
    await field(page, "Language").fill("English");

    await addRow(page);
    await openTab(page, "Settings");

    await expect(email(page).getByRole("alert")).toHaveCount(1);
    await expect(field(page, "Language")).toHaveValue("English");
    expect(await structure(page)).toHaveLength(2);
  });
});

test.describe("focus", () => {
  test("stays in an Email field when undo removes the Block's settings", async ({
    page,
  }) => {
    await setValue(page, emailWith([[[]]]));
    await canvas(page)
      .getByRole("button", { name: /Add Text Block/u })
      .click();
    await expect(block(page)).toBeVisible();
    await openTab(page, "Settings");
    const width = field(page, "Width (px)");
    await width.click();

    await undoByKey(page);

    await expect(textBlock(page)).toHaveCount(0);
    await expect(width).toBeFocused();
  });

  test("stays in an Email field when redo brings them back", async ({
    page,
  }) => {
    await setValue(page, emailWith([[[]]]));
    await addText(page);
    await openTab(page, "Settings");
    const language = field(page, "Language");
    await language.click();
    await undoByKey(page);
    await expect(textBlock(page)).toHaveCount(0);

    await redoByKey(page);

    await expect(textBlock(page)).toHaveCount(1);

    await expect(language).toBeFocused();
    await page.keyboard.type("en");
    await page.keyboard.press("Enter");
    expect(await settingsOf(page)).toMatchObject({ language: "en" });
  });
});

test.describe("a saved language that isn't a code", () => {
  test("opens, and can be fixed in the panel", async ({ page }) => {
    const document = emailWith([[["Hi"]]]);
    document.settings.language = "en_US";
    await canvas(page).evaluate((element) => {
      element.addEventListener("mq-error", () => {
        element.dataset.refused = "true";
      });
    });
    await setValue(page, document);

    await expect(field(page, "Language")).toHaveValue("en_US");
    await expect(canvas(page)).not.toHaveAttribute("data-refused", "true");

    await change(field(page, "Width (px)"), "500");
    expect(await settingsOf(page)).toMatchObject({
      language: "en_US",
      width: 500,
    });

    await change(field(page, "Language"), "en-US");
    expect(await settingsOf(page)).toMatchObject({ language: "en-US" });
  });
});

test.describe("input method composition", () => {
  test("Escape leaves what's being typed alone", async ({ page }) => {
    const preheader = field(page, "Preheader");
    await preheader.click();
    await page.keyboard.type("Hello");

    await preheader.evaluate((element) => {
      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          composed: true,
          isComposing: true,
          key: "Escape",
        })
      );
    });
    await canvas(page).evaluate((element) =>
      (element as MailQuilt).requestUpdate()
    );

    await expect(preheader).toHaveValue("Hello");
  });
});

test.describe("the color picker", () => {
  test("shows what's behind a Row with no color", async ({ page }) => {
    const document = emailWith([[["Hi"]]]);
    document.settings.backgroundColor = "#123456";
    await setValue(page, document);
    await selectRow(page, 1);

    await expect(field(page, "Background color", row(page))).toHaveValue("");
    await expect(field(page, "Background color picker", row(page))).toHaveValue(
      "#123456"
    );
  });

  test("offers white on a Row over a dark email", async ({ page }) => {
    const document = emailWith([[["Hi"]]]);
    document.settings.backgroundColor = "#000000";
    await setValue(page, document);
    await selectRow(page, 1);

    await field(page, "Background color picker", row(page)).fill("#ffffff");

    const { rows } = await currentValue(page);
    expect(rows[0]?.props).toStrictEqual({ backgroundColor: "#ffffff" });
  });
});

test.describe("layout", () => {
  test("puts the panel below rather than squeeze the email", async ({
    page,
  }) => {
    for (const width of [700, 900]) {
      // oxlint-disable-next-line no-await-in-loop -- Each width in turn.
      await inHostOf(page, width);
      const onCanvas = canvas(page).locator(".email");
      // oxlint-disable-next-line no-await-in-loop -- See above.
      await expect(onCanvas).toHaveCSS("width", "600px");
      // oxlint-disable-next-line no-await-in-loop -- See above.
      const emailBox = await onCanvas.boundingBox();
      // oxlint-disable-next-line no-await-in-loop -- See above.
      const panelBox = await canvas(page).locator(".side-panel").boundingBox();
      // oxlint-disable-next-line no-await-in-loop -- See above.
      const hostBox = await canvas(page).boundingBox();
      expect(panelBox?.y).toBeGreaterThanOrEqual(
        (emailBox?.y ?? 0) + (emailBox?.height ?? 0)
      );
      // Below, it takes the editor's whole width.
      expect(panelBox?.width).toBe(hostBox?.width);
    }
  });

  test("keeps the panel docked on the right when the email fits beside it", async ({
    page,
  }) => {
    await inHostOf(page, 1100);

    const emailBox = await canvas(page).locator(".email").boundingBox();
    const panelBox = await canvas(page).locator(".side-panel").boundingBox();
    const hostBox = await canvas(page).boundingBox();
    expect(panelBox?.y).toBe(hostBox?.y);
    expect(panelBox?.x).toBeGreaterThanOrEqual(
      (emailBox?.x ?? 0) + (emailBox?.width ?? 0)
    );
    expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBe(
      (hostBox?.x ?? 0) + (hostBox?.width ?? 0)
    );
  });

  test("puts the panel below for a wider email that no longer fits", async ({
    page,
  }) => {
    await inHostOf(page, 1100);

    await change(field(page, "Width (px)"), "800");

    await expect(canvas(page).locator(".email")).toHaveCSS("width", "800px");
    const emailBox = await canvas(page).locator(".email").boundingBox();
    const panelBox = await canvas(page).locator(".side-panel").boundingBox();
    expect(panelBox?.y).toBeGreaterThanOrEqual(
      (emailBox?.y ?? 0) + (emailBox?.height ?? 0)
    );
  });
});

test.describe("accessibility", () => {
  test("has no violations while showing a refused value", async ({ page }) => {
    await textBlock(page).click();
    await change(field(page, "Color", block(page)), "red");
    expect(await violations(page)).toStrictEqual([]);
    await openTab(page, "Settings");
    await change(field(page, "Language"), "English");

    expect(await violations(page)).toStrictEqual([]);
  });

  test("names every control and shows where focus is", async ({ page }) => {
    await canvas(page).evaluate((element, accent) => {
      (element as HTMLElement).style.setProperty("--mq-color-accent", accent);
    }, ACCENT);

    await expectEach(email(page));
    await selectRow(page, 1);
    await expectEach(row(page));
    await textBlock(page).click();
    await expectEach(block(page));
  });
});
