import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Waits until the page has drawn a frame, and run what that frame queued. */
export const afterAFrame = async (page: Page) => {
  await page.evaluate(
    () =>
      // oxlint-disable-next-line promise/avoid-new -- These browser callbacks have no promise form.
      new Promise((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 0))
        );
      })
  );
};

export const textBlock = (page: Page) =>
  page.getByRole("textbox", { name: "Text Block" });

/** Types at the start of the text, so a lost cursor scrambles what's typed. */
export const focusStartOfTextBlock = async (page: Page) => {
  await textBlock(page).click();
  await expect(textBlock(page)).toBeFocused();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
  );
  // The editor learns of the moved cursor a moment later, after a frame.
  await afterAFrame(page);
};
