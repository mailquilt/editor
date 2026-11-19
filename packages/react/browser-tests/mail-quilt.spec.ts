import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { focusStartOfTextBlock, textBlock } from "./helpers.js";

test("onError hears a refused first document", async ({ page }) => {
  await page.goto("/?refused-first");

  await expect(page.getByTestId("errors")).toContainText("newer");
});

test("onError hears why the editor's code can't load", async ({ page }) => {
  // Only the scripts the page names load, so the editor's code, which the
  // component imports once it's on the page, can't.
  const response = await page.request.get("/");
  const html = await response.text();
  const pageScripts = new Set(
    Array.from(
      html.matchAll(/(?:src|href)="(?<script>[^"]+\.js)"/gu),
      ({ groups }) => groups?.script
    )
  );
  await page.route("**/*.js", (route) =>
    pageScripts.has(new URL(route.request().url()).pathname)
      ? route.continue()
      : route.abort()
  );

  await page.goto("/");

  await expect(page.getByTestId("errors")).toContainText(
    "The editor couldn't load: "
  );
});

const fastTyping = "The quick brown fox jumps over the lazy dog. ".repeat(3);

test("a later value replaces the email in the editor", async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");

  await page.getByRole("button", { name: "Replace email" }).click();

  await expect(textBlock(page)).toHaveText("Replaced");
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

test("a new onChange each render replaces the last, so each edit calls it once", async ({
  page,
}) => {
  await page.goto("/");
  await focusStartOfTextBlock(page);

  await page.keyboard.type("Oh ");

  await expect(page.getByTestId("latest-document")).toContainText("Oh Hello");
  await expect(page.getByTestId("change-count")).toHaveText("3");
});

test("a controlled editor removed and shown again opens the latest email, and its changes still reach onChange", async ({
  page,
}) => {
  await page.goto("/");
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Oh ");
  await expect(page.getByTestId("latest-document")).toContainText("Oh Hello");

  const toggle = page.getByRole("button", { name: "Toggle editor" });
  await toggle.click();
  await expect(textBlock(page)).toHaveCount(0);
  await toggle.click();

  await expect(textBlock(page)).toHaveText("Oh Hello");
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Back ");
  await expect(page.getByTestId("latest-document")).toContainText(
    "Back Oh Hello"
  );
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

// StrictMode mounts each effect twice, so it also covers a host without it.
test("passing each onChange document back into value keeps the cursor, under StrictMode", async ({
  page,
}) => {
  await page.goto("/?strict");
  await focusStartOfTextBlock(page);

  // As fast as it goes, so keys land between each commit and its effects. A
  // document that reaches `value` after the next key would load, losing that
  // key, the cursor and undo history.
  await page.keyboard.type(fastTyping);

  await expect(textBlock(page)).toHaveText(`${fastTyping}Hello`);
  await expect(textBlock(page)).toBeFocused();
});
