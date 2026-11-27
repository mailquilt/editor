import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  blockWith,
  boxOf,
  canvas,
  checkPanel,
  checkTab,
  hostEvents,
  linkUrlField,
  moreButton,
  openEmail,
  PHONE_VIEWPORT,
  selectionBar,
  sheet,
  structure,
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

  test("checks the email, with its Problems at the bottom", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await checkTab(page).click();

    await expect(checkPanel(page)).toContainText("No preheader");
    await expect(checkPanel(page)).toBeInViewport();
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
});
