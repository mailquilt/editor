import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  addSecondTextBlock,
  canvas,
  exportHtml,
  redoByKey,
  settle,
  undoByKey,
} from "./helpers.js";

const textBlock = (page: Page) =>
  page.getByRole("textbox", { name: "Text Block" }).first();
const secondTextBlock = (page: Page) =>
  page.getByRole("textbox", { name: "Text Block" }).nth(1);
/** The format bar shows while a Block's text is being edited. */
const toolbarButton = (page: Page, name: string) =>
  page.getByRole("toolbar", { name: "Text formatting" }).getByRole("button", {
    exact: true,
    name,
  });
const linkInput = (page: Page) =>
  page.getByRole("textbox", { name: "Link URL" });

const selectAll = (page: Page) => page.keyboard.press("ControlOrMeta+a");

/** The saved content of the Block at `index`, as the host last received it. */
const savedParagraphs = async (page: Page, index = 0) => {
  const text = await page.getByTestId("latest-document").textContent();
  // A Block added by setting `value` is missing until the next mq-change.
  return JSON.parse(text ?? "null").rows[0].columns[0].blocks[index]?.props
    .content.content;
};

const savedInline = async (page: Page, index = 0) => {
  const paragraphs = await savedParagraphs(page, index);
  return paragraphs?.[0].content;
};

const selectAllInBlock = async (page: Page) => {
  await textBlock(page).click();
  await expect(textBlock(page)).toBeFocused();
  await selectAll(page);
};

const pressArrow = async (page: Page, key: "ArrowLeft" | "ArrowRight") => {
  await page.keyboard.press(key);
  await settle(page);
};

const cursorAtEndOfBlock = async (page: Page) => {
  await selectAllInBlock(page);
  await pressArrow(page, "ArrowRight");
};

