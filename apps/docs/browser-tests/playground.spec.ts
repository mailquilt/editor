import type { MailQuiltShell } from "@mailquilt/editor";
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
  await expect(page.getByTestId("row")).toHaveCount(3);
  await expect(
    page.getByRole("group", { name: /^Text Block, Row/u })
  ).toHaveAccessibleName(/^Text Block, Row 2,/u);
});

test("offers a few Google Fonts", async ({ browserName, page }) => {
  test.skip(
    browserName !== "chromium",
    "Checks content, so Chromium alone runs it."
  );
  await page.goto(PLAYGROUND);
  await expect(textBlock(page)).toBeVisible();

  const fonts = await page
    .locator("mail-quilt-shell")
    .evaluate((element) => (element as MailQuiltShell).fonts ?? []);

  expect(fonts.map(({ name }) => name)).toStrictEqual([
    "DM Serif Display",
    "Fraunces",
    "Inter",
  ]);
  for (const { url } of fonts) {
    expect(url).toMatch(/^https:\/\/fonts\.googleapis\.com\//u);
  }
});

test("runs on the Shell, below the page's title", async ({ page }) => {
  await page.goto(PLAYGROUND);
  await expect(textBlock(page)).toBeVisible();
  const shell = page.locator("mail-quilt-shell");
  await expect(
    shell.getByRole("button", { exact: true, name: "Export" })
  ).toBeVisible();
  // The note that held its place has gone.
  await expect(page.getByText("The Playground is loading.")).toBeHidden();

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

test("on a phone, the Shell fits the window too, with the Selection bar at its bottom", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 420 });
  await page.goto(PLAYGROUND);
  const shell = page.locator("mail-quilt-shell");
  const bar = shell.getByTestId("selection-bar");
  await expect(bar).toContainText("Tap a Block to change it");

  const shellBox = await shell.boundingBox();
  const barBox = await bar.boundingBox();
  const shellBottom = (shellBox?.y ?? 0) + (shellBox?.height ?? 0);
  const barBottom = (barBox?.y ?? 0) + (barBox?.height ?? 0);

  // So the whole editor fits the window once scrolled to, as on a laptop.
  expect(shellBox?.height).toBeLessThanOrEqual(
    page.viewportSize()?.height ?? 0
  );
  expect(barBottom).toBeLessThanOrEqual(shellBottom);
  expect(barBottom).toBeGreaterThan(shellBottom - 24);
});

test("a slash typed in the editor's fields stays there, and doesn't open search", async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName !== "chromium",
    "Checks the page's own code, which is the same in every browser."
  );
  await page.goto(PLAYGROUND);
  await page.getByRole("group", { name: /^Button Block/u }).click();
  const link = page.getByRole("textbox", { name: "Link" });

  await link.click();
  await page.keyboard.type("https://example.com/offer");

  await expect(link).toHaveValue("https://example.com/offer");
  const search = page.getByRole("combobox", { name: "Search docs" });
  await expect(search).toBeHidden();
  // Outside a field, the slash still opens it.
  await page.locator("h1").click();
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
});

test("says so when the editor's code doesn't load", async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName !== "chromium",
    "Checks the page's own code, which is the same in every browser."
  );
  // The file that defines the Shell fails, as on a dropped connection.
  await page.route("**/_astro/*.js", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await (/customElements\.define\(.mail-quilt-shell/u.test(body)
      ? route.abort()
      : route.fulfill({ body, response }));
  });
  await page.goto(PLAYGROUND);

  await expect(page.getByRole("alert")).toContainText(
    "The Playground couldn't start"
  );
  await expect(page.getByText("The Playground is loading.")).toBeHidden();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("says why the Playground hasn't appeared", async ({
    browserName,
    page,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Checks content, so Chromium alone runs it."
    );
    await page.goto(PLAYGROUND);

    await expect(page.getByText("it needs JavaScript")).toBeVisible();
  });
});
