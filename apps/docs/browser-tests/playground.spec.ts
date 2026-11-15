import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const PLAYGROUND = "/playground";

const textBlock = (page: Page) =>
  page.getByRole("textbox", { name: "Text Block" });

test("starts with several Rows, so moving one can be tried straight away", async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName !== "chromium",
    "Checks content, so Chromium alone runs it."
  );
  await page.goto(PLAYGROUND);
  await expect(textBlock(page)).toBeVisible();
  await expect(page.getByRole("toolbar", { name: /^Row \d+$/u })).toHaveCount(
    3
  );
  await expect(
    page.getByRole("group", { name: /^Text Block, Row/u })
  ).toHaveAccessibleName(/^Text Block, Row 2,/u);
});

test("runs on the Shell, below the page's title", async ({ page }) => {
  await page.goto(PLAYGROUND);
  await expect(textBlock(page)).toBeVisible();
  const shell = page.locator("mail-quilt-shell");
  await expect(
    shell.getByRole("button", { name: "Import JSON" })
  ).toBeVisible();

  const title = await page.getByRole("heading", { level: 1 }).boundingBox();
  const box = await shell.boundingBox();

  expect(box?.y).toBeGreaterThan((title?.y ?? 0) + (title?.height ?? 0));
  // So the whole editor fits the window once scrolled to.
  expect(box?.height).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
});

test("the starter email fits without scrolling, even in a short window", async ({
  page,
}) => {
  await page.setViewportSize({ height: 600, width: 1280 });
  await page.goto(PLAYGROUND);
  await expect(textBlock(page)).toBeVisible();

  // What the Shell scrolls the editor in.
  const { clientHeight, scrollHeight } = await page
    .locator("mail-quilt-shell")
    .locator("mail-quilt")
    .evaluate((editor) => ({
      clientHeight: editor.parentElement?.clientHeight,
      scrollHeight: editor.parentElement?.scrollHeight,
    }));

  // So an editor with nothing around it can't pass.
  expect(clientHeight).toBeGreaterThan(0);
  expect(scrollHeight).toBe(clientHeight);
});

test("on a phone, the Shell is only as tall as its notice", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 420 });
  await page.goto(PLAYGROUND);
  const shell = page.locator("mail-quilt-shell");
  const notice = shell
    .locator("mail-quilt")
    .locator('[part="frame"]', { hasText: "Editing needs more room" });
  await expect(notice).toBeVisible();

  const shellBox = await shell.boundingBox();
  const noticeBox = await notice.boundingBox();

  expect((noticeBox?.y ?? 0) + (noticeBox?.height ?? 0)).toBe(
    (shellBox?.y ?? 0) + (shellBox?.height ?? 0)
  );
  // The notice's own height, well short of the window's worth the Shell
  // takes where there's room to edit.
  expect(noticeBox?.height).toBeLessThan(
    (page.viewportSize()?.height ?? 0) / 2
  );
});
