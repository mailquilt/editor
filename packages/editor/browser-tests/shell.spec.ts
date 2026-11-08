import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { MailQuiltShell } from "../src/index.js";
import { focusStartOfTextBlock, textBlock, violations } from "./helpers.js";

const shell = (page: Page) => page.locator("mail-quilt-shell");

/** Clicks an export button and returns the file it gives the person. */
const exportFile = async (page: Page, button: string) => {
  const downloading = page.waitForEvent("download");
  await shell(page).getByRole("button", { name: button }).click();
  const download = await downloading;
  return {
    name: download.suggestedFilename(),
    text: await readFile(await download.path(), "utf-8"),
  };
};

const importFile = async (page: Page, text: string) => {
  const choosing = page.waitForEvent("filechooser");
  await shell(page).getByRole("button", { name: "Import JSON" }).click();
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

const header = (page: Page) => shell(page).locator(".header");

const box = async (target: Locator) => {
  const found = await target.boundingBox();
  if (!found) {
    throw new Error("The element has no box");
  }
  return { ...found, bottom: found.y + found.height, top: found.y };
};

const openShell = async (page: Page, query = "") => {
  await page.goto(`/shell.html${query}`);
  await expect(textBlock(page)).toHaveText("Hello");
};

test.describe("the Simple variant", () => {
  test("is the default: the heading, Export HTML and the editor", async ({
    page,
  }) => {
    await openShell(page);

    await expect(shell(page)).toHaveAttribute("variant", "simple");
    await expect(header(page)).toContainText("Email");
    await expect(
      shell(page).getByRole("button", { name: "Export HTML" })
    ).toBeVisible();
    await expect(
      shell(page).getByRole("button", { name: /JSON/u })
    ).toHaveCount(0);
    await expect(shell(page).locator("mail-quilt")).toBeVisible();
  });
});

test.describe("the Advanced variant", () => {
  test("adds Import JSON and Export JSON", async ({ page }) => {
    await openShell(page, "?variant=advanced");

    for (const name of ["Import JSON", "Export JSON", "Export HTML"]) {
      // oxlint-disable-next-line no-await-in-loop -- One button at a time.
      await expect(shell(page).getByRole("button", { name })).toBeVisible();
    }
  });

  test("an exported email comes back when imported", async ({ page }) => {
    await openShell(page, "?variant=advanced");
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Exported ");
    const { name, text } = await exportFile(page, "Export JSON");
    expect(name).toBe("email.json");
    // Formatted, so a person can read it.
    expect(text).toContain('\n  "kind": "blocks"');
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Later ");
    await expect(textBlock(page)).toHaveText("Later Exported Hello");
    const changesBefore = Number(
      await page.locator("#change-count").textContent()
    );

    await importFile(page, text);

    await expect(textBlock(page)).toHaveText("Exported Hello");
    // The host hears an import, as it would any other change.
    await expect(page.locator("#change-count")).toHaveText(
      String(changesBefore + 1)
    );
  });

  test("a refused import shows its reason and keeps the current email", async ({
    page,
  }) => {
    await openShell(page, "?variant=advanced");

    await importFile(
      page,
      JSON.stringify({ kind: "blocks", rows: [], version: 999 })
    );

    await expect(shell(page).getByRole("alert")).toContainText(
      "couldn't be imported"
    );
    await expect(shell(page).getByRole("alert")).toContainText("newer");
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("the same file, once fixed, can be chosen again", async ({ page }) => {
    await openShell(page, "?variant=advanced");
    await importFile(page, "{not json");
    await expect(shell(page).getByRole("alert")).toContainText("valid JSON");

    // A browser only reports a choice that differs from the input's value.
    await expect(shell(page).locator("input[type=file]")).toHaveValue("");
  });
});

test.describe("the editor's API", () => {
  test("value, mq-change and exportHtml() behave as on <mail-quilt>", async ({
    page,
  }) => {
    await openShell(page);
    await focusStartOfTextBlock(page);

    await page.keyboard.type("Oh ");

    await expect(page.locator("#change-count")).toHaveText("3");
    const { html, value } = await shell(page).evaluate(async (element) => {
      const host = element as MailQuiltShell;
      return { html: await host.exportHtml(), value: host.value };
    });
    expect(JSON.stringify(value)).toContain("Oh Hello");
    expect(html).toMatch(/<!doctype html>/iu);
    expect(html).toContain("Oh Hello");
  });

  test("a refused first email fires mq-error and shows its reason", async ({
    page,
  }) => {
    await page.goto("/shell.html?refused-first");

    await expect(page.locator("#errors")).toContainText("newer");
    await expect(shell(page).getByRole("alert")).toContainText("newer");
    await expect(textBlock(page)).toHaveCount(0);
  });

  test("a refused later email keeps the current one", async ({ page }) => {
    await openShell(page);

    await shell(page).evaluate((element) => {
      (element as MailQuiltShell).value = {
        kind: "blocks",
        rows: [],
        version: 2,
      } as unknown as MailQuiltShell["value"];
    });

    await expect(page.locator("#errors")).toContainText(/version 2 is newer/iu);
    await expect(shell(page).getByRole("alert")).toBeVisible();
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("Export HTML downloads email.html", async ({ page }) => {
    await openShell(page);

    const { name, text } = await exportFile(page, "Export HTML");

    expect(name).toBe("email.html");
    expect(text).toContain("Hello");
  });

  test("a failed export says so, until one works", async ({ page }) => {
    await openShell(page);
    // MJML loads on first export, so this is when that request can fail.
    await page.route("**/*.js", (route) => route.abort());

    await shell(page).getByRole("button", { name: "Export HTML" }).click();

    await expect(shell(page).getByRole("alert")).toContainText(
      "couldn't be exported"
    );
    await page.unrouteAll();
    await exportFile(page, "Export HTML");
    await expect(shell(page).getByRole("alert")).toHaveCount(0);
  });
});

test.describe("saving in the browser", () => {
  const key = "test:email";
  const saved = (page: Page) =>
    page.evaluate((each) => localStorage.getItem(each), key);

  test("a reload reopens the last email", async ({ page }) => {
    await openShell(page, `?save-key=${key}`);
    await focusStartOfTextBlock(page);
    await page.keyboard.type("Saved ");
    await expect.poll(() => saved(page)).toContain("Saved Hello");

    await page.reload();

    await expect(textBlock(page)).toHaveText("Saved Hello");
  });

  test("a damaged saved email shows why, and stays until a change", async ({
    page,
  }) => {
    await page.addInitScript(
      (each) => localStorage.setItem(each, "{not json"),
      key
    );
    await openShell(page, `?save-key=${key}`);

    await expect(shell(page).getByRole("alert")).toContainText(
      "saved email couldn't be opened"
    );
    expect(await saved(page)).toBe("{not json");

    await focusStartOfTextBlock(page);
    await page.keyboard.type("New ");

    await expect.poll(() => saved(page)).toContain("New Hello");
    await expect(shell(page).getByRole("alert")).toHaveCount(0);
  });

  for (const { name, script } of [
    {
      name: "blocked",
      script: () => {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Blocked", "SecurityError");
          },
        });
      },
    },
    {
      name: "full",
      script: () => {
        Storage.prototype.setItem = () => {
          throw new DOMException("Full", "QuotaExceededError");
        };
      },
    },
  ]) {
    test(`says it can't save when storage is ${name}`, async ({ page }) => {
      await page.addInitScript(script);
      await openShell(page, `?save-key=${key}`);

      await focusStartOfTextBlock(page);
      await page.keyboard.type("Unsaved ");

      await expect(shell(page).getByRole("alert")).toContainText("can't save");
      await expect(shell(page).getByRole("alert")).not.toContainText("JSON");
      await expect(textBlock(page)).toHaveText("Unsaved Hello");
    });
  }

  test("the Advanced variant suggests Export JSON instead", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("Full", "QuotaExceededError");
      };
    });
    await openShell(page, `?variant=advanced&save-key=${key}`);

    await focusStartOfTextBlock(page);
    await page.keyboard.type("Unsaved ");

    await expect(shell(page).getByRole("alert")).toContainText(
      "Export it as JSON"
    );
  });

  test("without a save key, nothing is stored", async ({ page }) => {
    await page.addInitScript(() => {
      const touched: string[] = [];
      (window as unknown as { touched: string[] }).touched = touched;
      const { getItem: realGetItem, setItem: realSetItem } = Storage.prototype;
      Storage.prototype.getItem = function getItem(name) {
        touched.push(`get ${name}`);
        return realGetItem.call(this, name);
      };
      Storage.prototype.setItem = function setItem(name, value) {
        touched.push(`set ${name}`);
        realSetItem.call(this, name, value);
      };
    });
    await openShell(page, "?variant=advanced");

    await focusStartOfTextBlock(page);
    await page.keyboard.type("Oh ");
    await expect(page.locator("#change-count")).toHaveText("3");

    expect(
      await page.evaluate(
        () => (window as unknown as { touched: string[] }).touched
      )
    ).toStrictEqual([]);
  });
});