const pasteHtml = (page: Page, html: string) =>
  textBlock(page).evaluate((element, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/html", value);
    // Not a ClipboardEvent, whose constructor ignores this data in Firefox.
    const event = new Event("paste", {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    element.dispatchEvent(event);
  }, html);

const extendSelection = async (page: Page, key: "ArrowLeft" | "ArrowRight") => {
  await page.keyboard.press(`Shift+${key}`);
  await settle(page);
};

/** The plain text a copy of the selection would give. */
const copiedText = (page: Page) =>
  textBlock(page).evaluate((element) => {
    const clipboardData = new DataTransfer();
    // Not a ClipboardEvent, whose constructor ignores this data in Firefox.
    const event = new Event("copy", {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    element.dispatchEvent(event);
    return clipboardData.getData("text/plain");
  });

const addLink = async (page: Page, href: string) => {
  await toolbarButton(page, "Link").click();
  await linkInput(page).fill(href);
  await page.keyboard.press("Enter");
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");
});

test("from all the text selected, ← and → go to its start and end", async ({
  page,
}) => {
  await selectAllInBlock(page);
  await pressArrow(page, "ArrowLeft");
  await page.keyboard.type("x");
  await expect(textBlock(page)).toHaveText("xHello");

  await selectAll(page);
  await pressArrow(page, "ArrowRight");
  await page.keyboard.type("y");
  await expect(textBlock(page)).toHaveText("xHelloy");
});

test.describe("bold, italic and underline", () => {
  test("Underline from its keyboard shortcut reaches the exported email", async ({
    page,
  }) => {
    await selectAllInBlock(page);

    await page.keyboard.press("ControlOrMeta+u");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "underline" }], text: "Hello", type: "text" },
      ]);
    expect(await exportHtml(page)).toContain("<u>Hello</u>");
  });

  test("the toolbar button turns formatting off again", async ({ page }) => {
    await selectAllInBlock(page);

    await toolbarButton(page, "Bold").click();
    await toolbarButton(page, "Bold").click();

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello", type: "text" }]);
    await expect(toolbarButton(page, "Bold")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  test("the toolbar shows the formatting at the cursor", async ({ page }) => {
    await selectAllInBlock(page);
    await page.keyboard.press("ControlOrMeta+b");
    await pressArrow(page, "ArrowRight");
    const bold = toolbarButton(page, "Bold");
    await expect(bold).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("ControlOrMeta+b");
    await expect(bold).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.type("xy");
    await expect(bold).toHaveAttribute("aria-pressed", "false");

    await pressArrow(page, "ArrowLeft");
    await pressArrow(page, "ArrowLeft");
    await pressArrow(page, "ArrowLeft");
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await expect(toolbarButton(page, "Italic")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  test("bold on text that's partly bold makes all of it bold", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type(" there");
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "Hello", type: "text" },
        { marks: [{ type: "bold" }], text: " there", type: "text" },
      ]);

    await selectAll(page);
    await page.keyboard.press("ControlOrMeta+b");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "bold" }], text: "Hello there", type: "text" },
      ]);
  });

  test("bold on part of a Merge Tag makes all of the tag bold", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await page.keyboard.type("Hi {{first_name}}");
    await pressArrow(page, "ArrowLeft");
    await pressArrow(page, "ArrowLeft");
    for (const _ of "first_name") {
      // oxlint-disable-next-line no-await-in-loop -- Each key moves the selection on.
      await extendSelection(page, "ArrowLeft");
    }

    await page.keyboard.press("ControlOrMeta+b");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "Hi ", type: "text" },
        { marks: [{ type: "bold" }], text: "{{first_name}}", type: "text" },
      ]);
    expect(await exportHtml(page)).toContain("<strong>{{first_name}}</strong>");
  });

  test("a Merge Tag after a line break is kept whole too", async ({ page }) => {
    await selectAllInBlock(page);
    await page.keyboard.type("Hi");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("{{first_name}}");
    await pressArrow(page, "ArrowLeft");
    await pressArrow(page, "ArrowLeft");
    for (const _ of "first_name") {
      // oxlint-disable-next-line no-await-in-loop -- Each key moves the selection on.
      await extendSelection(page, "ArrowLeft");
    }

    await page.keyboard.press("ControlOrMeta+b");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "Hi", type: "text" },
        { type: "hardBreak" },
        { marks: [{ type: "bold" }], text: "{{first_name}}", type: "text" },
      ]);
  });

  test("bold off part of a Merge Tag takes it off all of the tag", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await page.keyboard.type("Hi {{first_name}}");
    await selectAll(page);
    await page.keyboard.press("ControlOrMeta+b");
    await pressArrow(page, "ArrowRight");
    await pressArrow(page, "ArrowLeft");
    await pressArrow(page, "ArrowLeft");
    for (const _ of "first_name") {
      // oxlint-disable-next-line no-await-in-loop -- Each key moves the selection on.
      await extendSelection(page, "ArrowLeft");
    }

    await page.keyboard.press("ControlOrMeta+b");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "bold" }], text: "Hi ", type: "text" },
        { text: "{{first_name}}", type: "text" },
      ]);
  });

  test("a new link on part of a linked Merge Tag goes on all of it", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await page.keyboard.type("{{first_name}}");
    await selectAll(page);
    await addLink(page, "https://example.com");
    await expect(textBlock(page)).toBeFocused();
    await pressArrow(page, "ArrowLeft");
    for (const _ of "{{first") {
      // oxlint-disable-next-line no-await-in-loop -- Each key moves the selection on.
      await extendSelection(page, "ArrowRight");
    }

    await addLink(page, "https://example.org");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        {
          marks: [{ attrs: { href: "https://example.org" }, type: "link" }],
          text: "{{first_name}}",
          type: "text",
        },
      ]);
  });
});

