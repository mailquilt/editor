import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  blockGroup,
  blockTools,
  boxOf,
  canvas,
  centerOf,
  openBlocks,
  previewButton,
  settle,
  textBlock,
} from "./helpers.js";

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
  test("stays while the pointer moves over it", async ({ page }) => {
    await openBlocks(page, ["text"]);
    await undoButton(page).hover();
    await expect(tooltip(page)).toBeVisible();

    const { x, y } = await centerOf(tooltip(page));
    await page.mouse.move(x, y, { steps: 4 });

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
    const button = await boxOf(undoButton(page));
    const shown = await boxOf(tooltip(page));
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

  test("Escape on a Block tool only closes its tooltip, then goes back to the Block", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await page.mouse.move(0, 0);
    await blockGroup(page, "Text").focus();
    const moveUp = blockTools(page).getByRole("button", {
      name: "Move Block up",
    });
    await moveUp.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await expect(tooltip(page)).toHaveText(/Move Block up/u);

    await page.keyboard.press("Escape");
    await expect(tooltip(page)).toBeHidden();
    await expect(moveUp).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(blockGroup(page, "Text")).toBeFocused();
  });

  test("closes on a press, and doesn't open while the pointer is held", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    const preview = canvas(page).getByRole("button", {
      exact: true,
      name: "Preview",
    });
    await preview.hover();
    await expect(tooltip(page)).toHaveText("Preview");

    await page.mouse.down();
    await expect(tooltip(page)).toBeHidden();

    // Undo shows its tooltip on hover, as above, but not with a button held.
    const { x, y } = await centerOf(undoButton(page));
    await page.mouse.move(x, y, { steps: 4 });
    await settle(page);
    await expect(tooltip(page)).toBeHidden();
    await page.mouse.up();
  });

  test("every icon button has a name and a tooltip", async ({ page }) => {
    await openBlocks(page, ["text"], []);
    await textBlock(page).click();
    await canvas(page).locator(".row").hover();

    const buttons = await iconButtons(page);

    expect(buttons).not.toHaveLength(0);
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

    await canvas(page).evaluate((element) => {
      element.style.setProperty("--mq-color-workspace", "rgb(1, 2, 3)");
      element.style.setProperty("--mq-color-accent", "rgb(200, 0, 100)");
      element.style.setProperty("--mq-color-text-muted", "rgb(4, 5, 6)");
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
    // At rest, a tab that isn't selected and an icon button are muted.
    await expect(canvas(page).getByRole("tab", { name: "Rows" })).toHaveCSS(
      "color",
      "rgb(4, 5, 6)"
    );
    await expect(previewButton(page)).toHaveCSS("color", "rgb(4, 5, 6)");
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

test("in forced colors, a selected tab and a pressed button are outlined", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", "Only Chromium can emulate it");
  await page.emulateMedia({ forcedColors: "active" });
  await openBlocks(page, ["text"]);

  await expect(canvas(page).getByRole("tab", { name: "Content" })).toHaveCSS(
    "outline-style",
    "solid"
  );

  await textBlock(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+b");
  const bold = canvas(page).getByRole("button", { exact: true, name: "Bold" });
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await expect(bold).toHaveCSS("outline-style", "solid");
});

test("a host restyles the editor's frame through its part", async ({
  page,
}) => {
  await openBlocks(page, ["text"]);
  const frame = canvas(page).locator(".editor");

  await page.addStyleTag({
    content: "mail-quilt::part(frame) { border-radius: 0; box-shadow: none; }",
  });

  await expect(frame).toHaveCSS("border-radius", "0px");
  await expect(frame).toHaveCSS("box-shadow", "none");
});

test.describe("on a dark host page", () => {
  test("the editor's light and dark surfaces keep their own colors and font", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await page.addStyleTag({
      content:
        "html, body, main { background: #000 !important; color: #fff !important; font-family: serif !important; }",
    });
    await undoButton(page).hover();
    await expect(tooltip(page)).toBeVisible();

    const surfaces = await canvas(page).evaluate((host) => {
      const style = (selector: string) => {
        const element = host.shadowRoot?.querySelector(selector) as Element;
        const { backgroundColor, color, fontFamily } =
          getComputedStyle(element);
        return { backgroundColor, color, serif: fontFamily === "serif" };
      };
      return { panel: style(".side-panel-inner"), tooltip: style(".tooltip") };
    });

    const white = "rgb(255, 255, 255)";
    const text = "rgb(22, 24, 29)";
    expect(surfaces).toEqual({
      panel: { backgroundColor: white, color: text, serif: false },
      tooltip: {
        backgroundColor: text,
        color: "rgb(247, 247, 248)",
        serif: false,
      },
    });
  });
});
