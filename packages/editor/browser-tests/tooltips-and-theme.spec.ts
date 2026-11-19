import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  blockGroup,
  blockTools,
  blockWith,
  boxOf,
  canvas,
  centerOf,
  moveTo,
  openBlocks,
  openEmail,
  openTab,
  pickUp,
  previewButton,
  settle,
  TALL_VIEWPORT,
  textBlock,
  tooltip,
  topOf,
  undoButton,
} from "./helpers.js";

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

  test("closes with Escape while hovered, with focus outside the editor", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await undoButton(page).hover();
    await expect(tooltip(page)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(tooltip(page)).toBeHidden();
  });

  test("Escape over a control without focus closes its tooltip, and still leaves the text", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await textBlock(page).click();
    await undoButton(page).hover();
    await expect(tooltip(page)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(tooltip(page)).toBeHidden();
    await expect(blockGroup(page, "Text")).toBeFocused();
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

  test("each icon button, with a Block selected and a Row hovered, has a name and a tooltip", async ({
    page,
  }) => {
    await openBlocks(page, ["text"], []);
    await textBlock(page).click();
    await canvas(page).getByTestId("row").hover();

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
    const workspace = canvas(page).getByTestId("workspace");

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

  test("a dark color scheme reaches the controls the browser draws", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    await textBlock(page).click();
    const alignment = canvas(page).getByLabel("Alignment");
    // A host page's own scheme stops at the editor's surfaces.
    await page.addStyleTag({ content: ":root { color-scheme: dark; }" });
    await expect(alignment).toHaveCSS("color-scheme", "light");

    await canvas(page).evaluate((element) => {
      element.style.setProperty("--mq-color-scheme", "dark");
    });

    await expect(alignment).toHaveCSS("color-scheme", "dark");
  });

  test("don't reach the email card, which shows the email's settings", async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);

    await canvas(page).evaluate((element) => {
      element.style.setProperty("--mq-font-family", "Georgia, serif");
      element.style.setProperty("--mq-color-surface", "rgb(1, 2, 3)");
    });

    await expect(canvas(page).getByTestId("email")).toHaveCSS(
      "font-family",
      "Arial, Helvetica, sans-serif"
    );
    await expect(canvas(page).getByTestId("email")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)"
    );
  });
});

test("in forced colors, a selected tab, a pressed button and a palette tile are outlined", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openBlocks(page, ["text"]);

  await expect(canvas(page).getByRole("tab", { name: "Content" })).toHaveCSS(
    "outline-style",
    "solid"
  );
  // Its edge is otherwise a shadow, which forced colors drop.
  await expect(
    canvas(page).getByRole("button", { name: "Add Text Block" })
  ).toHaveCSS("outline-style", "solid");

  await textBlock(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+b");
  const bold = canvas(page).getByRole("button", { exact: true, name: "Bold" });
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await expect(bold).toHaveCSS("outline-style", "solid");
});

/**
 * The contrast between two colors that `getComputedStyle` gives as `rgb()`, or
 * as `color(srgb …)` with channels from 0 to 1, as it gives a `color-mix()`.
 */
