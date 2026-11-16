import { setTimeout as sleep } from "node:timers/promises";

import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

import { freshProjects } from "../fresh-projects.ts";
import { starterEmail } from "../projects/react/app/starter-email.ts";

const url = `http://localhost:${freshProjects["plain-js"].port}/save/`;
const EMAIL_URL = "**/api/emails/welcome";

interface Save {
  body: string;
  end: number;
  start: number;
}

/**
 * Stands in for the app's server: GET answers the starter email, and each PUT
 * is kept, answered after `delayMs` with `status`.
 */
const fakeServer = async (
  page: Page,
  {
    delayMs = 0,
    status = () => 204,
  }: { delayMs?: number; status?: () => number } = {}
) => {
  const saves: Save[] = [];
  await page.route(EMAIL_URL, async (route: Route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: starterEmail });
      return;
    }
    const save: Save = {
      body: request.postData() ?? "",
      end: 0,
      start: Date.now(),
    };
    saves.push(save);
    await sleep(delayMs);
    save.end = Date.now();
    await route.fulfill({ status: status() });
  });
  return saves;
};

const typeAtStart = async (page: Page, text: string) => {
  const block = page.getByRole("textbox", { name: "Text Block" });
  await expect(block).toHaveText(/Hello/u);
  await block.click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
  );
  await page.keyboard.type(text);
};

test("typing saves once, after a pause, with every keystroke in it", async ({
  page,
}) => {
  const saves = await fakeServer(page);
  await page.goto(url);
  await typeAtStart(page, "Saved ");

  await expect(page.locator("#save-status")).toHaveText("Saved");
  expect(saves).toHaveLength(1);
  expect(saves[0]?.body).toContain("Saved Hello");
});

test("a save waits for a slow one before it, so the newest email lands last", async ({
  page,
}) => {
  const saves = await fakeServer(page, { delayMs: 1500 });
  await page.goto(url);
  await typeAtStart(page, "One ");
  await expect.poll(() => saves.length).toBe(1);
  await page.keyboard.type("Two ");

  await expect.poll(() => saves.length, { timeout: 10_000 }).toBe(2);
  const [first, second] = saves;
  expect(second?.start).toBeGreaterThanOrEqual(first?.end ?? Infinity);
  expect(second?.body).toContain("One Two Hello");
});

test("a failed save says so, and the next change sends the email again", async ({
  page,
}) => {
  let answers = 0;
  const saves = await fakeServer(page, {
    status: () => {
      answers += 1;
      return answers === 1 ? 500 : 204;
    },
  });
  await page.goto(url);
  await typeAtStart(page, "A");
  await expect(page.locator("#save-status")).toHaveText(
    "Not saved: The server answered 500"
  );

  await page.keyboard.type("B");
  await expect(page.locator("#save-status")).toHaveText("Saved");
  expect(saves).toHaveLength(2);
  expect(saves[1]?.body).toContain("ABHello");
});

test("hiding the page saves straight away, without waiting for the pause", async ({
  page,
}) => {
  const saves = await fakeServer(page);
  await page.goto(url);
  await typeAtStart(page, "Hidden ");

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  // Well inside the one-second pause, so only hiding the page can have saved.
  await expect.poll(() => saves.length, { timeout: 500 }).toBe(1);
  expect(saves[0]?.body).toContain("Hidden Hello");
});

test("leaving before a change is saved asks first", async ({ page }) => {
  await fakeServer(page);
  await page.goto(url);
  await typeAtStart(page, "Unsaved ");

  const dialog = page.waitForEvent("dialog");
  await page.close({ runBeforeUnload: true });
  const asked = await dialog;
  expect(asked.type()).toBe("beforeunload");
});
