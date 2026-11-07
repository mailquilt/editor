import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const textBlock = (page: Page) =>
  page.getByRole("textbox", { name: "Text Block" });

/** Types at the start of the text, so a lost cursor scrambles what's typed. */
const focusStartOfTextBlock = async (page: Page) => {
  await textBlock(page).click();
  await expect(textBlock(page)).toBeFocused();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
  );
};

test("shows the email in value", async ({ page }) => {
  await page.goto("/");

  await expect(textBlock(page)).toHaveText("Hello");
});

test("onError hears a refused first document", async ({ page }) => {
  await page.goto("/?refused-first");

  await expect(page.getByTestId("errors")).toContainText("newer");
  await expect(textBlock(page)).toHaveCount(0);
});

const fastTyping = "The quick brown fox jumps over the lazy dog. ".repeat(3);

test.describe("passing each onChange document back into value", () => {
  test("hands the host each new document", async ({ page }) => {
    await page.goto("/");
    await focusStartOfTextBlock(page);

    await page.keyboard.type("Oh ");

    await expect(page.getByTestId("latest-document")).toContainText("Oh Hello");
  });

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

  test("keeps undo history", async ({ page }) => {
    await page.goto("/");
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Oh ");
    await expect(page.getByTestId("latest-document")).toContainText("Oh Hello");

    await page.getByRole("button", { name: "Undo" }).click();

    await expect(textBlock(page)).toHaveText("Hello");
    await expect(page.getByTestId("latest-document")).not.toContainText(
      "Oh Hello"
    );
  });
});

test("a host re-render leaves the cursor and undo history alone", async ({
  page,
}) => {
  await page.goto("/");
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Oh");
  await expect(page.getByTestId("latest-document")).toContainText("OhHello");

  // Keeping focus in the text means this has to happen without clicking away.
  await page
    .getByRole("button", { name: "Re-render host" })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.getByTestId("render-count")).toHaveText("1");
  await page.keyboard.type(" ");

  await expect(textBlock(page)).toHaveText("Oh Hello");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(textBlock(page)).toHaveText("Hello");
});

test("a different document in value loads and clears undo history", async ({
  page,
}) => {
  await page.goto("/");
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Oh ");
  await expect(page.getByTestId("latest-document")).toContainText("Oh Hello");

  await page.getByRole("button", { name: "Load another email" }).click();

  await expect(textBlock(page)).toHaveText("Other");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(textBlock(page)).toHaveText("Other");
});

test("a refused later document leaves the email and reports why", async ({
  page,
}) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");

  await page.getByRole("button", { name: "Load a refused email" }).click();

  await expect(page.getByTestId("errors")).toContainText("newer");
  await expect(textBlock(page)).toHaveText("Hello");
});

test("ref gives the host the element, to export HTML", async ({ page }) => {
  await page.goto("/");
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Oh ");

  await page.getByRole("button", { name: "Export HTML" }).click();

  await expect(page.getByTestId("html")).toContainText("Oh Hello");
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
  test("is only called once the element has its email", async ({ page }) => {
    await page.goto("/?callback-ref");
    await expect(textBlock(page)).toHaveText("Hello");

    await expect(calls(page)).toHaveText("email");
  });

  test("is cleaned up when the editor is removed", async ({ page }) => {
    await page.goto("/?callback-ref");
    await expect(calls(page)).toContainText("email");

    await page.getByRole("button", { name: "Toggle editor" }).click();

    await expect(calls(page)).toHaveText("email, cleanup");
  });
});
