import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { focusStartOfTextBlock, textBlock } from "./helpers.js";

test("onError hears a refused first document", async ({ page }) => {
  await page.goto("/?refused-first");

  await expect(page.getByTestId("errors")).toContainText("newer");
});

const fastTyping = "The quick brown fox jumps over the lazy dog. ".repeat(3);

test.describe("passing each onChange document back into value", () => {
  test("keeps the cursor", async ({ page }) => {
    await page.goto("/");
    await focusStartOfTextBlock(page);

    // As fast as it goes, so keys land between each commit and its effects. A
    // document that reaches `value` after the next key would load, losing that
    // key, the cursor and undo history.
    await page.keyboard.type(fastTyping);

    await expect(textBlock(page)).toHaveText(`${fastTyping}Hello`);
    await expect(textBlock(page)).toBeFocused();
  });
});

test("other props such as className and aria-label reach the element", async ({
  page,
}) => {
  for (const [query, tag] of [
    ["/", "mail-quilt"],
    ["/?shell", "mail-quilt-shell"],
  ] as const) {
    // oxlint-disable-next-line no-await-in-loop -- One component, then the other.
    await page.goto(query);
    const element = page.locator(tag);
    // oxlint-disable-next-line no-await-in-loop -- See above.
    await expect(element).toHaveClass("host-editor");
    // oxlint-disable-next-line no-await-in-loop -- See above.
    await expect(element).toHaveAttribute("aria-label", "Newsletter");
  }
});

test("ref gives the host the element, to export HTML", async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");

  await page.getByRole("button", { name: "Export HTML" }).click();

  await expect(page.getByTestId("html")).toContainText("Hello");
});

test("comes back working after being removed", async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");
  const toggle = page.getByRole("button", { name: "Toggle editor" });

  await toggle.click();
  await expect(textBlock(page)).toHaveCount(0);
  await toggle.click();
  await expect(textBlock(page)).toHaveText("Hello");

  await focusStartOfTextBlock(page);
  await page.keyboard.type("Oh ");
  await expect(page.getByTestId("latest-document")).toContainText("Oh Hello");
});

const calls = (page: Page) => page.getByTestId("ref-calls");

test.describe("a callback ref", () => {
  test("is only called once the element has its email, and cleaned up when the editor is removed", async ({
    page,
  }) => {
    await page.goto("/?callback-ref");
    await expect(calls(page)).toContainText("email");

    await page.getByRole("button", { name: "Toggle editor" }).click();

    await expect(calls(page)).toHaveText("email, cleanup");
  });
});

// StrictMode mounts each effect twice. The wrapper's effects wait for the editor
// to load, so they don't run until after that, and one test is enough.
test("passing each onChange document back into value keeps the cursor under StrictMode", async ({
  page,
}) => {
  await page.goto("/?strict");
  await focusStartOfTextBlock(page);

  await page.keyboard.type(fastTyping);

  await expect(textBlock(page)).toHaveText(`${fastTyping}Hello`);
  await expect(textBlock(page)).toBeFocused();
});
