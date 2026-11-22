import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  addSecondTextBlock,
  canvas,
  changeCount,
  copySelection,
  formatButton,
  hostEvents,
  latestDocument,
  linkUrlField,
  openTestPage,
  pasteHtml,
  pasteText,
  redoByKey,
  settle,
  stopClock,
  test,
  textBlock,
  tooltip,
  undo,
  undoByKey,
} from "./helpers.js";

const selectAll = (page: Page) => page.keyboard.press("ControlOrMeta+a");

interface SavedParagraph {
  content?: { marks?: { type: string }[]; text?: string; type: string }[];
  type: string;
}

/** The saved content of the Block at `index`, as the host last received it. */
const savedParagraphs = async (page: Page, index = 0) => {
  const { rows } = await latestDocument(page);
  // A Block added by setting `value` is missing until the next mq-change.
  const props = rows[0]?.columns[0]?.blocks[index]?.props as
    | { content: { content: SavedParagraph[] } }
    | undefined;
  return props?.content.content;
};

interface SavedNode {
  content?: SavedNode[];
  text?: string;
  type: string;
}

/** A paragraph's text, with each line break as a new line. */
const textOf = (paragraph: SavedNode | undefined) =>
  (paragraph?.content ?? [])
    .map(({ text, type }) => (type === "hardBreak" ? "\n" : (text ?? "")))
    .join("");

/**
 * The saved text of the first Block: each paragraph's text, and each List as
 * its type and its items' text.
 */
const savedOutline = async (page: Page) => {
  const nodes = (await savedParagraphs(page)) as SavedNode[] | undefined;
  return nodes?.map((node) =>
    node.type === "paragraph"
      ? textOf(node)
      : {
          [node.type]: (node.content ?? []).map((item) =>
            textOf(item.content?.[0])
          ),
        }
  );
};

const savedInline = async (page: Page, index = 0) => {
  const paragraphs = await savedParagraphs(page, index);
  return paragraphs?.[0]?.content;
};

const selectAllInBlock = async (page: Page) => {
  await textBlock(page).first().click();
  await expect(textBlock(page).first()).toBeFocused();
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

const extendSelection = async (page: Page, key: "ArrowLeft" | "ArrowRight") => {
  await page.keyboard.press(`Shift+${key}`);
  await settle(page);
};

const addLink = async (page: Page, href: string) => {
  // "Edit link" when the text is in a link already.
  await formatButton(page, "Link").or(formatButton(page, "Edit link")).click();
  await linkUrlField(page).fill(href);
  await page.keyboard.press("Enter");
};

test.beforeEach(async ({ page }) => {
  await openTestPage(page);
});

test("from all the text selected, ← and → go to its start and end", async ({
  page,
}) => {
  await selectAllInBlock(page);
  await pressArrow(page, "ArrowLeft");
  await page.keyboard.type("x");
  await expect(textBlock(page).first()).toHaveText("xHello");

  await selectAll(page);
  await pressArrow(page, "ArrowRight");
  await page.keyboard.type("y");
  await expect(textBlock(page).first()).toHaveText("xHelloy");
});

test.describe("bold, italic and underline", () => {
  test("Ctrl/⌘+U underlines the text", async ({ page }) => {
    await selectAllInBlock(page);

    await page.keyboard.press("ControlOrMeta+u");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "underline" }], text: "Hello", type: "text" },
      ]);
  });

  // Or the browser formats the text itself on Windows and Linux.
  test("Shift with the shortcut formats too", async ({ page }) => {
    await selectAllInBlock(page);

    await page.keyboard.press("ControlOrMeta+Shift+i");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "italic" }], text: "Hello", type: "text" },
      ]);
  });

  test("the toolbar shows the formatting at the cursor", async ({ page }) => {
    await selectAllInBlock(page);
    await page.keyboard.press("ControlOrMeta+b");
    await pressArrow(page, "ArrowRight");
    const bold = formatButton(page, "Bold");
    await expect(bold).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("ControlOrMeta+b");
    await expect(bold).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.type("xy");
    await expect(bold).toHaveAttribute("aria-pressed", "false");

    await pressArrow(page, "ArrowLeft");
    await pressArrow(page, "ArrowLeft");
    await pressArrow(page, "ArrowLeft");
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await expect(formatButton(page, "Italic")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });
});

