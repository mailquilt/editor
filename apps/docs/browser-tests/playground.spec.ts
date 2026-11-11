import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const PLAYGROUND = "/playground";

const textBlock = (page: Page) =>
  page.getByRole("textbox", { name: "Text Block" });

const typeInTextBlock = async (page: Page, text: string) => {
  await textBlock(page).click();
  await expect(textBlock(page)).toBeFocused();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
  );
  await page.keyboard.type(text);
};

/** Clicks the export button and returns the file it gives the person. */
const exportFile = async (page: Page, button: string) => {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: button }).click();
  const download = await downloading;
  return {
    name: download.suggestedFilename(),
    text: await readFile(await download.path(), "utf-8"),
  };
};

const importFile = async (page: Page, text: string) => {
  const choosing = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import JSON" }).click();
  const chooser = await choosing;
  await chooser.setFiles({
    buffer: Buffer.from(text),
    mimeType: "application/json",
    name: "email.json",
  });
};

// Playwright stops intercepting file choosers when its last listener goes, and
// Firefox can then miss the chooser of a later import in the same test.
test.beforeEach(({ page }) => {
  page.on("filechooser", () => null);
});

test.describe("saving in the browser", () => {
  test("still works when storage is unavailable, and says it can't save", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      });
    });

    await page.goto(PLAYGROUND);

    await expect(page.getByRole("alert")).toContainText("can't save");
    await typeInTextBlock(page, "Unsaved ");
    await expect(textBlock(page)).toContainText("Unsaved Hi");
    await expect(page.getByRole("alert")).toContainText("can't save");
  });

  test("keeps saying it can't save while showing another reason", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      });
    });
    await page.goto(PLAYGROUND);

    await importFile(page, "{not json");

    const alerts = page.getByRole("alert");
    await expect(alerts.filter({ hasText: "valid JSON" })).toBeVisible();
    await expect(alerts.filter({ hasText: "can't save" })).toBeVisible();
  });
});

test.describe("moving an email with JSON", () => {
  test("a reason goes away with the next edit or good file", async ({
    page,
  }) => {
    await page.goto(PLAYGROUND);
    const { text } = await exportFile(page, "Export JSON");

    await importFile(page, "{not json");
    await expect(page.getByRole("alert")).toBeVisible();
    await importFile(page, text);
    await expect(page.getByRole("alert")).toHaveCount(0);

    await importFile(page, "{not json");
    await expect(page.getByRole("alert")).toBeVisible();
    await typeInTextBlock(page, "Edited ");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

test("starts with several Rows, so moving one can be tried straight away", async ({
  page,
}) => {
  await page.goto(PLAYGROUND);
  await expect(textBlock(page)).toBeVisible();
  const rows = page.locator("mail-quilt .row");
  await expect(rows).toHaveCount(3);
  const textBlockPlace = page.getByRole("group", { name: /^Text Block, Row/u });
  await expect(textBlockPlace).toHaveAccessibleName(/^Text Block, Row 2,/u);

  await rows.first().hover({ position: { x: 4, y: 4 } });
  await page
    .getByRole("group", { exact: true, name: "Row 1" })
    .getByRole("button", { name: "Move Row down" })
    .click();

  await expect(textBlockPlace).toHaveAccessibleName(/^Text Block, Row 1,/u);
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

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Playground"
  );
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

  const body = page.locator("mail-quilt-shell").locator(".body");
  const { clientHeight, scrollHeight } = await body.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));

  expect(scrollHeight).toBe(clientHeight);
});

test("on a phone, the Shell is only as tall as its notice", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 420 });
  await page.goto(PLAYGROUND);
  const shell = page.locator("mail-quilt-shell");
  const notice = shell.locator("mail-quilt").locator(".narrow-notice");
  await expect(notice).toBeVisible();

  const shellBox = await shell.boundingBox();
  const noticeBox = await notice.boundingBox();

  expect((noticeBox?.y ?? 0) + (noticeBox?.height ?? 0)).toBe(
    (shellBox?.y ?? 0) + (shellBox?.height ?? 0)
  );
  // The notice's own height, not a window's worth of empty space below it.
  expect(noticeBox?.height).toBe(360);
});
