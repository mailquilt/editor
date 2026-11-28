import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  blockWith,
  boxOf,
  canvas,
  checkPanel,
  checkTab,
  currentValue,
  emailWith,
  hostEvents,
  linkUrlField,
  moreButton,
  openEmail,
  PHONE_VIEWPORT,
  selectionBar,
  setValue,
  sheet,
  structure,
  styleSetting,
  test,
  textBlock,
  textOf,
  topMenuButton,
  violations,
} from "./helpers.js";

/** Whether focus is on `locator` or inside it, looking through shadow roots. */
const holdsFocus = (locator: Locator) =>
  locator.evaluate((element) => {
    let focused = document.activeElement;
    while (focused?.shadowRoot?.activeElement) {
      focused = focused.shadowRoot.activeElement;
    }
    return focused !== null && element.contains(focused);
  });

/** Selects a Text Block by tapping its text, then leaves the text for the Block. */
const selectBlock = async (page: Page, text: string) => {
  await textOf(page, text).click();
  await canvas(page).getByRole("button", { exact: true, name: "Done" }).click();
  await expect(blockWith(page, text)).toHaveAttribute("aria-current", "true");
};

/**
 * The Shell, as wide as the phone, rather than the test page's box, which is
 * narrower than any phone once its own styles have had their way.
 */
const openFullWidth = async (page: Page) => {
  await page.goto("/shell.html?narrow");
  await page
    .getByTestId("frame")
    .evaluate((frame) => frame.style.setProperty("width", "100%"));
  await expect(textBlock(page).first()).toBeVisible();
};

