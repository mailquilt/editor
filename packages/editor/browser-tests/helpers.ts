import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";

export const canvas = (page: Page) => page.locator("mail-quilt");

export const textBlock = (page: Page) =>
  page.getByRole("textbox", { name: "Text Block" });

export const exportHtml = (page: Page) =>
  canvas(page).evaluate((element) => (element as MailQuilt).exportHtml());

export const setValue = (page: Page, document: unknown) =>
  canvas(page).evaluate((element, value) => {
    (element as MailQuilt).value = value as MailQuilt["value"];
  }, document);

/** Types at the start of the Text Block, so a lost cursor scrambles the text. */
export const focusStartOfTextBlock = async (page: Page) => {
  await textBlock(page).click();
  await expect(textBlock(page)).toBeFocused();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
  );
};