test.describe("look", () => {
  test("fills the space the host gives it, the editor below the header", async ({
    page,
  }) => {
    await openShell(page);

    const editor = shell(page).locator("mail-quilt");
    const boxes = {
      editor: await box(editor),
      frame: await box(page.locator("#frame")),
      header: await box(header(page)),
      // The editor itself stretches, so its side panel runs to the bottom.
      panel: await box(editor.locator(".side-panel")),
    };

    expect(boxes.header.top).toBe(boxes.frame.top);
    expect(boxes.header.width).toBe(boxes.frame.width);
    expect(boxes.editor.top).toBe(boxes.header.bottom);
    expect(boxes.editor.bottom).toBe(boxes.frame.bottom);
    expect(boxes.panel.bottom).toBe(boxes.frame.bottom);
  });

  test("a token set on the Shell restyles its header and the editor", async ({
    page,
  }) => {
    await openShell(page);
    await expect(header(page)).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)"
    );

    await shell(page).evaluate((element) => {
      (element as HTMLElement).style.setProperty(
        "--mq-color-surface",
        "rgb(1, 2, 3)"
      );
    });

    await expect(header(page)).toHaveCSS("background-color", "rgb(1, 2, 3)");
    await expect(
      shell(page).locator("mail-quilt").locator(".side-panel-inner")
    ).toHaveCSS("background-color", "rgb(1, 2, 3)");
  });

  test("keeps its own colors on a dark host page", async ({ page }) => {
    await openShell(page);
    await page.addStyleTag({
      content:
        "html, body, main { background: #000 !important; color: #fff !important; font-family: serif !important; }",
    });

    const style = await header(page).evaluate((element) => {
      const { backgroundColor, color, fontFamily } = getComputedStyle(element);
      return { backgroundColor, color, serif: fontFamily === "serif" };
    });

    expect(style).toStrictEqual({
      backgroundColor: "rgb(255, 255, 255)",
      color: "rgb(22, 24, 29)",
      serif: false,
    });
  });
});

