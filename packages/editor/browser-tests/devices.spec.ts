import { expect } from "@playwright/test";
import type { Browser, Locator, Page } from "@playwright/test";

import { PHONE_WIDTH } from "../src/top-bar.js";
import {
  blockWith,
  canvas,
  change,
  currentValue,
  emailWith,
  exportHtml,
  field,
  openEmail,
  openMore,
  openPopover,
  rowTag,
  selectionBar,
  selectRow,
  setValue,
  test,
  textOf,
  violations,
} from "./helpers.js";

// Showing a Block or Row on one device, and Phone values: what the Phone view
// shows and changes, and that the Canvas draws what the export shows at each
// width.

const view = (page: Page, name: "Desktop" | "Phone") =>
  canvas(page).getByRole("group", { name: "View" }).getByRole("button", {
    name,
  });

const firstRowProps = async (page: Page) => {
  const { rows } = await currentValue(page);
  return rows[0]?.props;
};

const firstBlockProps = async (page: Page) => {
  const { rows } = await currentValue(page);
  return rows[0]?.columns[0]?.blocks[0]?.props;
};

const fontSizeOf = (locator: Locator) =>
  locator.evaluate((element) => getComputedStyle(element).fontSize);

/**
 * A Text Block's font size in the export, read in a page `width` px wide, as
 * an email client that keeps the email's styles draws it.
 */
const exportedFontSize = async (
  browser: Browser,
  html: string,
  width: number,
  text: string
) => {
  const page = await browser.newPage({ viewport: { height: 800, width } });
  await page.setContent(html);
  const size = await fontSizeOf(page.locator("p", { hasText: text }));
  await page.close();
  return size;
};

/** Whether the export shows `text` in a page `width` px wide. */
const exportShows = async (
  browser: Browser,
  html: string,
  width: number,
  text: string
) => {
  const page = await browser.newPage({ viewport: { height: 800, width } });
  await page.setContent(html);
  const shown = await page.locator("p", { hasText: text }).isVisible();
  await page.close();
  return shown;
};

test.describe("Phone values", () => {
  test("a font size changed in the Phone view is a Phone value, marked, and drawn as the export draws it at both widths", async ({
    browser,
    page,
  }) => {
    await openEmail(page, [[["Hello"]]]);
    await textOf(page, "Hello").click();
    await view(page, "Phone").click();
    const size = field(page, "Font size (px)");

    await change(size, "28");

    const props = await firstBlockProps(page);
    expect(props).toMatchObject({ phone: { fontSize: 28 } });
    expect(props).not.toHaveProperty("fontSize");
    await expect(size).toHaveAccessibleDescription(
      "Font size on phones 28px on phones, 16px on desktop. Use the desktop value (16px)"
    );
    const html = await exportHtml(page);
    expect(await fontSizeOf(textOf(page, "Hello"))).toBe("28px");
    expect(await exportedFontSize(browser, html, PHONE_WIDTH, "Hello")).toBe(
      "28px"
    );

    await view(page, "Desktop").click();
    await expect(size).toHaveValue("16");
    expect(await fontSizeOf(textOf(page, "Hello"))).toBe("16px");
    expect(await exportedFontSize(browser, html, 600, "Hello")).toBe("16px");
  });

  test("the card under a marked field goes back to the desktop value, from the keyboard", async ({
    page,
  }) => {
    await openEmail(page, [[["Hello"]]]);
    await textOf(page, "Hello").click();
    await view(page, "Phone").click();
    const size = field(page, "Font size (px)");
    await change(size, "28");
    await size.focus();
    const back = selectionBar(page).getByRole("button", {
      name: "Use the desktop value (16px)",
    });
    await expect(back).toBeVisible();
    expect(await violations(page)).toStrictEqual([]);

    await page.keyboard.press("ArrowRight");
    await expect(back).toBeFocused();
    await page.keyboard.press("Enter");

    expect(await firstBlockProps(page)).not.toHaveProperty("phone");
    await expect(size).toHaveValue("16");
  });

  test("a Row's padding in the Phone view is a Phone value, cleared by its ✕", async ({
    page,
  }) => {
    await openEmail(page, [[["Hello"]]]);
    await selectRow(page, 1);
    await view(page, "Phone").click();
    const dialog = await openPopover(page, /^Padding/u);

    await change(dialog.getByLabel("Every side (px)", { exact: true }), "8");

    expect(await firstRowProps(page)).toStrictEqual({
      phone: {
        paddingBottom: 8,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 8,
      },
    });
    await expect(canvas(page).getByTestId("row")).toHaveCSS(
      "padding-left",
      "8px"
    );
    await dialog
      .getByRole("button", { name: "Use the desktop value (0px)" })
      .click();
    expect(await firstRowProps(page)).toStrictEqual({});
  });
});