test.describe("the toolbar", () => {
  test("keeps the selection and focus in the Block", async ({ page }) => {
    await selectAllInBlock(page);

    await toolbarButton(page, "Bold").click();
    await expect(textBlock(page)).toBeFocused();
    await toolbarButton(page, "Italic").click();
    await expect(textBlock(page)).toBeFocused();

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        {
          marks: [{ type: "bold" }, { type: "italic" }],
          text: "Hello",
          type: "text",
        },
      ]);

    // Typing replaces the whole word only if it's still selected.
    await page.keyboard.type("x");
    await expect(textBlock(page)).toHaveText("x");
  });

  test("works by keyboard, returning focus to the Block", async ({ page }) => {
    await selectAllInBlock(page);
    await toolbarButton(page, "Bold").focus();

    await page.keyboard.press("Enter");

    await expect(textBlock(page)).toBeFocused();
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "bold" }], text: "Hello", type: "text" },
      ]);
  });

  test("by keyboard with only a cursor, typing continues where it was, formatted", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await toolbarButton(page, "Bold").focus();

    await page.keyboard.press("Enter");

    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("x");
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "Hello", type: "text" },
        { marks: [{ type: "bold" }], text: "x", type: "text" },
      ]);
  });

  test("acts on the Block focused last", async ({ page }) => {
    await addSecondTextBlock(page);
    await expect(secondTextBlock(page)).toHaveText("Hello");
    await secondTextBlock(page).click();
    await expect(secondTextBlock(page)).toBeFocused();
    await selectAll(page);

    await toolbarButton(page, "Bold").click();

    await expect(secondTextBlock(page)).toBeFocused();
    await expect
      .poll(() => savedInline(page, 1))
      .toStrictEqual([
        { marks: [{ type: "bold" }], text: "Hello", type: "text" },
      ]);
    expect(await savedInline(page, 0)).toStrictEqual([
      { text: "Hello", type: "text" },
    ]);
  });
});

test.describe("line breaks", () => {
  test("Enter and Shift+Enter keep the formatting for what's typed next", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await page.keyboard.press("ControlOrMeta+b");
    await pressArrow(page, "ArrowRight");

    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("x");
    await page.keyboard.press("Enter");
    await page.keyboard.type("y");

    const bold = [{ type: "bold" }];
    await expect
      .poll(() => savedParagraphs(page))
      .toStrictEqual([
        {
          content: [
            { marks: bold, text: "Hello", type: "text" },
            { type: "hardBreak" },
            { marks: bold, text: "x", type: "text" },
          ],
          type: "paragraph",
        },
        {
          content: [{ marks: bold, text: "y", type: "text" }],
          type: "paragraph",
        },
      ]);
  });

  test("a line break replaces the selection, and typing goes after it", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await extendSelection(page, "ArrowLeft");
    await extendSelection(page, "ArrowLeft");
    await extendSelection(page, "ArrowLeft");

    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("x");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "He", type: "text" },
        { type: "hardBreak" },
        { text: "x", type: "text" },
      ]);
  });

  test("a line break over all the text keeps the break", async ({ page }) => {
    await selectAllInBlock(page);

    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("x");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ type: "hardBreak" }, { text: "x", type: "text" }]);
  });

  test("Control or Command+Enter adds a line break too", async ({ page }) => {
    await cursorAtEndOfBlock(page);

    await page.keyboard.press("ControlOrMeta+Enter");
    await page.keyboard.type("x");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "Hello", type: "text" },
        { type: "hardBreak" },
        { text: "x", type: "text" },
      ]);
  });

  test("Delete in an empty last paragraph removes it", async ({ page }) => {
    await cursorAtEndOfBlock(page);
    await page.keyboard.press("Enter");
    await expect.poll(() => savedParagraphs(page)).toHaveLength(2);

    await page.keyboard.press("Delete");

    await expect
      .poll(() => savedParagraphs(page))
      .toStrictEqual([
        { content: [{ text: "Hello", type: "text" }], type: "paragraph" },
      ]);
  });

  test("the toolbar adds a line break and keeps focus in the Block", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);

    await toolbarButton(page, "Line break").click();

    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("x");
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "Hello", type: "text" },
        { type: "hardBreak" },
        { text: "x", type: "text" },
      ]);
  });
});

