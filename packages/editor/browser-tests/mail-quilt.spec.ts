import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";

const canvas = (page: Page) => page.locator("mail-quilt");
const textBlock = (page: Page) =>
  page.getByRole("textbox", { name: "Text Block" });

const latestDocumentText = async (page: Page) => {
  const text = await page.getByTestId("latest-document").textContent();
  const document = JSON.parse(text ?? "null");
  return document.rows[0].columns[0].blocks[0].props.content.content[0]
    .content[0].text as string;
};

const exportHtml = (page: Page) =>
  canvas(page).evaluate((element) => (element as MailQuilt).exportHtml());

/** Types at the start of the Text Block, so a lost cursor scrambles the text. */
const focusStartOfTextBlock = async (page: Page) => {
  await textBlock(page).click();
  await expect(textBlock(page)).toBeFocused();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
  );
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");
});

test("renders the email inside Shadow DOM", async ({ page }) => {
  const placement = await canvas(page).evaluate((element) => ({
    inLightDom: element.querySelector("[contenteditable]") !== null,
    inShadowDom: Boolean(
      element.shadowRoot?.querySelector("[contenteditable]")
    ),
  }));

  expect(placement).toStrictEqual({ inLightDom: false, inShadowDom: true });
});

test("typing fires mq-change with the new document", async ({ page }) => {
  await focusStartOfTextBlock(page);

  await page.keyboard.type("Oh ");

  await expect(textBlock(page)).toHaveText("Oh Hello");
  await expect(page.getByTestId("change-count")).toHaveText("3");
  await expect.poll(() => latestDocumentText(page)).toBe("Oh Hello");
});

test("mq-change reaches listeners outside the element", async ({ page }) => {
  await page.evaluate(() => {
    document.addEventListener("mq-change", () => {
      document.documentElement.dataset.changed = "yes";
    });
  });
  await focusStartOfTextBlock(page);

  await page.keyboard.type("A");

  await expect(page.locator("html")).toHaveAttribute("data-changed", "yes");
});

test("a typed Merge Tag stays intact through editing and export", async ({
  page,
}) => {
  await focusStartOfTextBlock(page);

  await page.keyboard.type("{{first_name}} ");

  await expect
    .poll(() => latestDocumentText(page))
    .toBe("{{first_name}} Hello");
  expect(await exportHtml(page)).toContain("{{first_name}} Hello");
});

test("exportHtml returns the final HTML, loading MJML only when called", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.reload();
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Hi ");
  expect(requests.filter((url) => url.includes("mjml-browser"))).toEqual([]);

  const html = await exportHtml(page);

  expect(requests.filter((url) => url.includes("mjml-browser"))).toHaveLength(
    1
  );
  expect(html).toMatch(/^<!doctype html>/iu);
  expect(html).toContain("Hi Hello");
});

test("host CSS doesn't reach the canvas", async ({ page }) => {
  // Proves the unfriendly CSS and Tailwind's reset are really on the page.
  const hostParagraph = page.getByTestId("host-paragraph");
  await expect(hostParagraph).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(hostParagraph).toHaveCSS("margin-top", "50px");
  await expect(page.locator("main")).toHaveCSS("display", "flex");
  await expect(page.locator("button")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)"
  );

  const paragraph = textBlock(page).locator("p");
  await expect(paragraph).toBeVisible();
  await expect(paragraph).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(paragraph).toHaveCSS("font-size", "16px");
  await expect(paragraph).toHaveCSS("font-family", /^Arial/u);
  await expect(paragraph).toHaveCSS("letter-spacing", "normal");
  await expect(paragraph).toHaveCSS("line-height", "24px");
  await expect(paragraph).toHaveCSS("margin-top", "0px");
  await expect(paragraph).toHaveCSS("padding-top", "0px");
  await expect(paragraph).toHaveCSS("text-transform", "none");
  await expect(paragraph).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(textBlock(page)).toHaveCSS("white-space-collapse", /pre|break/u);
});

test("a controlled host passing each change back doesn't move the cursor", async ({
  page,
}) => {
  await focusStartOfTextBlock(page);

  await page.keyboard.type("abc");

  await expect(textBlock(page)).toHaveText("abcHello");
  await expect.poll(() => latestDocumentText(page)).toBe("abcHello");
});

test("host re-renders don't reset the canvas", async ({ page }) => {
  await focusStartOfTextBlock(page);
  await page.keyboard.type("ab");
  await expect(page.getByTestId("change-count")).toHaveText("2");

  // A scripted click, so the re-render happens while the text keeps focus.
  await page.evaluate(() => document.querySelector("button")?.click());
  await expect(page.getByTestId("render-count")).toHaveText("1");

  await expect(textBlock(page)).toBeFocused();
  await page.keyboard.type("cd");
  await expect(textBlock(page)).toHaveText("abcdHello");
  await expect(page.getByTestId("change-count")).toHaveText("4");
});

test("moving the element keeps the email editable", async ({ page }) => {
  await focusStartOfTextBlock(page);
  await page.keyboard.type("ab");

  await canvas(page).evaluate((element) => {
    const parent = element.parentElement;
    element.remove();
    parent?.append(element);
  });

  await expect(textBlock(page)).toHaveText("abHello");
  await focusStartOfTextBlock(page);
  await page.keyboard.type("c");
  await expect(textBlock(page)).toHaveText("cabHello");
  await expect.poll(() => latestDocumentText(page)).toBe("cabHello");
});

test("a detached element creates no text editors until it's attached again", async ({
  page,
}) => {
  const editorsWhileDetached = await canvas(page).evaluate(async (element) => {
    const mailQuilt = element as MailQuilt;
    // The getter returns a copy, so this is a different document object.
    const copy = mailQuilt.value;
    mailQuilt.value = copy;
    const parent = mailQuilt.parentElement;
    mailQuilt.remove();
    await mailQuilt.updateComplete;
    const count =
      mailQuilt.shadowRoot?.querySelectorAll("[contenteditable]").length;
    parent?.append(mailQuilt);
    return count;
  });

  expect(editorsWhileDetached).toBe(0);
  await expect(textBlock(page)).toHaveText("Hello");
});

test("exported HTML keeps repeated spaces typed in a Text Block", async ({
  page,
}) => {
  await focusStartOfTextBlock(page);

  await page.keyboard.type("a   b ");
  await expect(textBlock(page)).toHaveText("a   b Hello");

  expect(await exportHtml(page)).toContain("white-space:pre-wrap");
  expect(await exportHtml(page)).toContain("a   b Hello");
});
