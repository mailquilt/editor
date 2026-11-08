import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const textBlock = (page: Page) =>
  page.getByRole("textbox", { name: "Text Block" });

const shell = (page: Page) => page.locator("mail-quilt-shell");

const typeAtStart = async (page: Page, text: string) => {
  await textBlock(page).click();
  await expect(textBlock(page)).toBeFocused();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
  );
  await page.keyboard.type(text);
};

test("shows the email in value, with the heading and variant", async ({
  page,
}) => {
  await page.goto("/?shell");

  await expect(textBlock(page)).toHaveText("Hello");
  await expect(shell(page)).toHaveAttribute("variant", "advanced");
  await expect(shell(page).getByRole("heading")).toHaveText("Campaign");
  await expect(
    shell(page).getByRole("button", { name: "Import JSON" })
  ).toBeVisible();
});

test("onChange hands the host each new document", async ({ page }) => {
  await page.goto("/?shell");

  await typeAtStart(page, "Oh ");

  await expect(textBlock(page)).toHaveText("Oh Hello");
  await expect(page.getByTestId("latest-document")).toContainText("Oh Hello");
});

test("onError hears a refused first document", async ({ page }) => {
  await page.goto("/?shell&refused-first");

  await expect(page.getByTestId("errors")).toContainText("newer");
  await expect(shell(page).getByRole("alert")).toContainText("newer");
});

test("ref gives the host the element, to export HTML", async ({ page }) => {
  await page.goto("/?shell");
  await expect(textBlock(page)).toHaveText("Hello");

  await page.getByRole("button", { name: "Export with ref" }).click();

  await expect(page.getByTestId("html")).toContainText("Hello");
});

test("with saveKey, a reload reopens the saved email rather than value", async ({
  page,
}) => {
  await page.goto("/?shell&save");
  await typeAtStart(page, "Saved ");
  await expect(textBlock(page)).toHaveText("Saved Hello");

  await page.reload();

  await expect(textBlock(page)).toHaveText("Saved Hello");
  // React sets `value` after the Shell has started, and it mustn't win.
  await page.waitForTimeout(300);
  await expect(textBlock(page)).toHaveText("Saved Hello");
});
