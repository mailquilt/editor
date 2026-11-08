import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import { canvas, exportHtml } from "./helpers.js";

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

const undo = (page: Page) => page.keyboard.press("ControlOrMeta+z");
const redo = (page: Page) => page.keyboard.press("ControlOrMeta+Shift+z");
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

/**
 * Chromium reports a moved selection just after the key press, so the editor
 * can only act on it once this has passed. A person's next key is always later.
 */
const waitForSelectionToRegister = (page: Page) =>
  page.evaluate(
    () =>
      // oxlint-disable-next-line promise/avoid-new -- These browser callbacks have no promise form.
      new Promise((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 0));
      })
  );

const pressArrow = async (page: Page, key: "ArrowLeft" | "ArrowRight") => {
  await page.keyboard.press(key);
  await waitForSelectionToRegister(page);
};

const cursorAtEndOfBlock = async (page: Page) => {
  await selectAllInBlock(page);
  await pressArrow(page, "ArrowRight");
};

const addSecondTextBlock = (page: Page) =>
  canvas(page).evaluate((element) => {
    const mailQuilt = element as MailQuilt;
    const document = mailQuilt.value;
    const column = document?.rows[0]?.columns[0];
    const block = column?.blocks[0];
    if (block) {
      column?.blocks.push({ ...structuredClone(block), id: "block-2" });
    }
    mailQuilt.value = document;
  });

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

const addLink = async (page: Page, href: string) => {
  await toolbarButton(page, "Link").click();
  await linkInput(page).fill(href);
  await page.keyboard.press("Enter");
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");
});

test.describe("bold, italic and underline", () => {
  const marks = [
    { button: "Bold", html: "<strong>Hello</strong>", key: "b", type: "bold" },
    { button: "Italic", html: "<em>Hello</em>", key: "i", type: "italic" },
    { button: "Underline", html: "<u>Hello</u>", key: "u", type: "underline" },
  ];

  for (const { button, html, key, type } of marks) {
    test(`${button} from the toolbar reaches the exported email`, async ({
      page,
    }) => {
      await selectAllInBlock(page);

      await toolbarButton(page, button).click();

      await expect
        .poll(() => savedInline(page))
        .toStrictEqual([{ marks: [{ type }], text: "Hello", type: "text" }]);
      await expect(toolbarButton(page, button)).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(await exportHtml(page)).toContain(html);
    });

    test(`${button} from its keyboard shortcut reaches the exported email`, async ({
      page,
    }) => {
      await selectAllInBlock(page);

      await page.keyboard.press(`ControlOrMeta+${key}`);

      await expect
        .poll(() => savedInline(page))
        .toStrictEqual([{ marks: [{ type }], text: "Hello", type: "text" }]);
      expect(await exportHtml(page)).toContain(html);
    });
  }

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

  test("text typed after turning bold on is bold", async ({ page }) => {
    await cursorAtEndOfBlock(page);

    await toolbarButton(page, "Bold").click();
    await expect(toolbarButton(page, "Bold")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.keyboard.type("x");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "Hello", type: "text" },
        { marks: [{ type: "bold" }], text: "x", type: "text" },
      ]);
  });

  test("typed Markdown stays as text", async ({ page }) => {
    await selectAllInBlock(page);

    await page.keyboard.type("**a** _b_ *c* ");

    await expect(textBlock(page)).toHaveText("**a** _b_ *c* ");
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "**a** _b_ *c* ", type: "text" }]);
  });
});

test.describe("the toolbar", () => {
  test("shows only while a Block's text is being edited", async ({ page }) => {
    await expect(toolbarButton(page, "Bold")).toHaveCount(0);

    await textBlock(page).click();
    await expect(toolbarButton(page, "Bold")).toBeEnabled();

    await page.keyboard.press("Escape");
    await expect(toolbarButton(page, "Bold")).toHaveCount(0);
  });

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

  test("host CSS doesn't reach it", async ({ page }) => {
    await canvas(page).evaluate((element) => {
      element.setAttribute("style", "color: red; font-size: 50px");
    });
    await textBlock(page).click();

    const button = toolbarButton(page, "Bold");
    await expect(button).toHaveCSS("font-size", "13px");
    await expect(button).not.toHaveCSS("color", "rgb(255, 0, 0)");
  });
});

