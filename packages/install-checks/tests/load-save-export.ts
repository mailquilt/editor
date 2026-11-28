import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Puts the cursor at the start of the Text Block, so a lost cursor scrambles
 * what's typed next. It waits as `afterAFrame` in the React package's browser
 * tests and `settle` in the editor's do, as each package's tests stay
 * independent: change the wait in all three.
 */
export const focusStartOfTextBlock = async (page: Page) => {
  const block = page.getByRole("textbox", { name: "Text Block" });
  await block.click();
  await expect(block).toBeFocused();
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

/** Everything the page reports as going wrong, from here on. */
const collectProblems = (page: Page) => {
  const problems: string[] = [];
  page.on("pageerror", ({ message }) => problems.push(message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(message.text());
    }
  });
  return problems;
};

/** Each fresh project starts with an email saying "Hello", saved in localStorage. */
export const checkLoadSaveExport = async (page: Page, url: string) => {
  const problems = collectProblems(page);
  const text = page.getByRole("textbox", { name: "Text Block" });

  await page.goto(url);
  await expect(text).toHaveText("Hello");

  await focusStartOfTextBlock(page);
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
    editor.value = { kind: "blocks", rows: [], version: 999 };
  });

  await expect(page.getByTestId("load-error")).toContainText(
    /version 999 is newer/iu
  );
  await expect(text).toHaveText("Hello");
};

/**
 * Each fresh project opens the email saved under `email`. One the editor
 * refuses is refused as the page starts, so this proves the page listens for
 * `mq-error` before the editor fires it, just after `value` is first set.
 */
export const checkRefusedSavedEmail = async (page: Page, url: string) => {
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.setItem(
      "email",
      JSON.stringify({ kind: "blocks", rows: [], version: 999 })
    );
  });

  await page.reload();

  await expect(page.getByTestId("load-error")).toContainText(
    /version 999 is newer/iu
  );
};

/**
 * Each fresh project's Shell page saves under `my-app:email`, opening an email
 * saying "Hello" when nothing is saved. Its exports and refusals are the
 * editor's own tests' to check; this proves the Shell works once installed.
 */
export const checkShell = async (page: Page, url: string) => {
  const problems = collectProblems(page);
  const shell = page.locator("mail-quilt-shell");
  const text = page.getByRole("textbox", { name: "Text Block" });

  await page.goto(url);
  await expect(text).toHaveText("Hello");
  await expect(
    shell.getByRole("button", { exact: true, name: "Export" })
  ).toBeVisible();

  await focusStartOfTextBlock(page);
  await page.keyboard.type("Saved ");
  await expect(text).toHaveText("Saved Hello");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("my-app:email")))
    .toContain("Saved Hello");

  await page.reload();
  await expect(text).toHaveText("Saved Hello");

  expect(problems).toStrictEqual([]);
};