test.describe("links", () => {
  test("Control or Command+K opens the link field", async ({ page }) => {
    await selectAllInBlock(page);

    await page.keyboard.press("ControlOrMeta+k");

    await expect(linkInput(page)).toBeFocused();
  });

  test("applying a link returns focus and the selection to the Block", async ({
    page,
  }) => {
    await selectAllInBlock(page);

    await addLink(page, "https://example.com");

    await expect(linkInput(page)).toBeHidden();
    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("x");
    await expect(textBlock(page)).toHaveText("x");
  });

  test("a Merge Tag is accepted as a link URL", async ({ page }) => {
    await selectAllInBlock(page);

    await addLink(page, "{{cta_url}}");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        {
          marks: [{ attrs: { href: "{{cta_url}}" }, type: "link" }],
          text: "Hello",
          type: "text",
        },
      ]);
    expect(await exportHtml(page)).toContain('<a href="{{cta_url}}"');
  });

  test("refuses javascript:alert(1) and says why", async ({ page }) => {
    await selectAllInBlock(page);

    // oxlint-disable-next-line eslint/no-script-url -- This is what the test refuses.
    await addLink(page, "javascript:alert(1)");

    await expect(page.getByRole("alert")).toContainText("Merge Tag");
    await expect(linkInput(page)).toBeVisible();
    await expect(linkInput(page)).toHaveAttribute("aria-invalid", "true");
    expect(await savedInline(page)).toStrictEqual([
      { text: "Hello", type: "text" },
    ]);

    // The same reason again is a new alert, so it's read out again.
    await page.getByRole("alert").evaluate((element) => {
      element.dataset.seen = "true";
    });
    await linkInput(page).press("Enter");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).not.toHaveAttribute("data-seen");
  });

  test("spaces around a pasted URL are ignored", async ({ page }) => {
    await selectAllInBlock(page);

    await addLink(page, "  https://example.com ");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        {
          marks: [{ attrs: { href: "https://example.com" }, type: "link" }],
          text: "Hello",
          type: "text",
        },
      ]);
  });

  test("Escape closes the field and returns to the Block unchanged", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await toolbarButton(page, "Link").click();
    await linkInput(page).fill("https://example.com");

    await page.keyboard.press("Escape");

    await expect(linkInput(page)).toBeHidden();
    await expect(textBlock(page)).toBeFocused();
    expect(await savedInline(page)).toStrictEqual([
      { text: "Hello", type: "text" },
    ]);
    await page.keyboard.type("x");
    await expect(textBlock(page)).toHaveText("x");
  });

  test("in an empty Block with everything selected, the URL becomes the linked text", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await page.keyboard.press("Backspace");
    await expect(textBlock(page)).toHaveText("");
    await selectAll(page);

    await addLink(page, "https://example.com");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        {
          marks: [{ attrs: { href: "https://example.com" }, type: "link" }],
          text: "https://example.com",
          type: "text",
        },
      ]);
  });

  test("moving the element closes the field, because its selection is gone", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await toolbarButton(page, "Link").click();
    await expect(linkInput(page)).toBeFocused();

    await canvas(page).evaluate((element) => {
      const parent = element.parentElement;
      element.remove();
      parent?.append(element);
    });

    await expect(textBlock(page)).toHaveText("Hello");
    await expect(linkInput(page)).toBeHidden();
    await expect(toolbarButton(page, "Bold")).toHaveCount(0);
  });

  test("clicking back into the Block closes the field", async ({ page }) => {
    await selectAllInBlock(page);
    await toolbarButton(page, "Link").click();
    await expect(linkInput(page)).toBeFocused();

    await textBlock(page).click();

    await expect(linkInput(page)).toBeHidden();
  });

  test("with only a cursor, the URL becomes the linked text", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);

    await addLink(page, "{{cta_url}}");
    await expect(textBlock(page)).toHaveText("Hello{{cta_url}}");
    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("!");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "Hello", type: "text" },
        {
          marks: [{ attrs: { href: "{{cta_url}}" }, type: "link" }],
          text: "{{cta_url}}",
          type: "text",
        },
        { text: "!", type: "text" },
      ]);
  });

  test.describe("with a link already there", () => {
    test.beforeEach(async ({ page }) => {
      await selectAllInBlock(page);
      await addLink(page, "https://example.com");
      await expect(textBlock(page)).toBeFocused();
      await expect(toolbarButton(page, "Link")).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });

    test("the field shows its URL, and changing it changes the whole link", async ({
      page,
    }) => {
      // A cursor in the middle of the link, with no selection.
      await pressArrow(page, "ArrowLeft");
      await pressArrow(page, "ArrowRight");
      await pressArrow(page, "ArrowRight");
      await expect(toolbarButton(page, "Link")).toHaveAttribute(
        "aria-pressed",
        "true"
      );

      await toolbarButton(page, "Link").click();
      await expect(linkInput(page)).toHaveValue("https://example.com");
      await linkInput(page).fill("https://example.org");
      await page.keyboard.press("Enter");

      await expect
        .poll(() => savedInline(page))
        .toStrictEqual([
          {
            marks: [{ attrs: { href: "https://example.org" }, type: "link" }],
            text: "Hello",
            type: "text",
          },
        ]);
    });

    test("changing the URL with only a cursor leaves the cursor where it was", async ({
      page,
    }) => {
      await pressArrow(page, "ArrowLeft");
      await pressArrow(page, "ArrowRight");
      await pressArrow(page, "ArrowRight");

      await addLink(page, "https://example.org");
      await expect(textBlock(page)).toBeFocused();
      await page.keyboard.type("x");

      await expect(textBlock(page)).toHaveText("Hexllo");
    });

    test("Remove link takes it off", async ({ page }) => {
      await toolbarButton(page, "Link").click();

      await page.getByRole("button", { name: "Remove link" }).click();

      await expect
        .poll(() => savedInline(page))
        .toStrictEqual([{ text: "Hello", type: "text" }]);
      await expect(linkInput(page)).toBeHidden();
      await expect(textBlock(page)).toBeFocused();
    });

    test("Remove link with only a cursor takes off all of it", async ({
      page,
    }) => {
      // "He" bold as well, so the link is in two pieces.
      await pressArrow(page, "ArrowLeft");
      await extendSelection(page, "ArrowRight");
      await extendSelection(page, "ArrowRight");
      await page.keyboard.press("ControlOrMeta+b");
      // A cursor in the second piece, between "l" and "lo".
      await pressArrow(page, "ArrowRight");
      await pressArrow(page, "ArrowRight");

      await toolbarButton(page, "Link").click();
      await page.getByRole("button", { name: "Remove link" }).click();

      await expect
        .poll(() => savedInline(page))
        .toStrictEqual([
          { marks: [{ type: "bold" }], text: "He", type: "text" },
          { text: "llo", type: "text" },
        ]);
    });

    test("typing at the end of a link doesn't extend it", async ({ page }) => {
      await pressArrow(page, "ArrowRight");

      await page.keyboard.type("!");

      await expect
        .poll(() => savedInline(page))
        .toStrictEqual([
          {
            marks: [{ attrs: { href: "https://example.com" }, type: "link" }],
            text: "Hello",
            type: "text",
          },
          { text: "!", type: "text" },
        ]);
    });

    test("clicking a link in the Block doesn't follow it", async ({ page }) => {
      await textBlock(page).locator("a").click();

      await expect(page).toHaveURL(/localhost/u);
      await expect(textBlock(page)).toBeFocused();
    });
  });
});