test.describe("accessibility", () => {
  test("the keyboard reaches every header control", async ({ page }) => {
    await openShell(page, "?variant=advanced");
    await page.locator("body").click({ position: { x: 1, y: 1 } });

    const reached: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      // oxlint-disable-next-line no-await-in-loop -- Each press moves focus on.
      await page.keyboard.press("Tab");
      // oxlint-disable-next-line no-await-in-loop -- See above.
      const name = await shell(page).evaluate(
        (element) =>
          element.shadowRoot?.activeElement?.textContent?.trim() ?? ""
      );
      reached.push(name);
    }

    expect(reached).toStrictEqual([
      "Import JSON",
      "Export JSON",
      "Export HTML",
    ]);
  });

  test("meets WCAG 2.2 AA in both variants, with a message showing", async ({
    page,
  }) => {
    for (const variant of ["simple", "advanced"]) {
      // oxlint-disable-next-line no-await-in-loop -- One page at a time.
      await page.goto(`/shell.html?variant=${variant}&refused-first`);
      // oxlint-disable-next-line no-await-in-loop -- See above.
      await expect(shell(page).getByRole("alert")).toBeVisible();
      // oxlint-disable-next-line no-await-in-loop -- See above.
      expect(await violations(page, "mail-quilt-shell")).toStrictEqual([]);
    }
  });
});