const mergeTag = (name: string, marks?: { type: string }[]) => ({
  attrs: { name },
  ...(marks ? { marks } : {}),
  type: "mergeTag",
});
const shownTag = (page: Page) =>
  textBlock(page).first().locator("[data-merge-tag]");

test.describe("Merge Tags", () => {
  test("typing }} that closes a tag makes it one unit, which Backspace removes whole", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await page.keyboard.type("Hi {{first_name}}");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hi ", type: "text" }, mergeTag("first_name")]);

    await page.keyboard.press("Backspace");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hi ", type: "text" }]);
  });

  test("the cursor steps over a tag, and Delete removes it whole", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await page.keyboard.type("{{a}}b");
    await pressArrow(page, "ArrowLeft");
    await pressArrow(page, "ArrowLeft");
    await page.keyboard.type("x");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "x", type: "text" },
        mergeTag("a"),
        { text: "b", type: "text" },
      ]);

    await page.keyboard.press("Delete");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "xb", type: "text" }]);
  });

  test("a tag typed with an input method becomes one unit once it's composed", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== "chromium", "Only Chromium composes from a test");
    await selectAllInBlock(page);
    const devTools = await page.context().newCDPSession(page);

    await devTools.send("Input.imeSetComposition", {
      selectionEnd: 5,
      selectionStart: 5,
      text: "{{a}}",
    });
    await settle(page);
    // Changing the text being composed would break the input method.
    await expect(shownTag(page)).toHaveCount(0);

    await devTools.send("Input.insertText", { text: "{{a}}" });

    await expect.poll(() => savedInline(page)).toStrictEqual([mergeTag("a")]);
  });

  test("pasted text makes each tag in it one unit", async ({ page }) => {
    await selectAllInBlock(page);

    await pasteText(textBlock(page).first(), "{{a}} and {{ b }}");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        mergeTag("a"),
        { text: " and ", type: "text" },
        mergeTag(" b "),
      ]);
  });

  test("formatting puts the mark on the whole tag", async ({ page }) => {
    await selectAllInBlock(page);
    await page.keyboard.type("Hi {{first_name}}");
    await extendSelection(page, "ArrowLeft");

    await page.keyboard.press("ControlOrMeta+b");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { text: "Hi ", type: "text" },
        mergeTag("first_name", [{ type: "bold" }]),
      ]);
  });

  test("a tag is read, shown in its tooltip and copied as {{name}}", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await page.keyboard.type("Hi {{first_name}}");

    await expect(shownTag(page)).toHaveText("{{first_name}}");
    await expect(textBlock(page).first()).toMatchAriaSnapshot(
      `
      - textbox "Text Block":
        - paragraph: "Hi {{first_name}}"
      `
    );

    await shownTag(page).hover();
    await expect(tooltip(page)).toHaveText("{{first_name}}");

    await selectAll(page);
    await expect(copySelection(textBlock(page).first())).resolves.toMatchObject(
      { text: "Hi {{first_name}}" }
    );
  });
});

