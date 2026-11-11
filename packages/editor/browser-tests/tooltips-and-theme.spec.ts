import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { canvas, openBlocks, textBlock } from "./helpers.js";

const tooltip = (page: Page) => canvas(page).getByRole("tooltip");

const undoButton = (page: Page) =>
  canvas(page).getByRole("button", { exact: true, name: "Undo" });

/** Every icon-only button: no text of its own, so its name comes from a label. */
const iconButtons = (page: Page) =>
  canvas(page).evaluate((host) =>
    [...(host.shadowRoot?.querySelectorAll("button") ?? [])]
      .filter((button) => !button.textContent?.trim())
      .map((button) => ({
        name: button.getAttribute("aria-label"),
        tooltip: button.dataset.tooltip,
      }))
  );

test.describe("a tooltip", () => {
  test("shows on hover, with the button's name", async ({ page }) => {
    await openBlocks(page, ["text"]);
    await expect(tooltip(page)).toBeHidden();

    await undoButton(page).hover();

    await expect(tooltip(page)).toBeVisible();
    await expect(tooltip(page)).toHaveText(/^Undo \(.+Z\)$/u);
  });

  test("shows on keyboard focus", async ({ page }) => {
    await openBlocks(page, ["text"]);
    await undoButton(page).focus();
    // Browsers only show focus from a script after keyboard use.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");

    await expect(undoButton(page)).toBeFocused();
    await expect(tooltip(page)).toHaveText(/^Undo/u);
  });

  test("stays while the pointer moves over it", async ({ page }) => {
    await openBlocks(page, ["text"]);
    await undoButton(page).hover();
    await expect(tooltip(page)).toBeVisible();

    const box = await tooltip(page).boundingBox();
    if (!box) {
      throw new Error("The tooltip has no box");
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 4,
    });

    await expect(tooltip(page)).toBeVisible();

    await page.mouse.move(5, 5);
    await expect(tooltip(page)).toBeHidden();
  });

  test("stays by its button on a page that transforms the editor", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await canvas(page).evaluate((element) => {
      (element.parentElement as HTMLElement).style.transform =
        "translate(40px, 30px)";
    });

    await undoButton(page).hover();

    await expect(tooltip(page)).toBeVisible();
    const button = await undoButton(page).boundingBox();
    const shown = await tooltip(page).boundingBox();
    if (!(button && shown)) {
      throw new Error("The button or tooltip has no box");
    }
    expect(
      Math.abs(shown.x + shown.width / 2 - (button.x + button.width / 2))
    ).toBeLessThan(2);
    // Next to it, above or below.
    expect(
      Math.min(
        Math.abs(button.y - (shown.y + shown.height)),
        Math.abs(shown.y - (button.y + button.height))
      )
    ).toBeLessThan(10);
  });

  test("closes with Escape, without moving focus or the pointer", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await undoButton(page).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(tooltip(page)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(tooltip(page)).toBeHidden();
    await expect(undoButton(page)).toBeFocused();
  });

  test("every icon button has a name and a tooltip", async ({ page }) => {
    await openBlocks(page, ["text"], []);
    await textBlock(page).click();
    await canvas(page).locator(".row").hover();

    const buttons = await iconButtons(page);

    // Undo, Redo, Preview, Back, the Row's four, five to move or delete the
    // Block, five to format text and six in the empty Column.
    expect(buttons.length).toBe(24);
    for (const { name, tooltip: text } of buttons) {
      // The tooltip can leave out where the button is, and add its shortcut.
      expect(name).toMatch(/\w/u);
      expect(name?.startsWith(text?.replace(/ \(.+\)$/u, "") ?? "-")).toBe(
        true
      );
    }
  });
});

test.describe("theme tokens", () => {
  test("a host overrides them on the element", async ({ page }) => {
    await openBlocks(page, ["text"]);
    const workspace = canvas(page).locator(".canvas-area");
    await expect(workspace).toHaveCSS("background-color", "rgb(238, 239, 241)");

    await canvas(page).evaluate((element) => {
      element.style.setProperty("--mq-color-workspace", "rgb(1, 2, 3)");
      element.style.setProperty("--mq-color-accent", "rgb(200, 0, 100)");
      element.style.setProperty("--mq-font-family", "Georgia, serif");
    });

    await expect(workspace).toHaveCSS("background-color", "rgb(1, 2, 3)");
    await expect(
      canvas(page).getByRole("tab", { name: "Content" }).locator("svg")
    ).toHaveCSS("color", "rgb(200, 0, 100)");
    await expect(canvas(page).getByRole("tab", { name: "Content" })).toHaveCSS(
      "font-family",
      "Georgia, serif"
    );
  });

  test("don't reach the email card, which shows the email's settings", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);

    await canvas(page).evaluate((element) => {
      element.style.setProperty("--mq-font-family", "Georgia, serif");
      element.style.setProperty("--mq-color-surface", "rgb(1, 2, 3)");
    });

    await expect(canvas(page).locator(".email")).toHaveCSS(
      "font-family",
      "Arial, Helvetica, sans-serif"
    );
    await expect(canvas(page).locator(".email")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)"
    );
  });
});

test("a host restyles the editor's frame through its part", async ({
  page,
}) => {
  await openBlocks(page, ["text"]);
  const frame = canvas(page).locator(".editor");
  await expect(frame).toHaveCSS("border-radius", "10px");

  await page.addStyleTag({
    content: "mail-quilt::part(frame) { border-radius: 0; box-shadow: none; }",
  });

  await expect(frame).toHaveCSS("border-radius", "0px");
  await expect(frame).toHaveCSS("box-shadow", "none");
});

test.describe("on a dark host page", () => {
  test("every surface keeps the editor's own colors", async ({ page }) => {
    await openBlocks(page, ["text"], []);
    await page.addStyleTag({
      content:
        "html, body, main { background: #000 !important; color: #fff !important; font-family: serif !important; }",
    });
    await textBlock(page).click();
    await undoButton(page).hover();

    const surfaces = await canvas(page).evaluate((host) => {
      const root = host.shadowRoot as ShadowRoot;
      const style = (selector: string) => {
        const element = root.querySelector(selector) as Element;
        const { backgroundColor, color, fontFamily } =
          getComputedStyle(element);
        return { backgroundColor, color, serif: fontFamily === "serif" };
      };
      return {
        blockTools: style(".block-toolbar"),
        floating: style(".floating-toolbar"),
        formatBar: style(".format-bar"),
        panel: style(".side-panel-inner"),
        placeholder: style(".placeholder"),
        rowTools: style(".row-toolbar .bar"),
        tooltip: style(".tooltip"),
        workspace: style(".canvas-area"),
      };
    });

    const white = "rgb(255, 255, 255)";
    const text = "rgb(22, 24, 29)";
    expect(surfaces).toEqual({
      blockTools: { backgroundColor: text, color: white, serif: false },
      floating: { backgroundColor: white, color: text, serif: false },
      formatBar: { backgroundColor: white, color: text, serif: false },
      panel: { backgroundColor: white, color: text, serif: false },
      placeholder: {
        backgroundColor: white,
        color: "rgb(95, 101, 112)",
        serif: false,
      },
      rowTools: { backgroundColor: white, color: text, serif: false },
      tooltip: {
        backgroundColor: text,
        color: "rgb(247, 247, 248)",
        serif: false,
      },
      workspace: {
        backgroundColor: "rgb(238, 239, 241)",
        color: text,
        serif: false,
      },
    });
  });
});
