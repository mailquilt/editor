import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuiltElement, MailQuiltShellElement } from "../src/index.js";
import { afterAFrame, focusStartOfTextBlock, textBlock } from "./helpers.js";

test("onError hears a refused first document", async ({ page }) => {
  await page.goto("/?refused-first");

  await expect(page.getByTestId("errors")).toContainText("newer");
});

/**
 * Lets only the scripts the page names load, so the editor's code, which the
 * component imports once it's on the page, can't.
 */
const blockEditorCode = async (page: Page) => {
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
};

// StrictMode mounts each effect twice, so each load fails twice, and these
// also cover a host without it.
test.describe("when the editor's code can't load, under StrictMode", () => {
  test("onError hears why, once", async ({ page }) => {
    await blockEditorCode(page);

    await page.goto("/?strict");

    const errors = page.getByTestId("errors");
    await expect(errors).toContainText("The editor couldn't load: ");
    // StrictMode's two loads wait on one download of the editor's code, so
    // both have failed by the frame after the first report.
    await afterAFrame(page);
    const reports = await errors.textContent();
    expect(reports?.split("\n")).toHaveLength(1);
  });

  test("with no onError, the page has one unhandled rejection", async ({
    page,
  }) => {
    const rejections: Error[] = [];
    page.on("pageerror", (error) => rejections.push(error));
    await blockEditorCode(page);

    await page.goto("/?strict&no-on-error");

    await expect.poll(() => rejections.length).toBeGreaterThan(0);
    await afterAFrame(page);
    expect(rejections).toHaveLength(1);
  });
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
    await page.goto(query);
    const element = page.locator(tag);
    await expect(element).toHaveClass("host-editor");
    await expect(element).toHaveAttribute("aria-label", "Newsletter");
  }
});

test("uploadImage reaches the element", async ({ page }) => {
  for (const [query, tag] of [
    ["/", "mail-quilt"],
    ["/?shell", "mail-quilt-shell"],
  ] as const) {
    await page.goto(query);
    await expect(textBlock(page)).toHaveText("Hello");
    const uploaded = await page.locator(tag).evaluate(
      async (element: MailQuiltElement | MailQuiltShellElement) =>
        await element.uploadImage?.(new File(["x"], "photo.png"), {
          signal: new AbortController().signal,
        })
    );
    expect(uploaded).toEqual({ url: "https://cdn.example/photo.png" });
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
