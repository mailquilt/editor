import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const PLAYGROUND = "/playground";
const SAVED_EMAIL_KEY = "mailquilt:playground:email";

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
  test("opens the starter email when nothing is saved", async ({ page }) => {
    await page.goto(PLAYGROUND);

    await expect(textBlock(page)).toContainText("type here");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("the email is still there after a reload", async ({ page }) => {
    await page.goto(PLAYGROUND);
    await typeInTextBlock(page, "Saved ");
    await expect(textBlock(page)).toContainText("Saved Hi");

    await page.reload();

    await expect(textBlock(page)).toContainText("Saved Hi");
  });

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

  test("says when it can't save because storage is full", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("Full", "QuotaExceededError");
      };
    });
    await page.goto(PLAYGROUND);
    await expect(page.getByRole("alert")).toHaveCount(0);

    await typeInTextBlock(page, "Unsaved ");

    await expect(page.getByRole("alert")).toContainText("can't save");
    await expect(textBlock(page)).toContainText("Unsaved Hi");
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

  for (const { name, reason, saved } of [
    { name: "damaged", reason: "valid JSON", saved: "{not json" },
    {
      name: "from a newer version",
      reason: "newer",
      saved: JSON.stringify({ kind: "blocks", rows: [], version: 999 }),
    },
  ]) {
    test(`opens the starter email and says why when the saved one is ${name}`, async ({
      page,
    }) => {
      await page.addInitScript(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: SAVED_EMAIL_KEY, value: saved }
      );

      await page.goto(PLAYGROUND);

      await expect(textBlock(page)).toContainText("type here");
      await expect(page.getByRole("alert")).toContainText(reason);
      // Opening the page must leave the only copy for the person to deal with.
      expect(
        await page.evaluate((key) => localStorage.getItem(key), SAVED_EMAIL_KEY)
      ).toBe(saved);
    });
  }
});

test.describe("moving an email with JSON", () => {
  test("an exported email comes back when imported", async ({ page }) => {
    await page.goto(PLAYGROUND);
    await typeInTextBlock(page, "Exported ");
    await expect(textBlock(page)).toContainText("Exported Hi");

    const { name, text } = await exportFile(page, "Export JSON");
    expect(name).toBe("email.json");

    await typeInTextBlock(page, "Later ");
    await expect(textBlock(page)).toContainText("Later Exported Hi");

    await importFile(page, text);

    await expect(textBlock(page)).toContainText("Exported Hi");
    await expect(textBlock(page)).not.toContainText("Later");
  });

  test("an imported email is still there after a reload", async ({ page }) => {
    await page.goto(PLAYGROUND);
    await typeInTextBlock(page, "Imported ");
    await expect(textBlock(page)).toContainText("Imported Hi");
    const { text } = await exportFile(page, "Export JSON");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(textBlock(page)).toContainText("type here");

    await importFile(page, text);
    await expect(textBlock(page)).toContainText("Imported Hi");
    await page.reload();

    await expect(textBlock(page)).toContainText("Imported Hi");
  });

  for (const { file, name, reason } of [
    { file: "{not json", name: "isn't JSON", reason: "valid JSON" },
    { file: "[]", name: "isn't an email", reason: "must be an object" },
    {
      file: JSON.stringify({ kind: "blocks", rows: [], version: 999 }),
      name: "is from a newer version",
      reason: "newer",
    },
  ]) {
    test(`a file that ${name} shows the reason and changes nothing`, async ({
      page,
    }) => {
      await page.goto(PLAYGROUND);
      await typeInTextBlock(page, "Current ");
      await expect(textBlock(page)).toContainText("Current Hi");

      await importFile(page, file);

      await expect(page.getByRole("alert")).toContainText(reason);
      await expect(textBlock(page)).toContainText("Current Hi");

      await page.reload();

      await expect(textBlock(page)).toContainText("Current Hi");
    });
  }

  test("the same file can be chosen again", async ({ page }) => {
    await page.goto(PLAYGROUND);

    await importFile(page, "{not json");
    await expect(page.getByRole("alert")).toContainText("valid JSON");

    // A browser only reports a choice that differs from the input's value.
    await expect(page.locator("input[type=file]")).toHaveValue("");
  });

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

test("exports the email as an HTML file", async ({ page }) => {
  await page.goto(PLAYGROUND);
  await typeInTextBlock(page, "Sent ");
  await expect(textBlock(page)).toContainText("Sent Hi");

  const { name, text } = await exportFile(page, "Export HTML");

  expect(name).toBe("email.html");
  expect(text).toMatch(/<!doctype html>/iu);
  expect(text).toContain("Sent Hi");
});

test("says so when the HTML can't be exported", async ({ page }) => {
  await page.goto(PLAYGROUND);
  await expect(textBlock(page)).toBeVisible();
  // MJML loads on first export, so this is the moment that request can fail, as
  // it would after a redeploy removes the file.
  await page.route("**/*.js", (route) => route.abort());

  await page.getByRole("button", { name: "Export HTML" }).click();

  await expect(page.getByRole("alert")).toContainText("couldn't be exported");
});

test("a failed HTML export's reason goes away once one works", async ({
  page,
}) => {
  await page.goto(PLAYGROUND);
  await expect(textBlock(page)).toBeVisible();
  await page.route("**/*.js", (route) => route.abort());
  await page.getByRole("button", { name: "Export HTML" }).click();
  await expect(page.getByRole("alert")).toContainText("couldn't be exported");
  await page.unrouteAll();

  const { name } = await exportFile(page, "Export HTML");

  expect(name).toBe("email.html");
  await expect(page.getByRole("alert")).toHaveCount(0);
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

test("opens an email saved before the Playground used the Shell", async ({
  page,
}) => {
  const saved = JSON.stringify({
    kind: "blocks",
    rows: [
      {
        columns: [
          {
            blocks: [
              {
                id: "block-1",
                props: {
                  content: {
                    content: [
                      {
                        content: [{ text: "Kept from before", type: "text" }],
                        type: "paragraph",
                      },
                    ],
                    type: "doc",
                  },
                },
                type: "text",
              },
            ],
            id: "column-1",
            props: {},
            width: 100,
          },
        ],
        id: "row-1",
        props: {},
      },
    ],
    settings: {
      backgroundColor: "#ffffff",
      fontFamily: "Arial, Helvetica, sans-serif",
      width: 600,
    },
    version: 1,
  });
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: SAVED_EMAIL_KEY, value: saved }
  );

  await page.goto(PLAYGROUND);

  await expect(textBlock(page)).toHaveText("Kept from before");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
