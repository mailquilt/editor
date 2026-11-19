import { once } from "node:events";

import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

import { freshProjects } from "../ports.ts";
import { starterEmail } from "../projects/starter-email.js";
import { focusStartOfTextBlock } from "./load-save-export.ts";

const url = `http://localhost:${freshProjects["plain-js"].port}/save/`;
const EMAIL_URL = "**/api/emails/welcome";
/** How long the example waits after the last change before it saves. */
const SAVE_AFTER_MS = 1000;
const opened = new Date("2026-01-01T09:00:00Z");

interface Save {
  body: string;
  end: number;
  start: number;
}

/**
 * Stands in for the app's server: GET answers the starter email, and each PUT
 * is kept and answered with the status `answer` gives.
 */
const fakeServer = async (
  page: Page,
  answer: () => number | Promise<number> = () => 204
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
    const status = await answer();
    save.end = Date.now();
    await route.fulfill({ status });
  });
  return saves;
};

/**
 * Opens the page, then stops its clock before typing, so the save pause ends
 * only when a test runs the clock on, however long typing takes.
 */
const openAndTypeAtStart = async (page: Page, text: string) => {
  await page.clock.install({ time: opened });
  await page.goto(url);
  await focusStartOfTextBlock(page);
  await page.clock.pauseAt(opened.getTime() + 60 * 60 * 1000);
  await page.keyboard.type(text);
};

test("typing saves once, after a pause, with every keystroke in it", async ({
  page,
}) => {
  const saves = await fakeServer(page);
  await openAndTypeAtStart(page, "Saved ");

  await page.clock.runFor(SAVE_AFTER_MS - 1);
  expect(saves).toHaveLength(0);
  await page.clock.runFor(1);

  await expect(page.locator("#save-status")).toHaveText("Saved");
  expect(saves).toHaveLength(1);
  expect(saves[0]?.body).toContain("Saved Hello");
});

test("a save waits for a slow one before it, so the newest email lands last", async ({
  page,
}) => {
  // The first save is answered only once the second is waiting for it.
  const answer = new EventTarget();
  let answers = 0;
  const saves = await fakeServer(page, async () => {
    answers += 1;
    if (answers === 1) {
      await once(answer, "first");
    }
    return 204;
  });
  await openAndTypeAtStart(page, "One ");
  await page.clock.runFor(SAVE_AFTER_MS);
  await expect.poll(() => saves.length).toBe(1);

  await page.keyboard.type("Two ");
  await page.clock.runFor(SAVE_AFTER_MS);
  answer.dispatchEvent(new Event("first"));

  await expect.poll(() => saves.length).toBe(2);
  const [first, second] = saves;
  expect(second?.start).toBeGreaterThanOrEqual(first?.end ?? Infinity);
  expect(second?.body).toContain("One Two Hello");
});

test("a failed save says so, and the next change sends the email again", async ({
  page,
}) => {
  let answers = 0;
  const saves = await fakeServer(page, () => {
    answers += 1;
    return answers === 1 ? 500 : 204;
  });
  await openAndTypeAtStart(page, "A");
  await page.clock.runFor(SAVE_AFTER_MS);
  await expect(page.locator("#save-status")).toHaveText(
    "Not saved: The server answered 500"
  );

  await page.keyboard.type("B");
  await page.clock.runFor(SAVE_AFTER_MS);
  await expect(page.locator("#save-status")).toHaveText("Saved");
  expect(saves).toHaveLength(2);
  expect(saves[1]?.body).toContain("ABHello");
});

test("hiding the page saves straight away, without waiting for the pause", async ({
  page,
}) => {
  const saves = await fakeServer(page);
  await openAndTypeAtStart(page, "Hidden ");

  // The clock is stopped, so only hiding the page can save.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]?.body).toContain("Hidden Hello");
});

test("leaving before a change is saved asks first", async ({ page }) => {
  await fakeServer(page);
  await openAndTypeAtStart(page, "Unsaved ");

  const dialog = page.waitForEvent("dialog");
  await page.close({ runBeforeUnload: true });
  const asked = await dialog;
  expect(asked.type()).toBe("beforeunload");
});
