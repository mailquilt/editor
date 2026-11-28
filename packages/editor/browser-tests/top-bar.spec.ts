import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  boxOf,
  canvas,
  checkTab,
  emailWith,
  openBlocks,
  openEmail,
  redoButton,
  setValue,
  structure,
  test,
  textBlock,
  textOf,
  undoButton,
  undoByKey,
  violations,
} from "./helpers.js";

const mode = (page: Page, name: string) =>
  canvas(page).getByRole("tab", { exact: true, name });

const modePanel = (page: Page, name: string) =>
  canvas(page).getByRole("tabpanel", { name });

const view = (page: Page, name: "Desktop" | "Phone") =>
  canvas(page)
    .getByRole("group", { name: "View" })
    .getByRole("button", { name });

test.describe("the Modes", () => {
  test("are chosen by pointer and by arrow keys, and say which one is chosen", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await expect(mode(page, "Edit")).toHaveAttribute("aria-selected", "true");
    await expect(modePanel(page, "Edit")).toBeVisible();

    await mode(page, "Style").click();

    await expect(mode(page, "Style")).toHaveAttribute("aria-selected", "true");
    await expect(mode(page, "Edit")).toHaveAttribute("aria-selected", "false");
    // Style shows the email, beside its Email style.
    await expect(modePanel(page, "Style")).toBeVisible();
    await expect(textOf(page, "A")).toBeVisible();

    // One stop for Tab, with the arrow keys between the Modes.
    await page.keyboard.press("ArrowRight");
    await expect(checkTab(page)).toBeFocused();
    await expect(checkTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(textOf(page, "A")).toBeHidden();
    await page.keyboard.press("Home");
    await expect(mode(page, "Edit")).toBeFocused();
    await expect(textOf(page, "A")).toBeVisible();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(mode(page, "Edit")).toBeFocused();
  });

  test("Style and Check are off with nothing in the email, and say why", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await mode(page, "Style").click();

    // As undo can empty the email while Style shows.
    await setValue(page, emailWith([]));

    await expect(mode(page, "Edit")).toHaveAttribute("aria-selected", "true");
    await expect(mode(page, "Style")).toHaveAttribute("aria-disabled", "true");
    // Playwright waits for a control that's off, so the click is sent as is.
    await mode(page, "Style").click({ force: true });
    await expect(mode(page, "Edit")).toHaveAttribute("aria-selected", "true");
    // Still a stop for the arrow keys, so its tooltip can say why.
    await mode(page, "Edit").focus();
    await page.keyboard.press("ArrowRight");
    await expect(mode(page, "Style")).toBeFocused();
    await expect(mode(page, "Edit")).toHaveAttribute("aria-selected", "true");
    await expect(canvas(page).getByRole("tooltip")).toHaveText(
      "Add something to the email first"
    );
  });
});

test.describe("undo and redo", () => {
  test("are off while there's nothing to undo or redo, and give way to each other", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await expect(undoButton(page)).toBeDisabled();
    await expect(redoButton(page)).toBeDisabled();

    await textBlock(page).click();
    await page.keyboard.type("Hi");
    await expect(undoButton(page)).toBeEnabled();
    await expect(redoButton(page)).toBeDisabled();

    await undoButton(page).focus();
    await page.keyboard.press("Enter");

    await expect(undoButton(page)).toBeDisabled();
    await expect(redoButton(page)).toBeEnabled();
    // As for any control that an update disables.
    await expect(redoButton(page)).toBeFocused();
  });

  test("work in Style, from the top bar and by key", async ({ page }) => {
    await openEmail(page, [[["A"]]]);
    await textOf(page, "A").click();
    await page.keyboard.type("B");
    const typed = await structure(page);
    await mode(page, "Style").click();

    await undoButton(page).click();
    expect(await structure(page)).toEqual([[["A"]]]);
    await redoButton(page).click();
    expect(await structure(page)).toEqual(typed);
    await mode(page, "Style").focus();
    await undoByKey(page);
    expect(await structure(page)).toEqual([[["A"]]]);
  });

  test("in Style, focus goes to the Mode when a new email takes undo away", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await textOf(page, "A").click();
    await page.keyboard.type("B");
    await mode(page, "Style").click();
    await undoButton(page).focus();

    await setValue(page, emailWith([[["C"]]]));

    await expect(mode(page, "Style")).toBeFocused();
  });
});

test.describe("the Desktop and Phone views", () => {
  test("show the email at a phone's width in Edit, and stay in Style", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    const email = canvas(page).getByTestId("email");
    await expect(email).toHaveCSS("width", "600px");

    await view(page, "Phone").click();

    await expect(view(page, "Phone")).toHaveAttribute("aria-pressed", "true");
    await expect(email).toHaveCSS("width", "375px");
    await mode(page, "Style").click();
    await expect(view(page, "Phone")).toHaveAttribute("aria-pressed", "true");
    // Check shows both widths, so it has no switch.
    await checkTab(page).click();
    await expect(canvas(page).getByRole("group", { name: "View" })).toHaveCount(
      0
    );
    await mode(page, "Edit").click();
    await expect(email).toHaveCSS("width", "375px");

    await view(page, "Desktop").click();
    await expect(email).toHaveCSS("width", "600px");
  });
});

test("stays in sight above the email as the page scrolls", async ({ page }) => {
  await page.setViewportSize({ height: 500, width: 1280 });
  await openEmail(page, [[["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]]]);
  await textOf(page, "J").scrollIntoViewIfNeeded();

  const bar = await boxOf(canvas(page).locator('[part="top-bar"]'));

  expect(bar.y).toBe(0);
});

test("meets WCAG 2.2 AA in each Mode", async ({ page }) => {
  await openEmail(page, [[["A"]]]);
  for (const name of ["Edit", "Style", "Check"]) {
    await mode(page, name).click();
    // Check shows the email in sandboxed iframes, left out here as check.spec.ts does.
    expect(
      await violations(page, "mail-quilt", { excludeIframe: name === "Check" })
    ).toEqual([]);
  }
});
