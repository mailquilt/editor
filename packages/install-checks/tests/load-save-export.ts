import { readFile } from "node:fs/promises";

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

/** Each fresh project shows why the editor refused a document in its `load-error` output. */
export const checkRefusedDocument = async (page: Page, url: string) => {
  await page.goto(url);
  const text = page.getByRole("textbox", { name: "Text Block" });
  await expect(text).toHaveText("Hello");

  await page.evaluate(() => {
    const editor = document.querySelector("mail-quilt") as unknown as {
      value: unknown;
    };
    editor.value = { kind: "blocks", rows: [], version: 2 };
  });

  await expect(page.getByTestId("load-error")).toContainText(
    /version 2 is newer/iu
  );
  await expect(text).toHaveText("Hello");
};

/**
 * Each fresh project's Shell page saves under
 * `my-app:email` and opening an email saying "Hello" when nothing is saved.
 */
export const checkShell = async (page: Page, url: string) => {
  const problems: string[] = [];
  page.on("pageerror", ({ message }) => problems.push(message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(message.text());
    }
  });
  const shell = page.locator("mail-quilt-shell");
  const text = page.getByRole("textbox", { name: "Text Block" });

  await page.goto(url);
  await expect(text).toHaveText("Hello");
  await expect(
    shell.getByRole("button", { name: "Import JSON" })
  ).toBeVisible();

  await text.click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
  );
  await page.keyboard.type("Saved ");
  await expect(text).toHaveText("Saved Hello");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("my-app:email")))
    .toContain("Saved Hello");

  await page.reload();
  await expect(text).toHaveText("Saved Hello");

  const downloading = page.waitForEvent("download");
  await shell.getByRole("button", { name: "Export HTML" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("email.html");
  expect(await readFile(await download.path(), "utf-8")).toContain(
    "Saved Hello"
  );

  await page.evaluate(() => {
    const element = document.querySelector("mail-quilt-shell") as unknown as {
      value: unknown;
    };
    element.value = { kind: "blocks", rows: [], version: 2 };
  });
  await expect(shell.getByRole("alert")).toContainText(/version 2 is newer/iu);
  await expect(text).toHaveText("Saved Hello");

  expect(problems).toStrictEqual([]);
};
