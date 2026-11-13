import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

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

/**
 * Keys typed within a second of each other are one undo step, and a slow run
 * could take longer than that. This stops the page's clock, so it can't. Timers
 * and frames wait too from then on.
 */
export const stopClock = async (page: Page) => {
  await page.clock.install();
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
};