test.describe("on a phone", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("edits the email, with the Selection bar docked under it", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);

    await textOf(page, "A").click();
    await page.keyboard.press("End");
    await page.keyboard.type("bc");

    await expect(textOf(page, "Abc")).toBeVisible();
    // While typing, the format bar is at the bottom, and Done leaves the text.
    await expect(
      canvas(page).getByRole("toolbar", { name: "Text formatting" })
    ).toBeInViewport();
    await canvas(page)
      .getByRole("button", { exact: true, name: "Done" })
      .click();
    await expect(blockWith(page, "Abc")).toBeFocused();
    const bar = await boxOf(selectionBar(page));
    const email = await boxOf(canvas(page).getByTestId("email"));
    expect(bar.y).toBeGreaterThanOrEqual(email.y + email.height);
  });

  test("opens the chip's menu as a sheet: what's selected, then what it's in", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await selectBlock(page, "A");

    const chip = selectionBar(page).locator('[data-action="chip"]');
    await chip.click();
    const select = sheet(page, "Select");
    await expect(select).toBeVisible();
    await expect(select).toContainText("The Text Block, or what it's in");
    const items = canvas(page).getByRole("menuitemradio");
    await expect(items).toHaveText(["Text", "Column 1", "Row 1", "Email"]);
    await expect(items.first()).toHaveAttribute("aria-checked", "true");
    await expect(items.first()).toBeFocused();
    // Not clipped by the bar.
    await expect(items.last()).toBeInViewport({ ratio: 1 });

    await items.nth(2).click();
    await expect(select).toBeHidden();
    await expect(chip).toHaveAccessibleName("Row 1");

    // Done and Escape close it back to the chip.
    await chip.click();
    await select.getByRole("button", { exact: true, name: "Done" }).click();
    await expect(select).toBeHidden();
    await expect(chip).toBeFocused();
    await chip.click();
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(select).toBeHidden();
    await expect(chip).toBeFocused();
  });

  test("keeps a Block's bar to its main field, a color and More, with its actions in More", async ({
    page,
  }) => {
    await openFullWidth(page);
    const blocks = textBlock(page);
    await blocks.first().click();
    await canvas(page)
      .getByRole("button", { exact: true, name: "Done" })
      .click();
    const blockCount = async () => {
      const { rows } = await currentValue(page);
      return rows.flatMap(({ columns }) =>
        columns.flatMap((column) => column.blocks)
      ).length;
    };
    const count = await blockCount();

    const bar = selectionBar(page);
    // Not drawn there at all, rather than hidden while the bar is short.
    await expect(bar.locator('[data-action="move-up"]')).toHaveCount(0);
    await expect(bar.locator('[data-action^="choice-align"]')).toHaveCount(0);
    await expect(bar.getByRole("button", { name: /^Color/u })).toBeVisible();
    // It all fits, so nothing scrolls out of sight.
    expect(
      await bar.evaluate(
        ({ scrollWidth, clientWidth }) => scrollWidth <= clientWidth
      )
    ).toBe(true);

    await moreButton(page).click();
    const more = sheet(page, "Text");
    await expect(more.getByText("Alignment", { exact: true })).toBeVisible();
    for (const name of ["Move up", "Move down", "Duplicate", "Delete"]) {
      await expect(
        more.getByRole("button", { exact: true, name })
      ).toBeVisible();
    }
    await more.getByRole("button", { exact: true, name: "Duplicate" }).click();
    // At once, as a Command applies.
    expect(await blockCount()).toBe(count + 1);
  });

  for (const width of [390, 320]) {
    test(`fits a Button's bar at ${width}px, with its link, its fill and More at the end`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 800, width });
      await openFullWidth(page);
      await selectionBar(page)
        .getByRole("button", { exact: true, name: "Add" })
        .click();
      await sheet(page, "Add")
        .getByRole("button", { name: /Button/u })
        .click();

      const bar = selectionBar(page);
      await expect(bar.getByRole("textbox")).toBeVisible();
      const fill = bar.getByRole("button", { name: /^Fill/u });
      await expect(fill).toBeInViewport({ ratio: 1 });
      expect(
        await bar.evaluate(
          ({ scrollWidth, clientWidth }) => scrollWidth <= clientWidth
        )
      ).toBe(true);
      // More is at the bar's end.
      const more = await boxOf(moreButton(page));
      const box = await boxOf(bar);
      expect(box.x + box.width - (more.x + more.width)).toBeLessThan(16);
    });
  }

  test("chooses a Video's play button from More, as the bar does", async ({
    page,
  }) => {
    await openFullWidth(page);
    await selectionBar(page)
      .getByRole("button", { exact: true, name: "Add" })
      .click();
    await sheet(page, "Add").getByRole("button", { name: /Video/u }).click();
    await moreButton(page).click();

    const more = sheet(page, "Video");
    // Its own control, which draws the play button on the picture, rather
    // than a plain list that would only save the choice.
    await expect(
      more.getByRole("combobox", { name: "Play button" })
    ).toHaveCount(0);
    await more.getByRole("button", { name: /^Play button/u }).click();
    const choices = sheet(page, "Play button");
    await expect(choices).toBeVisible();
    await choices.getByRole("radio", { name: /None/u }).check();
    await expect(
      more.getByRole("button", { name: "Play button: None" })
    ).toBeVisible();
  });

  test("fits a Row's bar, its layouts in a sheet from Columns", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 320 });
    await openFullWidth(page);
    await textBlock(page).first().click();
    await canvas(page)
      .getByRole("button", { exact: true, name: "Done" })
      .click();
    await selectionBar(page).locator('[data-action="chip"]').click();
    await canvas(page).getByRole("menuitemradio", { name: "Row 1" }).click();

    const bar = selectionBar(page);
    expect(
      await bar.evaluate(
        ({ scrollWidth, clientWidth }) => scrollWidth <= clientWidth
      )
    ).toBe(true);
    const columns = bar.getByRole("button", { name: /^Columns/u });
    await columns.focus();
    await page.keyboard.press("Enter");
    const layouts = sheet(page, "Columns");
    // At the layout the Row has, and Tab goes along the rest.
    await expect(
      layouts.getByRole("button", { name: "100 layout" })
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      layouts.getByRole("button", { name: "50/50 layout" })
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(textBlock(page).first()).toBeVisible();
    await expect(layouts).toBeHidden();
    await expect(columns).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      layouts.getByRole("button", { name: "50/50 layout" })
    ).toBeFocused();
  });

  test("fits a Column's bar, with its padding, alignment and border in More", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 320 });
    await openFullWidth(page);
    await textBlock(page).first().click();
    await canvas(page)
      .getByRole("button", { exact: true, name: "Done" })
      .click();
    await selectionBar(page).locator('[data-action="chip"]').click();
    await canvas(page).getByRole("menuitemradio", { name: "Column 1" }).click();

    const bar = selectionBar(page);
    expect(
      await bar.evaluate(
        ({ scrollWidth, clientWidth }) => scrollWidth <= clientWidth
      )
    ).toBe(true);
    await moreButton(page).click();
    const more = sheet(page, "Column 1");
    await expect(more).toBeVisible();
    // As a Block's More has them: each opens its own sheet.
    await expect(more.getByRole("button", { name: /^Border/u })).toBeVisible();
    await more.getByRole("button", { name: /^Padding/u }).click();
    await expect(sheet(page, "Padding")).toBeVisible();
  });

  test("with nothing selected, opens the email's settings from its Email chip", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    const bar = selectionBar(page);
    await expect(
      bar.getByRole("button", { name: "More settings and actions" })
    ).toHaveCount(0);

    const chip = bar.getByRole("button", { exact: true, name: "Email" });
    await chip.click();
    const settings = sheet(page, "Email");
    await expect(
      canvas(page).getByRole("textbox", { exact: true, name: "Preheader" })
    ).toBeVisible();
    await settings.getByRole("button", { exact: true, name: "Done" }).click();
    await expect(settings).toBeHidden();
    await expect(chip).toBeFocused();
  });

  test("with nothing selected, says to tap a Block, and adds from a sheet", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await expect(selectionBar(page)).toContainText("Tap a Block to change it");

    await selectionBar(page)
      .getByRole("button", { exact: true, name: "Add" })
      .click();
    const add = sheet(page, "Add");
    await expect(add).toBeVisible();
    await add.getByRole("button", { name: /Divider/u }).click();

    await expect(add).toBeHidden();
    await expect(
      canvas(page).getByRole("group", { name: /^Divider Block/u })
    ).toBeVisible();
  });

  test("opens More as a sheet that keeps focus, and Escape closes it back to More", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await selectBlock(page, "A");
    await moreButton(page).focus();
    await page.keyboard.press("Enter");
    const more = sheet(page, "Text");
    await expect(more).toBeVisible();
    await expect.poll(() => holdsFocus(more)).toBe(true);
    // At its first setting, not the Move up button above it.
    await expect(
      more.getByRole("combobox", { name: "Alignment" })
    ).toBeFocused();

    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.press("Tab");
    }
    await expect.poll(() => holdsFocus(more)).toBe(true);
    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.press("Shift+Tab");
    }
    await expect.poll(() => holdsFocus(more)).toBe(true);

    // Escape on a control with its tooltip showing closes only the tooltip.
    await more.getByRole("button", { exact: true, name: "Done" }).focus();
    await page.keyboard.press("Escape");
    await expect(more).toBeHidden();
    await expect(moreButton(page)).toBeFocused();
  });

  test("closes More with Done, back to More, and a press on the dimmed email", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await selectBlock(page, "A");
    await moreButton(page).click();
    const more = sheet(page, "Text");
    await more.getByRole("button", { exact: true, name: "Done" }).click();
    await expect(more).toBeHidden();
    await expect(moreButton(page)).toBeFocused();

    await moreButton(page).click();
    await expect(more).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(more).toBeHidden();
  });

  test("opens a popover from More as a sheet over it, with a back arrow", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await selectBlock(page, "A");
    await moreButton(page).click();
    await sheet(page, "Text")
      .getByRole("button", { name: /^Padding/u })
      .click();
    const padding = sheet(page, "Padding");
    await expect(padding).toBeVisible();

    await padding.getByRole("button", { exact: true, name: "Back" }).click();

    await expect(padding).toBeHidden();
    await expect(
      sheet(page, "Text").getByRole("button", { name: /^Padding/u })
    ).toBeFocused();
  });

  test("moves a Row in the Rows sheet from the top bar's menu", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"]]]);
    await topMenuButton(page).click();
    const menu = sheet(page, "More");
    await menu.getByRole("button", { name: /^Rows/u }).click();
    const rows = sheet(page, "Rows");
    // Focus goes into the sheet that takes the menu's place.
    await expect.poll(() => holdsFocus(rows)).toBe(true);

    await rows
      .getByRole("button", { exact: true, name: "Move Row down" })
      .first()
      .click();

    await expect(structure(page)).resolves.toEqual([[["B"]], [["A"]]]);
    // Focus stays with the Row, which can't go further down.
    await expect(
      rows.getByRole("button", { exact: true, name: "Move Row up" }).nth(1)
    ).toBeFocused();

    await rows.getByRole("button", { exact: true, name: "Back" }).click();
    await expect(menu.getByRole("button", { name: /^Rows/u })).toBeFocused();
    await menu.getByRole("button", { exact: true, name: "Done" }).click();
    await expect(topMenuButton(page)).toBeFocused();
  });

  test("switches the view from the top bar's menu, the Phone view first", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await topMenuButton(page).click();
    const menu = sheet(page, "More");
    const desktop = menu.getByRole("button", { exact: true, name: "Desktop" });
    await expect(
      menu.getByRole("button", { exact: true, name: "Phone" })
    ).toHaveAttribute("aria-pressed", "true");

    await desktop.click();

    await expect(desktop).toHaveAttribute("aria-pressed", "true");
  });

  test("shows Style at the bottom, and its Done goes back to Edit", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await canvas(page).getByRole("tab", { exact: true, name: "Style" }).click();
    const style = canvas(page).getByTestId("style-panel");
    await expect(style).toBeInViewport();

    await style.getByRole("button", { exact: true, name: "Done" }).click();

    await expect(
      canvas(page).getByRole("tab", { exact: true, name: "Edit" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(textBlock(page)).toBeVisible();
  });

  test("shows Style's sections one at a time, in a sheet that keeps its height", async ({
    page,
  }) => {
    await openFullWidth(page);
    await canvas(page).getByRole("tab", { exact: true, name: "Style" }).click();
    const panel = canvas(page).getByTestId("style-panel");
    const sections = panel.getByRole("group", { name: "Style settings" });
    const colors = sections.getByRole("button", {
      exact: true,
      name: "Colors",
    });
    const type = sections.getByRole("button", { exact: true, name: "Text" });
    await expect(colors).toHaveAttribute("aria-pressed", "true");
    await expect(styleSetting(page, "Page")).toBeVisible();
    await expect(styleSetting(page, "Headings")).toBeHidden();
    const { height } = await boxOf(panel);

    await type.click();
    await expect(type).toHaveAttribute("aria-pressed", "true");
    await expect(styleSetting(page, "Headings")).toBeVisible();
    await expect(styleSetting(page, "Page")).toBeHidden();
    const after = await boxOf(panel);
    expect(after.height).toBe(height);

    await sections
      .getByRole("button", { exact: true, name: "Button corners" })
      .click();
    await panel.getByRole("radio", { name: "Pill" }).check();
    // Its section's name isn't shown again, but the way back to the default is.
    await panel.getByRole("button", { name: /^Use the default/u }).click();
    await expect(panel.getByRole("radio", { name: "Pill" })).not.toBeChecked();
  });

  test("goes to the section of the setting a callout's button changes", async ({
    page,
  }) => {
    const email = emailWith([[["A"]]]);
    const block = email.rows[0]?.columns[0]?.blocks[0];
    if (block) {
      Object.assign(block.props, { fontSize: 20 });
    }
    await page.goto("/");
    await setValue(page, email);
    await selectBlock(page, "A");
    await canvas(page).getByRole("tab", { exact: true, name: "Style" }).click();
    const panel = canvas(page).getByTestId("style-panel");
    await expect(
      panel.getByRole("button", { exact: true, name: "Colors" })
    ).toHaveAttribute("aria-pressed", "true");

    await panel
      .getByRole("button", { name: "Make all body text 20px" })
      .click();
    await expect(
      panel.getByRole("button", { exact: true, name: "Text" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(styleSetting(page, "Body text")).toBeFocused();
  });

  test("keeps the font the arrow keys are on in sight, in the font sheet", async ({
    page,
  }) => {
    // Enough of the Host app's fonts that the list scrolls.
    await page.route("https://fonts.example.com/**", (route) =>
      route.fulfill({ body: "", contentType: "text/css" })
    );
    await openEmail(page, [[["A"]]]);
    await canvas(page).evaluate((element) => {
      (element as MailQuilt).fonts = Array.from({ length: 30 }, (_, index) => ({
        fallback: "serif",
        name: `Font ${index}`,
        url: `https://fonts.example.com/${index}.css`,
      }));
    });
    await canvas(page).getByRole("tab", { exact: true, name: "Style" }).click();
    // On a phone, the fonts are in the Text section.
    await canvas(page)
      .getByRole("button", { exact: true, name: "Text" })
      .click();
    await styleSetting(page, "Headings").focus();
    await page.keyboard.press("Enter");
    const search = canvas(page).getByRole("combobox", { name: "Search fonts" });
    await expect(search).toBeFocused();

    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.press("ArrowDown");
    }
    const active = canvas(page).locator('[role="option"][data-active]');
    await expect(active).toBeInViewport({ ratio: 1 });
    // The list scrolls under the search field, which stays in sight.
    await expect(search).toBeInViewport({ ratio: 1 });
  });

  test("keeps Tab in a Style sheet, at its first and last stops", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await canvas(page).getByRole("tab", { exact: true, name: "Style" }).click();
    // On a phone, the fonts are in the Text section.
    await canvas(page)
      .getByRole("button", { exact: true, name: "Text" })
      .click();
    await styleSetting(page, "Headings").focus();
    await page.keyboard.press("Enter");
    const fonts = sheet(page, "Headings");
    await expect(fonts).toBeVisible();

    // Round past both ends, which the Style panel's own Tab used to leave by.
    // Chromium and WebKit stop once at the page itself on the way round, for
    // the browser's own controls, but never at the Style panel behind.
    await fonts.getByRole("button", { exact: true, name: "Back" }).focus();
    for (const key of ["Shift+Tab", "Tab"]) {
      for (let step = 0; step < 5; step += 1) {
        await page.keyboard.press(key);
        await expect(fonts).toBeVisible();
        expect(
          (await holdsFocus(fonts)) ||
            (await page.evaluate(
              () => document.activeElement === document.body
            ))
        ).toBe(true);
      }
    }
  });

  test("checks the email, with its Problems at the bottom", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await checkTab(page).click();

    await expect(checkPanel(page)).toContainText("No preheader");
    await expect(checkPanel(page)).toBeInViewport();
  });

  test("shows the link a bar field will save above the bar, clear of its scrolling", async ({
    page,
  }) => {
    const email = emailWith([[[]]]);
    email.rows[0]?.columns[0]?.blocks.push({
      id: "button-1",
      props: { label: "Shop" },
      type: "button",
    });
    await openFullWidth(page);
    await setValue(page, email);
    await canvas(page).getByRole("group", { name: "Button Block" }).click();

    await selectionBar(page)
      .getByRole("textbox", { exact: true, name: "Link" })
      .fill("example.com");

    await expect(
      canvas(page).getByText("Links to https://example.com")
    ).toBeInViewport({ ratio: 1 });
  });

  test("fixes a Problem with the email's own field in More", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await checkTab(page).click();

    await checkPanel(page)
      .getByRole("button", { exact: true, name: "Add a preheader" })
      .click();

    await expect(sheet(page, "Email")).toBeVisible();
    await expect(
      canvas(page).getByRole("textbox", { exact: true, name: "Preheader" })
    ).toBeFocused();
  });

  test("shows Check's Problems over the inbox, and only their head over the text", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await checkTab(page).click();
    const fix = checkPanel(page).getByRole("button", {
      exact: true,
      name: "Add a preheader",
    });
    await expect(fix).toBeVisible();

    await canvas(page)
      .getByRole("tab", { exact: true, name: "Plain text" })
      .click();
    await expect(fix).toBeHidden();

    await canvas(page)
      .getByRole("button", { exact: true, name: "Show what Check found" })
      .click();
    await expect(fix).toBeVisible();
  });

  test("closes a sheet dragged down by its grab, but not a drag that starts in it", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await topMenuButton(page).click();
    const menu = sheet(page, "More");
    // Once it has slid into place.
    await expect(menu).toHaveCSS("opacity", "1");
    const title = await boxOf(menu.getByRole("heading", { name: "More" }));

    // From the sheet's title to the dimmed page above it.
    await page.mouse.move(title.x + 4, title.y + 4);
    await page.mouse.down();
    await page.mouse.move(title.x + 4, title.y - 120);
    await page.mouse.up();
    await expect(menu).toBeVisible();

    const grab = await boxOf(menu.getByTestId("sheet-grab"));
    await page.mouse.move(grab.x + grab.width / 2, grab.y + grab.height / 2);
    await page.mouse.down();
    await page.mouse.move(grab.x + grab.width / 2, grab.y + 150, { steps: 5 });
    await page.mouse.up();
    await expect(menu).toBeHidden();
  });

  test("cancels the link sheet with Escape from its Apply button", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await textOf(page, "A").click();
    await canvas(page)
      .getByRole("button", { exact: true, name: "Link" })
      .click();
    const link = sheet(page, "Link");
    await expect(linkUrlField(page)).toBeFocused();

    await link.getByRole("button", { exact: true, name: "Apply" }).focus();
    await page.keyboard.press("Escape");

    await expect(link).toBeHidden();
  });

  test("leaves the page usable when More, left open in Edit, is behind Check", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 1280 });
    await openEmail(page, [[["A"]]]);
    await blockWith(page, "A").focus();
    await moreButton(page).click();
    await checkTab(page).click();

    await page.setViewportSize(PHONE_VIEWPORT);

    await expect(checkPanel(page)).toBeVisible();
    // No sheet is open where it can't be seen, which would make the page
    // inert, and the press would land on nothing.
    await expect
      .poll(() =>
        canvas(page).evaluate(
          (element) =>
            element.shadowRoot?.querySelectorAll("dialog[open]").length
        )
      )
      .toBe(0);
    await page
      .getByRole("button", { exact: true, name: "Host button" })
      .click({ timeout: 3000 });
  });

  test("passes the accessibility checks with a sheet open", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    expect(await violations(page)).toEqual([]);

    await selectBlock(page, "A");
    await moreButton(page).click();
    await expect(sheet(page, "Text")).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("gives the desktop layout back, with the same email, once there's room", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await topMenuButton(page).click();

    await page.setViewportSize({ height: 800, width: 1280 });

    await expect(sheet(page, "More")).toHaveCount(0);
    await expect(textOf(page, "A")).toBeVisible();
    await expect(
      canvas(page).getByRole("button", { exact: true, name: "Redo" })
    ).toBeVisible();
  });

  test("lays out in a host sized to fit its content", async ({ page }) => {
    await page.goto("/");
    // Reported only to the page's error listeners, not as an uncaught error or
    // a console message.
    const reported = await hostEvents(page, "error", ["message"]);
    // As a flex item that isn't stretched takes the width of what's inside, up
    // to the width there is.
    await page.addStyleTag({
      content:
        "mail-quilt { align-self: flex-start !important; max-width: 100% !important }",
    });
    await expect(textBlock(page)).toHaveText("Hello");

    await page.setViewportSize({ height: 800, width: 1280 });

    await expect(textBlock(page)).toHaveText("Hello");
    expect(await reported()).toStrictEqual([]);
  });
});