test.describe("the toolbar", () => {
  test("keeps the selection and focus in the Block", async ({ page }) => {
    await selectAllInBlock(page);

    await formatButton(page, "Bold").click();
    await expect(textBlock(page).first()).toBeFocused();
    await formatButton(page, "Italic").click();
    await expect(textBlock(page).first()).toBeFocused();

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
    await expect(textBlock(page).first()).toHaveText("x");
  });

  test("its Bold button names its shortcut", async ({ page }) => {
    await selectAllInBlock(page);
    const mod = process.platform === "darwin" ? "Meta" : "Control";

    await expect(formatButton(page, "Bold")).toHaveAttribute(
      "aria-keyshortcuts",
      `${mod}+B`
    );
  });

  test("by keyboard with only a cursor, typing continues where it was, formatted", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await formatButton(page, "Bold").focus();

    await page.keyboard.press("Enter");

    await expect(textBlock(page).first()).toBeFocused();
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
    await expect(textBlock(page).nth(1)).toHaveText("Hello");
    await textBlock(page).nth(1).click();
    await expect(textBlock(page).nth(1)).toBeFocused();
    await selectAll(page);

    await formatButton(page, "Bold").click();

    await expect(textBlock(page).nth(1)).toBeFocused();
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
});

/** Makes "Hello" a bulleted List's one item, with the cursor at its end. */
const helloAsList = async (page: Page) => {
  await cursorAtEndOfBlock(page);
  await formatButton(page, "Bulleted list").click();
  await expect
    .poll(() => savedOutline(page))
    .toStrictEqual([{ bulletList: ["Hello"] }]);
};

test.describe("Lists", () => {
  test("Enter starts a new item, and on an empty one leaves the List", async ({
    page,
  }) => {
    await helloAsList(page);

    await page.keyboard.press("Enter");
    await page.keyboard.type("x");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("y");

    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ bulletList: ["Hello", "x"] }, "y"]);
  });

  test("Shift+Enter in an item adds a line break", async ({ page }) => {
    await helloAsList(page);

    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("x");

    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ bulletList: ["Hello\nx"] }]);
  });

  test("Tab in an item moves focus on, and leaves the List as it is", async ({
    page,
  }) => {
    await helloAsList(page);

    await page.keyboard.press("Tab");

    await expect(textBlock(page).first()).not.toBeFocused();
    expect(await savedOutline(page)).toStrictEqual([{ bulletList: ["Hello"] }]);
  });

  test("Backspace at the start of an item makes it a paragraph, and again joins it to the item above", async ({
    page,
  }) => {
    await helloAsList(page);
    await page.keyboard.press("Enter");
    await page.keyboard.type("x");
    await pressArrow(page, "ArrowLeft");

    await page.keyboard.press("Backspace");
    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ bulletList: ["Hello"] }, "x"]);

    await page.keyboard.press("Backspace");
    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ bulletList: ["Hellox"] }]);
  });

  test("Delete at the end of the last item pulls in the paragraph after the List", async ({
    page,
  }) => {
    await helloAsList(page);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("x");
    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ bulletList: ["Hello"] }, "x"]);
    await pressArrow(page, "ArrowLeft");
    await pressArrow(page, "ArrowLeft");

    await page.keyboard.press("Delete");

    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ bulletList: ["Hellox"] }]);
  });

  test("Shift+Ctrl/⌘+8 and 7 turn each kind on, switch between them and turn them off, on any layout, and typing a List's marker makes none", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await page.keyboard.press("Enter");
    await page.keyboard.type("- a");
    await page.keyboard.press("Enter");
    await page.keyboard.type("1. b");
    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual(["Hello", "- a", "1. b"]);
    await selectAll(page);

    await page.keyboard.press("ControlOrMeta+Shift+8");
    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ bulletList: ["Hello", "- a", "1. b"] }]);
    await page.keyboard.press("ControlOrMeta+Shift+7");
    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ orderedList: ["Hello", "- a", "1. b"] }]);
    await page.keyboard.press("ControlOrMeta+Shift+7");
    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual(["Hello", "- a", "1. b"]);

    // As on a German layout, where Shift+8 types "(".
    await textBlock(page)
      .first()
      .evaluate((text) => {
        const apple = /Mac|iPhone|iPod|iPad/u.test(navigator.platform);
        const event = new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          code: "Digit8",
          ctrlKey: !apple,
          key: "(",
          metaKey: apple,
          shiftKey: true,
        });
        Object.defineProperty(event, "keyCode", { value: 56 });
        text.dispatchEvent(event);
      });
    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ bulletList: ["Hello", "- a", "1. b"] }]);
  });

  test("the format bar's buttons show which List the text is in, and switch it", async ({
    page,
  }) => {
    await helloAsList(page);
    await expect(formatButton(page, "Bulleted list")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(formatButton(page, "Numbered list")).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    await formatButton(page, "Numbered list").click();

    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ orderedList: ["Hello"] }]);
    await expect(formatButton(page, "Numbered list")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(formatButton(page, "Bulleted list")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect(textBlock(page).first()).toBeFocused();
  });

  test("a pasted List comes in as a List, one level deep", async ({ page }) => {
    await selectAllInBlock(page);

    await pasteHtml(
      textBlock(page).first(),
      "<ol><li>one<ul><li>inner</li></ul></li><li>two</li></ol>"
    );

    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ orderedList: ["one", "inner", "two"] }]);
  });
});