test.describe("line breaks", () => {
  test("Shift+Enter adds a line break in the same paragraph", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);

    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("x");

    await expect
      .poll(() => savedParagraphs(page))
      .toStrictEqual([
        {
          content: [
            { text: "Hello", type: "text" },
            { type: "hardBreak" },
            { text: "x", type: "text" },
          ],
          type: "paragraph",
        },
      ]);
    expect(await exportHtml(page)).toContain("Hello<br />x");
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
  test("a link from the toolbar reaches the exported email", async ({
    page,
  }) => {
    await selectAllInBlock(page);

    await addLink(page, "https://example.com");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        {
          marks: [{ attrs: { href: "https://example.com" }, type: "link" }],
          text: "Hello",
          type: "text",
        },
      ]);
    expect(await exportHtml(page)).toContain(
      '<a href="https://example.com" target="_blank">Hello</a>'
    );
  });

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

  for (const href of [
    // oxlint-disable-next-line eslint/no-script-url -- This is what the test refuses.
    "javascript:alert(1)",
    " JAVASCRIPT:alert(1)",
    "data:x",
  ]) {
    test(`refuses ${href} and says why`, async ({ page }) => {
      await selectAllInBlock(page);

      await addLink(page, href);

      await expect(page.getByRole("alert")).toContainText("Merge Tag");
      await expect(linkInput(page)).toBeVisible();
      await expect(linkInput(page)).toHaveAttribute("aria-invalid", "true");
      expect(await savedInline(page)).toStrictEqual([
        { text: "Hello", type: "text" },
      ]);
    });
  }

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

    await undo(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello", type: "text" }]);
    await expect(toolbarButton(page, "Bold")).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    await redo(page);
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
    await waitForSelectionToRegister(page);
    await page.keyboard.type("x");
    await expect(textBlock(page)).toHaveText("xello");
    await selectAll(page);
    await pressArrow(page, "ArrowRight");

    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");
    await page.keyboard.type("!");

    await expect(textBlock(page)).toHaveText("H!ello");
  });

  test("each formatting change has its own step", async ({ page }) => {
    await selectAllInBlock(page);
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.press("ControlOrMeta+i");
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        {
          marks: [{ type: "bold" }, { type: "italic" }],
          text: "Hello",
          type: "text",
        },
      ]);

    await undo(page);

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "bold" }], text: "Hello", type: "text" },
      ]);
  });

  test("a formatting change doesn't merge with the typing before it", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await page.keyboard.type("!");
    await toolbarButton(page, "Line break").click();
    await page.keyboard.type("x");
    await expect(textBlock(page)).toContainText("x");

    await undo(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello!", type: "text" }, { type: "hardBreak" }]);
    await undo(page);
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

    await undo(page);

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

    await undo(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        {
          marks: [{ attrs: { href: "https://example.com" }, type: "link" }],
          text: "Hello",
          type: "text",
        },
      ]);

    await undo(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello", type: "text" }]);
  });
});

test.describe("copy and paste", () => {
  test("formatted text keeps its formatting within a Block", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await page.keyboard.press("Shift+ArrowLeft");
    await page.keyboard.press("Shift+ArrowLeft");
    await waitForSelectionToRegister(page);
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.press("ControlOrMeta+c");
    await pressArrow(page, "ArrowRight");

    await page.keyboard.press("ControlOrMeta+v");

    await expect(textBlock(page)).toHaveText("Hellolo");
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "Hel", type: "text" },
        { marks: [{ type: "bold" }], text: "lolo", type: "text" },
      ]);
  });

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

  test("a link keeps its URL between Blocks", async ({ page }) => {
    await addSecondTextBlock(page);
    await expect(secondTextBlock(page)).toHaveText("Hello");
    await selectAllInBlock(page);
    await addLink(page, "{{cta_url}}");
    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.press("ControlOrMeta+c");

    await secondTextBlock(page).click();
    await expect(secondTextBlock(page)).toBeFocused();
    await selectAll(page);
    await page.keyboard.press("ControlOrMeta+v");

    await expect
      .poll(() => savedInline(page, 1))
      .toStrictEqual([
        {
          marks: [{ attrs: { href: "{{cta_url}}" }, type: "link" }],
          text: "Hello",
          type: "text",
        },
      ]);
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

    await expect(textBlock(page)).toContainText("Title");
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
