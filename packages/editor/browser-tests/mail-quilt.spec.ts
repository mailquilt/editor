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

const undo = (page: Page) => page.keyboard.press("ControlOrMeta+z");
const redo = (page: Page) => page.keyboard.press("ControlOrMeta+Shift+z");

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

test.describe("undo and redo while typing", () => {
  test("undo removes a burst of typing as one step", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("abc");
    await expect(page.getByTestId("change-count")).toHaveText("3");

    await undo(page);

    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("redo restores what undo removed", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("abc");
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");

    await redo(page);

    await expect(textBlock(page)).toHaveText("abcHello");
  });

  test("Control+Y also redoes", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("abc");
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");

    await page.keyboard.press("Control+y");

    await expect(textBlock(page)).toHaveText("abcHello");
  });

  test("undo and redo fire mq-change with the new document", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("abc");
    await expect(page.getByTestId("change-count")).toHaveText("3");

    await undo(page);
    await expect(page.getByTestId("change-count")).toHaveText("4");
    await expect.poll(() => latestDocumentText(page)).toBe("Hello");

    await redo(page);
    await expect(page.getByTestId("change-count")).toHaveText("5");
    await expect.poll(() => latestDocumentText(page)).toBe("abcHello");
  });

  test("undo with nothing to undo changes nothing", async ({ page }) => {
    await focusStartOfTextBlock(page);

    await undo(page);
    await redo(page);

    await expect(textBlock(page)).toHaveText("Hello");
    await expect(page.getByTestId("change-count")).toHaveText("0");
  });

  test("a pause in typing starts a new undo step", async ({ page }) => {
    await page.clock.install();
    await page.reload();
    await focusStartOfTextBlock(page);
    await page.keyboard.type("ab");
    await expect(textBlock(page)).toHaveText("abHello");

    await page.clock.fastForward(1500);
    await page.keyboard.type("cd");
    await expect(textBlock(page)).toHaveText("abcdHello");

    await undo(page);
    await expect(textBlock(page)).toHaveText("abHello");
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("edits in different Blocks share one history", async ({ page }) => {
    await addSecondTextBlock(page);
    const first = textBlock(page).first();
    const second = textBlock(page).last();
    await first.click();
    await page.keyboard.type("a");
    await expect(first).toHaveText("Helloa");
    await second.click();
    await page.keyboard.type("b");
    await expect(second).toHaveText("Hellob");
    await first.click();
    await page.keyboard.type("c");
    await expect(first).toHaveText("Helloac");

    await undo(page);
    await expect(first).toHaveText("Helloa");
    await undo(page);
    await expect(second).toHaveText("Hello");
    await expect(first).toHaveText("Helloa");
    await undo(page);
    await expect(first).toHaveText("Hello");
  });

  test("leaving a Block and coming back starts a new undo step", async ({
    page,
  }) => {
    await addSecondTextBlock(page);
    const first = textBlock(page).first();
    const second = textBlock(page).last();
    await first.click();
    await page.keyboard.type("a");
    await expect(first).toHaveText("Helloa");

    await second.click();
    await expect(second).toBeFocused();
    await first.click();
    await expect(first).toBeFocused();
    await page.keyboard.type("b");
    await expect(first).toHaveText("Helloab");

    await undo(page);
    await expect(first).toHaveText("Helloa");
  });

  test("typing after undo goes where the undone text was, as a new step", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("abc");
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");

    await page.keyboard.type("x");
    await expect(textBlock(page)).toHaveText("xHello");

    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("typing after redo continues after the restored text", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("abc");
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");
    await redo(page);
    await expect(textBlock(page)).toHaveText("abcHello");

    await page.keyboard.type("d");

    await expect(textBlock(page)).toHaveText("abcdHello");
  });

  test("undo keeps focus in the Block", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("abc");

    await undo(page);

    await expect(textBlock(page)).toHaveText("Hello");
    await expect(textBlock(page)).toBeFocused();
  });

  test("undo puts the cursor back between repeated letters", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("l");
    await expect(textBlock(page)).toHaveText("Helllo");

    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");
    await page.keyboard.type("x");

    await expect(textBlock(page)).toHaveText("Helxlo");
  });

  test("redo puts the cursor back between repeated letters", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("l");
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");

    await redo(page);
    await expect(textBlock(page)).toHaveText("Helllo");
    await page.keyboard.type("x");

    await expect(textBlock(page)).toHaveText("Hellxlo");
  });

  test("redoing a new paragraph leaves the cursor in that text", async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") {
        warnings.push(message.text());
      }
    });
    await focusStartOfTextBlock(page);
    await page.keyboard.press("Enter");
    await expect(textBlock(page).locator("p")).toHaveCount(2);
    await undo(page);
    await expect(textBlock(page).locator("p")).toHaveCount(1);

    await redo(page);
    await expect(textBlock(page).locator("p")).toHaveCount(2);
    await page.keyboard.type("x");

    await expect(textBlock(page).locator("p").last()).toHaveText("xHello");
    expect(warnings).toStrictEqual([]);
  });

  test("the browser's own undo and redo commands use the same history", async ({
    page,
  }) => {
    const sendHistoryCommand = (inputType: string) =>
      textBlock(page).evaluate((element, type) => {
        element.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: type,
          })
        );
      }, inputType);
    await focusStartOfTextBlock(page);
    await page.keyboard.type("abc");
    await expect(textBlock(page)).toHaveText("abcHello");

    await sendHistoryCommand("historyUndo");
    await expect(textBlock(page)).toHaveText("Hello");
    await expect(page.getByTestId("change-count")).toHaveText("4");

    await sendHistoryCommand("historyRedo");
    await expect(textBlock(page)).toHaveText("abcHello");
    await expect(page.getByTestId("change-count")).toHaveText("5");
  });

  test("undo and redo work on a keyboard layout without Latin letters", async ({
    page,
  }) => {
    const pressOnRussianLayout = (
      key: string,
      code: string,
      shiftKey: boolean
    ) =>
      textBlock(page).evaluate(
        (element, init) => {
          element.dispatchEvent(
            new KeyboardEvent("keydown", {
              bubbles: true,
              cancelable: true,
              composed: true,
              ctrlKey: true,
              ...init,
            })
          );
        },
        { code, key, shiftKey }
      );
    await focusStartOfTextBlock(page);
    await page.keyboard.type("abc");
    await expect(textBlock(page)).toHaveText("abcHello");

    await pressOnRussianLayout("я", "KeyZ", false);
    await expect(textBlock(page)).toHaveText("Hello");

    await pressOnRussianLayout("Я", "KeyZ", true);
    await expect(textBlock(page)).toHaveText("abcHello");
  });

  test("moving the cursor starts a new undo step", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("a");
    await page.keyboard.press("ArrowRight");
    await waitForSelectionToRegister(page);
    await page.keyboard.type("b");
    await expect(textBlock(page)).toHaveText("aHbello");

    await undo(page);

    await expect(textBlock(page)).toHaveText("aHello");
  });

  test("a paste is its own undo step", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+c");
    await page.keyboard.press("ArrowRight");
    await waitForSelectionToRegister(page);
    await page.keyboard.type("x");
    await page.keyboard.press("ControlOrMeta+v");
    await expect(textBlock(page)).toHaveText("HelloxHello");
    await page.keyboard.type("y");
    await expect(textBlock(page)).toHaveText("HelloxHelloy");

    await undo(page);
    await expect(textBlock(page)).toHaveText("HelloxHello");
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hellox");
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("a cut is its own undo step", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+x");
    await expect(textBlock(page)).toHaveText("");
    await page.keyboard.type("y");
    await expect(textBlock(page)).toHaveText("y");

    await undo(page);
    await expect(textBlock(page)).toHaveText("");
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });
});