test.describe("links", () => {
  test("applying a link returns focus and the selection to the Block", async ({
    page,
  }) => {
    await selectAllInBlock(page);

    await addLink(page, "https://example.com");

    await expect(linkUrlField(page)).toBeHidden();
    await expect(textBlock(page).first()).toBeFocused();
    await page.keyboard.type("x");
    await expect(textBlock(page).first()).toHaveText("x");
  });

  test("refuses javascript:alert(1) and says why", async ({ page }) => {
    await selectAllInBlock(page);

    // oxlint-disable-next-line eslint/no-script-url -- This is what the test refuses.
    await addLink(page, "javascript:alert(1)");

    await expect(page.getByRole("alert")).toContainText("Merge Tag");
    await expect(linkUrlField(page)).toBeVisible();
    await expect(linkUrlField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(linkUrlField(page)).toHaveAccessibleDescription(/Merge Tag/u);
    expect(await savedInline(page)).toStrictEqual([
      { text: "Hello", type: "text" },
    ]);

    // The same reason again is a new alert, so it's read out again.
    await page.getByRole("alert").evaluate((element) => {
      element.dataset.seen = "true";
    });
    await linkUrlField(page).press("Enter");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).not.toHaveAttribute("data-seen");
  });

  test("spaces around a pasted URL are ignored", async ({ page }) => {
    await selectAllInBlock(page);
    await formatButton(page, "Link").click();
    await linkUrlField(page).fill("  https://example.com ");

    await formatButton(page, "Apply").click();

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
    await formatButton(page, "Link").click();
    await linkUrlField(page).fill("https://example.com");

    await page.keyboard.press("Escape");

    await expect(linkUrlField(page)).toBeHidden();
    await expect(textBlock(page).first()).toBeFocused();
    expect(await savedInline(page)).toStrictEqual([
      { text: "Hello", type: "text" },
    ]);

    // Cancel does the same.
    await formatButton(page, "Link").click();
    await linkUrlField(page).fill("https://example.com");
    await formatButton(page, "Cancel").click();

    await expect(linkUrlField(page)).toBeHidden();
    await expect(textBlock(page).first()).toBeFocused();
    expect(await savedInline(page)).toStrictEqual([
      { text: "Hello", type: "text" },
    ]);
    await page.keyboard.type("x");
    await expect(textBlock(page).first()).toHaveText("x");
  });

  test("moving the element closes the field, because its selection is gone", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await formatButton(page, "Link").click();
    await expect(linkUrlField(page)).toBeFocused();

    await canvas(page).evaluate((element) => {
      const parent = element.parentElement;
      element.remove();
      parent?.append(element);
    });

    await expect(textBlock(page).first()).toHaveText("Hello");
    await expect(linkUrlField(page)).toBeHidden();
    await expect(formatButton(page, "Bold")).toHaveCount(0);
  });

  test("clicking back into the Block closes the field", async ({ page }) => {
    await selectAllInBlock(page);
    await formatButton(page, "Link").click();
    await expect(linkUrlField(page)).toBeFocused();

    await textBlock(page).first().click();

    await expect(linkUrlField(page)).toBeHidden();
  });

  test.describe("with a link already there", () => {
    test.beforeEach(async ({ page }) => {
      await selectAllInBlock(page);
      await addLink(page, "https://example.com");
      await expect(textBlock(page).first()).toBeFocused();
      await expect(formatButton(page, "Edit link")).toBeVisible();
    });

    test("the field shows its URL, and changing it changes the whole link and keeps the cursor", async ({
      page,
    }) => {
      // A cursor in the middle of the link, with no selection.
      await pressArrow(page, "ArrowLeft");
      await pressArrow(page, "ArrowRight");
      await pressArrow(page, "ArrowRight");
      await expect(formatButton(page, "Edit link")).toBeVisible();

      await formatButton(page, "Edit link").click();
      await expect(formatButton(page, "Edit link")).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      await expect(linkUrlField(page)).toHaveValue("https://example.com");
      await linkUrlField(page).fill("https://example.org");
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
      // With only a cursor, the cursor stays where it was.
      await expect(textBlock(page).first()).toBeFocused();
      await page.keyboard.type("x");
      await expect(textBlock(page).first()).toHaveText("Hexllo");
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

      await formatButton(page, "Edit link").click();
      await page.getByRole("button", { name: "Remove link" }).click();

      await expect
        .poll(() => savedInline(page))
        .toStrictEqual([
          { marks: [{ type: "bold" }], text: "He", type: "text" },
          { text: "llo", type: "text" },
        ]);
    });

    test("clicking it puts the cursor in it, and a page's router doesn't follow it", async ({
      page,
    }) => {
      // From outside the editor, as when the text isn't being edited.
      await page.mouse.click(5, 5);
      // A router follows a link click that no one has handled.
      const clicks = await hostEvents(page, "click", ["defaultPrevented"]);

      await textBlock(page).first().getByRole("link").click();

      expect(await clicks()).toStrictEqual([{ defaultPrevented: true }]);
      await expect(formatButton(page, "Edit link")).toBeVisible();
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
  });
});

test.describe("undo and redo", () => {
  test("a formatting change is one undo step, and keeps the selection", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await formatButton(page, "Bold").click();
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "bold" }], text: "Hello", type: "text" },
      ]);

    await undoByKey(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello", type: "text" }]);
    await expect(formatButton(page, "Bold")).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    await redoByKey(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([
        { marks: [{ type: "bold" }], text: "Hello", type: "text" },
      ]);
    await expect(formatButton(page, "Bold")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.keyboard.type("x");
    await expect(textBlock(page).first()).toHaveText("x");
  });

  test("undoing a text edit of the same length still moves the cursor to it", async ({
    page,
  }) => {
    await selectAllInBlock(page);
    await pressArrow(page, "ArrowLeft");
    await page.keyboard.press("Shift+ArrowRight");
    await settle(page);
    await page.keyboard.type("x");
    await expect(textBlock(page).first()).toHaveText("xello");
    await selectAll(page);
    await pressArrow(page, "ArrowRight");

    await undoByKey(page);
    await expect(textBlock(page).first()).toHaveText("Hello");
    await page.keyboard.type("!");

    await expect(textBlock(page).first()).toHaveText("H!ello");
  });

  test("a line break from the format bar doesn't merge with the typing before it", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await page.keyboard.type("!");
    await formatButton(page, "Line break").click();
    await page.keyboard.type("x");
    await expect(textBlock(page).first()).toContainText("x");

    await undoByKey(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello!", type: "text" }, { type: "hardBreak" }]);
    await undoByKey(page);
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello!", type: "text" }]);
  });

  test("turning a List on doesn't merge with the typing before or after it", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await page.keyboard.type("!");
    await formatButton(page, "Bulleted list").click();
    await page.keyboard.type("x");
    await expect(textBlock(page).first()).toContainText("x");

    await undoByKey(page);
    await expect
      .poll(() => savedOutline(page))
      .toStrictEqual([{ bulletList: ["Hello!"] }]);
    await undoByKey(page);
    await expect.poll(() => savedOutline(page)).toStrictEqual(["Hello!"]);
  });

  test("text typed after turning bold on doesn't merge with the text before it", async ({
    page,
  }) => {
    await cursorAtEndOfBlock(page);
    await stopClock(page);
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

  test("undo in the link field doesn't undo the email", async ({ page }) => {
    await textBlock(page).first().click();
    await page.keyboard.type("x");
    await expect(changeCount(page)).toHaveText("1");
    await formatButton(page, "Link").click();
    await expect(linkUrlField(page)).toBeFocused();
    // Typed, because a filled value leaves nothing for the field's own undo.
    await page.keyboard.type("https");
    await expect(linkUrlField(page)).toHaveValue("https");

    await undoByKey(page);

    await expect(textBlock(page).first()).toHaveText("Hellox");
  });

  test("the Undo button closes the link field and returns to the Block", async ({
    page,
  }) => {
    await textBlock(page).first().click();
    await page.keyboard.type("x");
    await expect(changeCount(page)).toHaveText("1");
    await selectAll(page);
    await formatButton(page, "Link").click();
    const field = linkUrlField(page);
    await expect(field).toBeFocused();

    await undo(page);

    await expect(field).toHaveCount(0);
    await expect(textBlock(page).first()).toHaveText("Hello");
    await expect(textBlock(page).first()).toBeFocused();
  });

  test("adding and removing a link can each be undone", async ({ page }) => {
    await selectAllInBlock(page);
    await addLink(page, "https://example.com");
    await expect(textBlock(page).first()).toBeFocused();
    await formatButton(page, "Edit link").click();
    await page.getByRole("button", { name: "Remove link" }).click();
    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Hello", type: "text" }]);
    await expect(linkUrlField(page)).toBeHidden();
    await expect(textBlock(page).first()).toBeFocused();

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
    await expect(textBlock(page).nth(1)).toHaveText("Hello");
    await selectAllInBlock(page);
    await page.keyboard.press("ControlOrMeta+b");
    const { html } = await copySelection(textBlock(page).first());

    await textBlock(page).nth(1).click();
    await expect(textBlock(page).nth(1)).toBeFocused();
    await selectAll(page);
    await pasteHtml(textBlock(page).nth(1), html);

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
      textBlock(page).first(),
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

    const { text } = await copySelection(textBlock(page).first());
    expect(text).toBe("Hello\nA\n\nB");
  });

  test("pasted content is reduced to the allowed formatting", async ({
    page,
  }) => {
    await selectAllInBlock(page);

    await pasteHtml(
      textBlock(page).first(),
      `<h1 style="color:red">Title</h1>
       <p style="font-size:40px"><b>bold</b> <i>italic</i> <u>under</u>
         <s>struck</s> <span style="color:red">red</span>
         <img src="x" onerror="window.pasteRan = true"><br><code>code</code></p>
       <table><tr><td>cell</td></tr></table>
       <script>window.pasteRan = true</script>`
    );

    // The host shows the saved email a render after the canvas has it.
    await expect(page.getByTestId("latest-document")).toContainText("Title");
    const paragraphs = (await savedParagraphs(page)) ?? [];
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
    const text = await textBlock(page).first().textContent();
    expect(text).toContain("struck");
    expect(text).toContain("cell");
    expect(text).not.toContain("pasteRan");
    await expect(textBlock(page).first().locator("img")).toHaveCount(0);
    // An image the page makes now fails to load after one the paste would have
    // made, so the pasted one's error would have run by then.
    await page.evaluate(
      () =>
        // oxlint-disable-next-line promise/avoid-new -- An image's error has no promise form.
        new Promise((resolve) => {
          const image = new Image();
          image.addEventListener("error", resolve);
          image.src = "x";
        })
    );
    expect(await page.evaluate(() => Reflect.get(window, "pasteRan"))).toBe(
      undefined
    );
  });

  // A tab would show at a tab stop on the canvas, which no email client can
  // draw, and as one space in the export.
  test("a pasted tab is a space, as the export shows it", async ({ page }) => {
    await selectAllInBlock(page);
    await pasteText(textBlock(page).first(), "Name\tEmail");

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Name Email", type: "text" }]);

    await selectAll(page);
    await pasteHtml(
      textBlock(page).first(),
      `<div style="white-space:pre">\tcode</div>`
    );

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: " code", type: "text" }]);
  });

  test("a pasted executable link keeps its text but not the link", async ({
    page,
  }) => {
    await selectAllInBlock(page);

    await pasteHtml(
      textBlock(page).first(),
      `<a href="javascript:alert(1)">Click</a>`
    );

    await expect
      .poll(() => savedInline(page))
      .toStrictEqual([{ text: "Click", type: "text" }]);
    await expect(textBlock(page).first().locator("a")).toHaveCount(0);
  });

  test("a pasted link keeps only its URL", async ({ page }) => {
    await selectAllInBlock(page);

    await pasteHtml(
      textBlock(page).first(),
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