const contrast = (...colors: string[]) => {
  const [lighter = 0, darker = 0] = colors
    .map((color) => {
      const scale = color.startsWith("color(srgb") ? 1 : 255;
      const [red = 0, green = 0, blue = 0] = (
        color.match(/[\d.]+/gu) ?? []
      ).map((value) => {
        const channel = Number(value) / scale;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    })
    .toSorted((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

test("a pressed button has an edge at 3:1, so it isn't told by color alone", async ({
  page,
}) => {
  await openBlocks(page, ["text"]);
  await textBlock(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+b");
  const bold = canvas(page).getByRole("button", { exact: true, name: "Bold" });
  await expect(bold).toHaveAttribute("aria-pressed", "true");

  const [edge, bar] = await bold.evaluate((button) => [
    getComputedStyle(button).boxShadow,
    getComputedStyle(button.closest('[role="toolbar"]') as Element)
      .backgroundColor,
  ]);

  expect(edge).toContain("inset");
  expect(
    contrast(edge?.match(/rgba?\([^)]*\)/u)?.[0] ?? "", bar ?? "")
  ).toBeGreaterThanOrEqual(3);
});

test("a settings field's edge is at 3:1 against the panel, so an empty one shows", async ({
  page,
}) => {
  await openBlocks(page, ["text"]);
  await openTab(page, "Settings");
  const preheader = page
    .getByRole("group", { exact: true, name: "Email" })
    .getByLabel("Preheader", { exact: true });
  await expect(preheader).toHaveValue("");

  const [edge, panel] = await preheader.evaluate((field) => [
    getComputedStyle(field).borderTopColor,
    getComputedStyle(field).backgroundColor,
  ]);

  expect(contrast(edge ?? "", panel ?? "")).toBeGreaterThanOrEqual(3);
});

test("in forced colors, the drop line stands out from the email", async ({
  page,
}) => {
  await page.setViewportSize(TALL_VIEWPORT);
  await page.emulateMedia({ forcedColors: "active" });
  await openEmail(page, [[["One", "Two"]]]);

  await pickUp(page, blockWith(page, "Two").getByTestId("drag-handle"));
  await moveTo(page, await topOf(blockWith(page, "One")));
  const line = canvas(page).getByTestId("drop-indicator");
  await expect(line).toBeVisible();

  const [drawn, email] = await line.evaluate((element) => [
    getComputedStyle(element).backgroundColor,
    getComputedStyle(element.closest('[data-testid="email"]') as Element)
      .backgroundColor,
  ]);

  expect(contrast(drawn ?? "", email ?? "")).toBeGreaterThanOrEqual(3);
});

test("in forced colors, a dropdown's arrow stands out from its field", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openBlocks(page, ["text"]);
  await openTab(page, "Settings");
  const font = page
    .getByRole("group", { exact: true, name: "Email" })
    .getByLabel("Font", { exact: true });

  const [arrow, field] = await font.evaluate((select) => [
    getComputedStyle(select.parentElement as Element, "::after")
      .backgroundColor,
    getComputedStyle(select).backgroundColor,
  ]);

  // The contrast WCAG asks of a control's parts.
  expect(contrast(arrow ?? "", field ?? "")).toBeGreaterThanOrEqual(3);
});

test("a host restyles the editor's frame through its part", async ({
  page,
}) => {
  await openBlocks(page, ["text"]);
  const frame = canvas(page).locator('[part="frame"]');

  await page.addStyleTag({
    content: "mail-quilt::part(frame) { border-radius: 0; box-shadow: none; }",
  });

  await expect(frame).toHaveCSS("border-radius", "0px");
  await expect(frame).toHaveCSS("box-shadow", "none");
});

test("a selected Block's tag stays readable with dark theme tokens", async ({
  page,
}) => {
  await openBlocks(page, ["text"]);
  await page.addStyleTag({
    content:
      "mail-quilt { --mq-color-surface: #16181d; --mq-color-text: #f7f7f8; }",
  });

  await blockGroup(page, "Text").focus();

  await expect(
    blockGroup(page, "Text").evaluate((block) => {
      const { backgroundColor, color } = getComputedStyle(block, "::after");
      return { backgroundColor, color };
    })
  ).resolves.toEqual({
    backgroundColor: "rgb(247, 247, 248)",
    color: "rgb(22, 24, 29)",
  });
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
      return {
        panel: style('[data-testid="side-panel-content"]'),
        tooltip: style('[role="tooltip"]'),
      };
    });

    // None of the host's black, white or serif, and nothing see-through.
    for (const { backgroundColor, color, serif } of Object.values(surfaces)) {
      expect(["rgb(0, 0, 0)", "rgba(0, 0, 0, 0)"]).not.toContain(
        backgroundColor
      );
      expect(color).not.toBe("rgb(255, 255, 255)");
      expect(color).not.toBe(backgroundColor);
      expect(serif).toBe(false);
    }
  });
});
