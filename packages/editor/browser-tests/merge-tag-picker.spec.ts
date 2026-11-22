import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  blockWith,
  canvas,
  changesSince,
  formatButton,
  latestDocument,
  openTestPage,
  previewButton,
  previewEmail,
  settle,
  test,
  textBlock,
  tooltip,
  violations,
} from "./helpers.js";

const TAGS = [
  { label: "First name", name: "first_name" },
  { label: "Last name", name: "last_name" },
  { name: "company" },
];

const giveMergeTags = (page: Page, tags: MailQuilt["mergeTags"]) =>
  canvas(page).evaluate((element, given) => {
    (element as MailQuilt).mergeTags = given;
  }, tags);

const picker = (page: Page) =>
  canvas(page).getByRole("listbox", { name: "Merge Tags" });

const tagOption = (page: Page, name: string) =>
  picker(page).getByRole("option", { name });

/** The inline content of the Text Block, as the host last received it. */
const savedInline = async (page: Page) => {
  const { rows } = await latestDocument(page);
  const props = rows[0]?.columns[0]?.blocks[0]?.props as {
    content: { content: { content?: unknown[] }[] };
  };
  return props.content.content[0]?.content;
};

const mergeTag = (name: string) => ({ attrs: { name }, type: "mergeTag" });

/** Clears the Text Block and types `words` into it. */
const typeInText = async (page: Page, words: string) => {
  await textBlock(page).click();
  await expect(textBlock(page)).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(words);
};

test.beforeEach(async ({ page }) => {
  await openTestPage(page);
  await giveMergeTags(page, TAGS);
});

test("typing {{ opens the list under it, which what's typed narrows, with focus in the text", async ({
  page,
}) => {
  await typeInText(page, "Hi {{");

  await expect(picker(page).getByRole("option")).toHaveText([
    "First name {{first_name}}",
    "Last name {{last_name}}",
    "company",
  ]);
  await expect(textBlock(page)).toBeFocused();
  // Below the line, starting near where the {{ is.
  const text = await textBlock(page).boundingBox();
  const list = await picker(page).boundingBox();
  expect(list?.y).toBeGreaterThan((text?.y ?? 0) + 10);
  expect(list?.x).toBeGreaterThan((text?.x ?? 0) + 10);

  await page.keyboard.type("LAST");

  await expect(picker(page).getByRole("option")).toHaveText([
    "Last name {{last_name}}",
  ]);
});

test("the text names the list, and the tag the arrow keys highlight", async ({
  page,
}) => {
  await typeInText(page, "{{");
  const listId = await picker(page).getAttribute("id");
  await expect(textBlock(page)).toHaveAttribute("aria-controls", listId ?? "");
  await expect(tagOption(page, "First name")).toHaveAttribute(
    "aria-selected",
    "true"
  );

  await page.keyboard.press("ArrowUp");

  const company = tagOption(page, "company");
  await expect(company).toHaveAttribute("aria-selected", "true");
  await expect(textBlock(page)).toHaveAttribute(
    "aria-activedescendant",
    (await company.getAttribute("id")) ?? ""
  );
  expect(await violations(page)).toEqual([]);
});

test("Enter puts in the highlighted tag in place of what's typed, and typing goes on after it", async ({
  page,
}) => {
  await typeInText(page, "Hi {{nam");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.type("!");

  await expect
    .poll(() => savedInline(page))
    .toStrictEqual([
      { text: "Hi ", type: "text" },
      mergeTag("last_name"),
      { text: "!", type: "text" },
    ]);
  await expect(picker(page)).toHaveCount(0);
  await expect(textBlock(page)).not.toHaveAttribute("aria-activedescendant");
});

test("a click on a tag puts it in, and leaves focus in the text", async ({
  page,
}) => {
  await typeInText(page, "{{");

  await tagOption(page, "company").click();

  await expect
    .poll(() => savedInline(page))
    .toStrictEqual([mergeTag("company")]);
  await expect(textBlock(page)).toBeFocused();
});

test("Escape closes the list and leaves the text, and the next one goes back to the Block", async ({
  page,
}) => {
  await typeInText(page, "Hi {{fir");

  await page.keyboard.press("Escape");

  await expect(picker(page)).toHaveCount(0);
  await expect(textBlock(page)).toBeFocused();
  await expect(textBlock(page)).toHaveText("Hi {{fir");

  await page.keyboard.press("Escape");

  await expect(blockWith(page, "Hi {{fir")).toBeFocused();
});

