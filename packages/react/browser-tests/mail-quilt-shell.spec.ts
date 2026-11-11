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

test("shows the email in value, with the heading", async ({ page }) => {
  await page.goto("/?shell");

  await expect(textBlock(page)).toHaveText("Hello");
  await expect(shell(page).getByRole("heading")).toHaveText("Campaign");
  await expect(
    shell(page).getByRole("button", { name: "Import JSON" })
  ).toBeVisible();
});

test("with saveKey, a reload reopens the saved email rather than value", async ({
  page,
}) => {
  await page.goto("/?shell&save");
  await typeAtStart(page, "Saved ");
  await expect(textBlock(page)).toHaveText("Saved Hello");

  await page.reload();
  // Only once React has set `value`, after the Shell has opened.
  await expect(page.getByTestId("ready")).toHaveText("yes");

  await expect(textBlock(page)).toHaveText("Saved Hello");
});

test("actions picks the Shell's buttons", async ({ page }) => {
  await page.goto("/?shell&only-html");
  await expect(textBlock(page)).toHaveText("Hello");

  await expect(shell(page)).toHaveAttribute("actions", "export-html");
  await expect(shell(page).locator(".header").getByRole("button")).toHaveText([
    "Export HTML",
  ]);
});