test.describe("the Shell on a phone", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("puts its name, Not on this device, Export and Import in the top bar's menu", async ({
    page,
  }) => {
    await page.goto("/shell.html?narrow");
    await expect(textBlock(page)).toBeVisible();
    await topMenuButton(page).click();
    await expect(sheet(page, /^Email/u)).toBeVisible();
    // The Shell's are slotted into the sheet, so they're the editor's children.
    const menu = canvas(page);

    await expect(
      menu.getByRole("button", { exact: true, name: "Export HTML file" })
    ).toBeVisible();
    await expect(
      menu.getByRole("button", { exact: true, name: "Import JSON…" })
    ).toBeVisible();
    const fade = menu.getByRole("button", { exact: true, name: "Fade" });
    await fade.click();
    await expect(fade).toHaveAttribute("aria-pressed", "true");
  });

  test("says in the Shell's menu why a file couldn't be imported", async ({
    page,
  }) => {
    page.on("filechooser", () => null);
    await page.goto("/shell.html?narrow");
    await expect(textBlock(page)).toBeVisible();
    await topMenuButton(page).click();
    const choosing = page.waitForEvent("filechooser");
    await canvas(page)
      .getByRole("button", { exact: true, name: "Import JSON…" })
      .click();
    const chooser = await choosing;
    await chooser.setFiles({
      buffer: Buffer.from("{not json"),
      mimeType: "application/json",
      name: "email.json",
    });
    // In the open sheet, as the page behind it is inert. The Shell slots it
    // in, so it's in the sheet's accessibility tree, not under it in the DOM.
    await expect(sheet(page, /^Email/u)).toMatchAriaSnapshot(
      "- alert: /couldn't be imported/"
    );
  });
});
