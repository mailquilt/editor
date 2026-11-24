import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  blockGroup,
  blockProps,
  blockWith,
  canvas,
  changesSince,
  contrast,
  docsDarkTheme,
  field,
  formatButton,
  latestDocument,
  linkUrlField,
  openBlocks,
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

test.describe("in a field", () => {
  test("a text setting opens the list on {{, puts in {{name}} as text, and Escape closes the list before it discards", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await giveMergeTags(page, TAGS);
    await blockGroup(page, "Button").focus();
    const label = field(page, "Label");
    await expect(label).toHaveAccessibleDescription(
      "Type {{ to add a Merge Tag."
    );
    await label.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Hi {{la");

    await expect(picker(page).getByRole("option")).toHaveText([
      "Last name {{last_name}}",
    ]);
    await expect(label).toBeFocused();
    await expect(label).toHaveAttribute(
      "aria-activedescendant",
      (await tagOption(page, "Last name").getAttribute("id")) ?? ""
    );
    expect(await violations(page)).toEqual([]);

    // Enter puts the tag in, and leaves it to be committed.
    const changed = await changesSince(page);
    await page.keyboard.press("Enter");
    await expect(label).toHaveValue("Hi {{last_name}}");
    await expect(picker(page)).toHaveCount(0);
    await expect(label).not.toHaveAttribute("aria-activedescendant");
    await changed(0);
    await page.keyboard.press("Enter");
    await expect
      .poll(() => blockProps(page))
      .toMatchObject({ label: "Hi {{last_name}}" });

    // A click puts one in too, with focus left in the field.
    await page.keyboard.type(" {{");
    await tagOption(page, "company").click();
    await expect(label).toHaveValue("Hi {{last_name}} {{company}}");
    await expect(label).toBeFocused();

    await page.keyboard.type(" {{");
    await page.keyboard.press("Escape");
    await expect(picker(page)).toHaveCount(0);
    await expect(label).toHaveValue("Hi {{last_name}} {{company}} {{");
    await page.keyboard.press("Escape");
    await expect(label).toHaveValue("Hi {{last_name}}");
  });

  // A host can hide the hint, which only describes what {{ does.
  test("a text setting still opens the list on {{ when the Host app's hint is empty", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await giveMergeTags(page, TAGS);
    await canvas(page).evaluate((element) => {
      (element as MailQuilt).strings = { "mergeTags.hint": "" };
    });
    await blockGroup(page, "Button").focus();
    const label = field(page, "Label");
    await label.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("{{la");

    await expect(picker(page).getByRole("option")).toHaveText([
      "Last name {{last_name}}",
    ]);
    await expect(label).not.toHaveAccessibleDescription(/Merge Tag/u);
  });

  test("the list under a field closes when the Host app takes its tags away", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await giveMergeTags(page, TAGS);
    await blockGroup(page, "Button").focus();
    const label = field(page, "Label");
    await label.fill("{{");
    await expect(picker(page)).toBeVisible();

    await giveMergeTags(page, undefined);

    await expect(picker(page)).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect.poll(() => blockProps(page)).toMatchObject({ label: "{{" });
  });

  test("the list under a field reads what was typed while the Host app had no tags, once they're back", async ({
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await giveMergeTags(page, TAGS);
    await blockGroup(page, "Button").focus();
    const label = field(page, "Label");
    await label.fill("{{fi");
    await expect(tagOption(page, "First name")).toBeVisible();

    await giveMergeTags(page, undefined);
    await label.fill("{{co");
    await giveMergeTags(page, TAGS);

    await expect(picker(page).getByRole("option")).toHaveText(["company"]);
  });

  test("the link field opens the list on {{, and Escape closes the list before the field", async ({
    page,
  }) => {
    await typeInText(page, "Hi");
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+k");
    await expect(linkUrlField(page)).toBeFocused();
    await expect(linkUrlField(page)).toHaveAccessibleDescription(
      "Type {{ to add a Merge Tag."
    );
    await page.keyboard.type("{{");
    await expect(picker(page)).toBeVisible();

    await page.keyboard.press("Enter");

    await expect(linkUrlField(page)).toHaveValue("{{first_name}}");
    await expect(linkUrlField(page)).toBeFocused();
    await page.keyboard.type("/{{");
    await page.keyboard.press("Escape");
    await expect(picker(page)).toHaveCount(0);
    await expect(linkUrlField(page)).toBeFocused();
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        {
          marks: [{ attrs: { href: "{{first_name}}/" }, type: "link" }],
          text: "Hi",
          type: "text",
        },
      ]);

    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.type("{{");
    await page.keyboard.press("Escape");
    await expect(picker(page)).toHaveCount(0);
    await expect(linkUrlField(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(linkUrlField(page)).toHaveCount(0);
    await expect(textBlock(page)).toBeFocused();
  });
});

/** The numbers in a color that `getComputedStyle` gives, such as `rgba()`. */
const channels = (color = "") => (color.match(/[\d.]+/gu) ?? []).map(Number);

/**
 * The color of an inset edge drawn with box-shadow, as it shows over what's
 * behind it, and that color behind it: the background of the element's parent
 * nearest it that has one. An edge with alpha is blended over it.
 */
const edgeAndBehind = async (element: Locator) => {
  const [edge, back] = await element.evaluate((node) => {
    const shadow = getComputedStyle(node).boxShadow;
    let parent = node.parentElement;
    while (
      parent &&
      getComputedStyle(parent).backgroundColor === "rgba(0, 0, 0, 0)"
    ) {
      parent = parent.parentElement;
    }
    return [
      shadow.includes("inset")
        ? (shadow.match(/rgba?\([^)]*\)/u)?.[0] ?? "")
        : "",
      parent ? getComputedStyle(parent).backgroundColor : "",
    ];
  });
  const [red = 0, green = 0, blue = 0, alpha = 1] = channels(edge);
  const [backRed = 0, backGreen = 0, backBlue = 0] = channels(back);
  const blend = (top: number, bottom: number) =>
    Math.round(top * alpha + bottom * (1 - alpha));
  return [
    edge
      ? `rgb(${blend(red, backRed)}, ${blend(green, backGreen)}, ${blend(blue, backBlue)})`
      : "",
    back ?? "",
  ];
};

test("the highlighted tag in the list has an edge at 3:1, so it isn't told by color alone", async ({
  page,
}) => {
  await openBlocks(page, ["text"]);
  await giveMergeTags(page, TAGS);
  await typeInText(page, "{{");
  const highlighted = picker(page).locator('[aria-selected="true"]');
  await expect(highlighted).toHaveCount(1);

  const [edge = "", list = ""] = await edgeAndBehind(highlighted);

  expect(edge).not.toBe("");
  expect(contrast(edge, list)).toBeGreaterThanOrEqual(3);
});

for (const theme of ["default", "the docs' dark"] as const) {
  test(`a Merge Tag in text has an edge at 3:1 against the email, in the ${theme} theme, so it's told from typed words`, async ({
    page,
  }) => {
    await openBlocks(page, ["text"]);
    if (theme !== "default") {
      await page.addStyleTag({ content: docsDarkTheme() });
    }
    await giveMergeTags(page, TAGS);
    await typeInText(page, "Hi {{first_name}}");
    const tag = textBlock(page)
      .getByText("First name", { exact: true })
      .locator("xpath=ancestor-or-self::*[@data-merge-tag]");
    await expect(tag).toBeVisible();

    const [edge = "", email = ""] = await edgeAndBehind(tag);

    expect(edge).not.toBe("");
    expect(contrast(edge, email)).toBeGreaterThanOrEqual(3);
  });
}