test("typing }} makes a tag the list doesn't have one unit", async ({
  page,
}) => {
  await typeInText(page, "{{zip}}");

  await expect.poll(() => savedInline(page)).toStrictEqual([mergeTag("zip")]);
});

test("leaving the text closes the list", async ({ page }) => {
  await typeInText(page, "{{");
  await expect(picker(page)).toBeVisible();

  await page.keyboard.press("Shift+Tab");

  await expect(picker(page)).toHaveCount(0);
});

test("another window taking focus leaves the list open for when it comes back", async ({
  page,
}) => {
  await typeInText(page, "{{");
  await expect(picker(page)).toBeVisible();

  // A test's page always has focus, so this stands in for the window losing it.
  await textBlock(page).evaluate((text) => {
    document.hasFocus = () => false;
    text.dispatchEvent(new FocusEvent("blur"));
  });
  await settle(page);

  await expect(picker(page)).toBeVisible();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => savedInline(page))
    .toStrictEqual([mergeTag("first_name")]);
});

test.describe("the format bar's Merge Tag button", () => {
  test("types {{ at the cursor and opens the list, with focus back in the text", async ({
    page,
  }) => {
    await typeInText(page, "Hi ");
    await page.keyboard.press("Alt+F10");
    await page.keyboard.press("End");
    await expect(formatButton(page, "Merge Tag")).toBeFocused();

    await page.keyboard.press("Enter");

    await expect(textBlock(page)).toBeFocused();
    await expect(textBlock(page)).toHaveText("Hi {{");
    await expect(picker(page)).toBeVisible();
    await page.keyboard.press("Enter");
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hi ", type: "text" }, mergeTag("first_name")]);
  });

  test("by pointer, keeps focus in the text", async ({ page }) => {
    await typeInText(page, "Hi ");

    await formatButton(page, "Merge Tag").click();

    await expect(textBlock(page)).toBeFocused();
    await expect(picker(page)).toBeVisible();
  });
});

test("without a tag it can offer, {{ opens nothing and there's no Merge Tag button", async ({
  page,
}) => {
  // With its braces, by mistake, which text can't hold.
  await giveMergeTags(page, [{ name: "{{first_name}}" }]);
  await typeInText(page, "{{");
  await settle(page);

  await expect(picker(page)).toHaveCount(0);
  await expect(formatButton(page, "Bold")).toBeVisible();
  await expect(formatButton(page, "Merge Tag")).toHaveCount(0);
  await expect(textBlock(page)).not.toHaveAttribute("aria-controls");

  // Enter is the text's own, with nothing to pick.
  await page.keyboard.press("Enter");
  await expect(textBlock(page).locator("p")).toHaveCount(2);
});

test.describe("a tag on the Canvas", () => {
  test("shows its label, is read and shown in its tooltip as {{name}}, and goes back to its name without one", async ({
    page,
  }) => {
    await typeInText(page, "Hi {{first_name}} at {{company}}");
    const shown = textBlock(page).locator("[data-merge-tag]");

    await expect(shown).toHaveText(["{{first_name}}First name", "{{company}}"]);
    await expect(textBlock(page)).toMatchAriaSnapshot(
      `
      - textbox "Text Block":
        - paragraph: "Hi {{first_name}} at {{company}}"
      `
    );
    // The label is all that shows.
    await expect(shown.first().getByText("First name")).toBeVisible();
    await shown.first().hover();
    await expect(tooltip(page)).toHaveText("{{first_name}}");

    const changed = await changesSince(page);
    await giveMergeTags(page, [{ label: "Company", name: "company" }]);

    await expect(shown).toHaveText(["{{first_name}}", "{{company}}Company"]);
    await changed(0);
  });

  test("the Preview and the export show {{name}}", async ({ page }) => {
    await typeInText(page, "Hi {{first_name}}");

    const html = await canvas(page).evaluate((element) =>
      (element as MailQuilt).exportHtml()
    );
    expect(html).toContain("Hi {{first_name}}");
    expect(html).not.toContain("First name");

    await previewButton(page).click();
    await expect(previewEmail(page)).toContainText("Hi {{first_name}}");
  });
});
