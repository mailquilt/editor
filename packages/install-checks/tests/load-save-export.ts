import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Each fresh project starts with an email saying "Hello", saved in localStorage. */
export const checkLoadSaveExport = async (page: Page, url: string) => {
  const problems: string[] = [];
  page.on("pageerror", ({ message }) => problems.push(message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(message.text());
    }
  });
  const text = page.getByRole("textbox", { name: "Text Block" });

  await page.goto(url);
  await expect(text).toHaveText("Hello");

  await text.click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
  );
  await page.keyboard.type("Saved ");
  await expect(text).toHaveText("Saved Hello");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("email")))
    .toContain("Saved Hello");

  await page.reload();
  await expect(text).toHaveText("Saved Hello");

  await page.getByRole("button", { name: "Export HTML" }).click();
  const html = page.getByTestId("exported-html");
  await expect(html).toContainText("Saved Hello");
  await expect(html).toContainText(/<!doctype html>/iu);

  expect(problems).toStrictEqual([]);
};