test.describe("undo and redo", () => {
  test("a formatting change is one undo step, and keeps the selection", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await toolbarButton(page, "Bold").click();
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "bold" }], text: "Hello", type: "text" },
      ]);

    await undoByKey(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello", type: "text" }]);
    await expect(toolbarButton(page, "Bold")).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    await redoByKey(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "bold" }], text: "Hello", type: "text" },
      ]);
    await expect(toolbarButton(page, "Bold")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.keyboard.type("x");
    await expect(textBlock(page)).toHaveText("x");
  });

  test("undoing a text edit of the same length still moves the cursor to it", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await pressArrow(page, "ArrowLeft");
    await page.keyboard.press("Shift+ArrowRight");
    await settle(page);
    await page.keyboard.type("x");
    await expect(textBlock(page)).toHaveText("xello");
    await selectAll(page);
    await pressArrow(page, "ArrowRight");

    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");
    await page.keyboard.type("!");

    await expect(textBlock(page)).toHaveText("H!ello");
  });

  test("a formatting change doesn't merge with the typing before it", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await page.keyboard.type("!");
    await toolbarButton(page, "Line break").click();
    await page.keyboard.type("x");
    await expect(textBlock(page)).toContainText("x");

    await undoByKey(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello!", type: "text" }, { type: "hardBreak" }]);
    await undoByKey(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello!", type: "text" }]);
  });

  test("text typed after turning bold on doesn't merge with the text before it", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await page.keyboard.type("a");
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type("b");
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "Helloa", type: "text" },
        { marks: [{ type: "bold" }], text: "b", type: "text" },
      ]);

    await undoByKey(page);

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Helloa", type: "text" }]);
  });

  test("adding and removing a link can each be undone", async ({ page }) => {
    await selectAllInBlock(page);
    await addLink(page, "https://example.com");
    await expect(textBlock(page)).toBeFocused();
    await toolbarButton(page, "Link").click();
    await page.getByRole("button", { name: "Remove link" }).click();
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello", type: "text" }]);
    await expect(textBlock(page)).toBeFocused();

    await undoByKey(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        {
          marks: [{ attrs: { href: "https://example.com" }, type: "link" }],
          text: "Hello",
          type: "text",
        },
      ]);

    await undoByKey(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello", type: "text" }]);
  });
});