test.describe("showing on a device", () => {
  test("a Block for phones only is a strip on the desktop, whole in the Phone view, and left out of the desktop export", async ({
    browser,
    page,
  }) => {
    await openEmail(page, [[["Shown"], ["Phones"]]]);
    await textOf(page, "Phones").click();
    const more = await openMore(page);

    await more
      .getByRole("group", { name: "Show on" })
      .getByRole("button", { name: "Phones only" })
      .click();

    const strip = canvas(page).getByTestId("away-strip");
    await expect(strip).toHaveText("Text · Phones only");
    await expect(selectionBar(page)).toHaveAccessibleDescription("Phones only");
    const html = await exportHtml(page);
    expect(await exportShows(browser, html, 600, "Phones")).toBe(false);
    expect(await exportShows(browser, html, PHONE_WIDTH, "Phones")).toBe(true);

    await view(page, "Phone").click();
    await expect(strip).toHaveCount(0);
    await expect(textOf(page, "Phones")).toBeVisible();
  });

  test("a Row for desktop only is marked in the Rows list and on its tag, and folds in the Phone view, where Columns stack", async ({
    page,
  }) => {
    const email = emailWith([[["Left"], ["Right"]], [["Desk"]]]);
    await page.goto("/");
    await setValue(page, {
      ...email,
      rows: email.rows.map((row, index) =>
        index === 1 ? { ...row, props: { showOn: "desktop" } } : row
      ),
    });
    await expect(
      canvas(page).getByRole("button", {
        name: "Row 2 of 2: Text. Desktop only",
      })
    ).toBeVisible();
    await expect(
      rowTag(page, 2).locator('[data-tooltip="Desktop only"]')
    ).toBeAttached();

    await view(page, "Phone").click();

    await expect(canvas(page).getByTestId("away-strip")).toHaveText(
      "Row 2 · Desktop only"
    );
    const [left, right] = await Promise.all(
      ["Left", "Right"].map((text) =>
        textOf(page, text).evaluate((element) => {
          const { left: x, top: y } = element.getBoundingClientRect();
          return { x, y };
        })
      )
    );
    expect(right?.y).toBeGreaterThan(left?.y ?? 0);
    expect(right?.x).toBe(left?.x);
    // Each as wide as the Row, as the export draws them on a phone.
    const widths = await canvas(page)
      .getByTestId("row")
      .first()
      .evaluate((row) =>
        [row, ...row.children].map((each) => each.getBoundingClientRect().width)
      );
    expect(new Set(widths).size).toBe(1);
    expect(await violations(page)).toStrictEqual([]);

    // A press on the strip selects its Row.
    await canvas(page).getByTestId("away-strip").click();
    await expect(selectionBar(page)).toHaveAccessibleName(/Row 2/u);
  });

  test("faded, it's drawn whole with a tag; hidden, it isn't drawn and the arrow keys pass it", async ({
    page,
  }) => {
    await openEmail(page, [[["One"], ["Two"], ["Three"]]]);
    await textOf(page, "Two").click();
    const more = await openMore(page);
    await more.getByRole("button", { name: "Phones only" }).click();

    await canvas(page).evaluate((element) => {
      (element as unknown as { notOnDevice: string }).notOnDevice = "fade";
    });
    await expect(textOf(page, "Two")).toBeVisible();
    await expect(canvas(page).getByTestId("away-tag")).toHaveText(
      "Phones only"
    );

    await canvas(page).evaluate((element) => {
      (element as unknown as { notOnDevice: string }).notOnDevice = "hide";
    });
    await expect(blockWith(page, "Two")).toHaveCount(0);
    await blockWith(page, "One").focus();
    await page.keyboard.press("ArrowDown");
    await expect(blockWith(page, "Three")).toBeFocused();
  });
});