test.describe("copy and paste", () => {
  test("formatted text keeps its formatting between Blocks", async ({
    page,
  }) => {
    await addSecondTextBlock(page);
    await expect(secondTextBlock(page)).toHaveText("Hello");
    await selectAllInBlock(page);
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.press("ControlOrMeta+c");

    await secondTextBlock(page).click();
    await expect(secondTextBlock(page)).toBeFocused();
    await selectAll(page);
    await page.keyboard.press("ControlOrMeta+v");

    await expect
      .poll(() => savedInline(page, 1))
      .toStrictEqual([
        { marks: [{ type: "bold" }], text: "Hello", type: "text" },
      ]);
  });

  test("formatting written as styles is kept", async ({ page }) => {
    await selectAllInBlock(page);

    // Google Docs wraps what it copies in a <b> that isn't bold.
    await pasteHtml(
      page,
      `<b style="font-weight:normal"><p><span style="font-weight:700">bold</span><span style="font-style:italic">italic</span><span style="text-decoration:underline">under</span><span>plain</span></p></b>`
    );

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "bold" }], text: "bold", type: "text" },
        { marks: [{ type: "italic" }], text: "italic", type: "text" },
        { marks: [{ type: "underline" }], text: "under", type: "text" },
        { text: "plain", type: "text" },
      ]);
  });

  test("copying gives plain text with its lines and paragraphs", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("A");
    await page.keyboard.press("Enter");
    await page.keyboard.type("B");
    await selectAll(page);

    expect(await copiedText(page)).toBe("Hello\nA\n\nB");
  });

  test("pasted content is reduced to the allowed formatting", async ({
    page,
  }) => {
    await selectAllInBlock(page);

    await pasteHtml(
      page,
      `<h1 style="color:red">Title</h1>
       <p style="font-size:40px"><b>bold</b> <i>italic</i> <u>under</u>
         <s>struck</s> <span style="color:red">red</span>
         <img src="x" onerror="alert(1)"><br><code>code</code></p>
       <ul><li>item</li></ul>
       <table><tr><td>cell</td></tr></table>
       <script>alert(1)</script>`
    );

    // The host shows the saved email a render after the canvas has it.
    await expect(page.getByTestId("latest-document")).toContainText("Title");
    const paragraphs: {
      content?: { marks?: { type: string }[]; type: string }[];
      type: string;
    }[] = await savedParagraphs(page);
    const inline = paragraphs.flatMap(({ content }) => content ?? []);

    expect(new Set(paragraphs.map(({ type }) => type))).toStrictEqual(
      new Set(["paragraph"])
    );
    expect(new Set(inline.map(({ type }) => type))).toStrictEqual(
      new Set(["hardBreak", "text"])
    );
    expect(
      new Set(
        inline.flatMap(({ marks }) => (marks ?? []).map(({ type }) => type))
      )
    ).toStrictEqual(new Set(["bold", "italic", "underline"]));
    const text = await textBlock(page).textContent();
    expect(text).toContain("struck");
    expect(text).toContain("cell");
    expect(text).not.toContain("alert");
    await expect(textBlock(page).locator("img")).toHaveCount(0);
    expect(await exportHtml(page)).not.toContain("color:red");
  });

  test("a pasted executable link keeps its text but not the link", async ({
    page,
  }) => {
    await selectAllInBlock(page);

    await pasteHtml(page, `<a href="javascript:alert(1)">Click</a>`);

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Click", type: "text" }]);
    await expect(textBlock(page).locator("a")).toHaveCount(0);
  });

  test("a pasted link keeps only its URL", async ({ page }) => {
    await selectAllInBlock(page);

    await pasteHtml(
      page,
      `<a href="{{cta_url}}" target="_top" class="x" onclick="alert(1)">Go</a>`
    );

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        {
          marks: [{ attrs: { href: "{{cta_url}}" }, type: "link" }],
          text: "Go",
          type: "text",
        },
      ]);
  });
});
