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
    // A different document, so the element has an update waiting when it leaves.
    const different = mailQuilt.value;
    if (different) {
      different.settings.width = 500;
    }
    mailQuilt.value = different;
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

const setValue = (page: Page, document: unknown) =>
  canvas(page).evaluate((element, value) => {
    (element as MailQuilt).value = value as MailQuilt["value"];
  }, document);

const currentValue = (page: Page) =>
  canvas(page).evaluate((element) => (element as MailQuilt).value);

const reverseKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(reverseKeys);
  }
  return typeof value === "object" && value !== null
    ? Object.fromEntries(
        Object.entries(value)
          // oxlint-disable-next-line unicorn/no-array-reverse -- This package's ES2022 lib has no toReversed, and these entries are a new array.
          .reverse()
          .map(([key, item]) => [key, reverseKeys(item)])
      )
    : value;
};

const withText = (document: unknown, text: string) => {
  // oxlint-disable-next-line typescript/no-explicit-any -- Saved JSON, reached along a path this test's email is known to have.
  const copy = structuredClone(document) as any;
  copy.rows[0].columns[0].blocks[0].props.content.content[0].content[0].text =
    text;
  return copy;
};

/** Sets `value` and returns the reasons from any `mq-error` that follows. */
const setValueAndCollectErrors = (page: Page, document: unknown) =>
  canvas(page).evaluate(async (element, value) => {
    const mailQuilt = element as MailQuilt;
    const reasons: string[] = [];
    const onError = (event: HTMLElementEventMap["mq-error"]) => {
      reasons.push(event.detail.reason);
    };
    mailQuilt.addEventListener("mq-error", onError);
    mailQuilt.value = value as MailQuilt["value"];
    await mailQuilt.updateComplete;
    mailQuilt.removeEventListener("mq-error", onError);
    return reasons;
  }, document);

test.describe("setting value", () => {
  test("a clone of the last document sent out keeps undo and the cursor", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("ab");
    await expect(page.getByTestId("change-count")).toHaveText("2");

    await setValue(
      page,
      JSON.parse(
        (await page.getByTestId("latest-document").textContent()) ?? ""
      )
    );

    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("c");
    await expect(textBlock(page)).toHaveText("abcHello");
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("the same content with its keys in another order keeps undo and the cursor", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("ab");
    await expect(textBlock(page)).toHaveText("abHello");

    await setValue(page, reverseKeys(await currentValue(page)));

    await page.keyboard.type("c");
    await expect(textBlock(page)).toHaveText("abcHello");
    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("a clone of the document just loaded keeps the cursor", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);

    await setValue(page, await currentValue(page));

    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("a");
    await expect(textBlock(page)).toHaveText("aHello");
  });

  test("a different document loads and clears undo history", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("ab");
    await expect(page.getByTestId("change-count")).toHaveText("2");

    await setValue(page, withText(await currentValue(page), "Another email"));
    await expect(textBlock(page)).toHaveText("Another email");

    await focusStartOfTextBlock(page);
    await undo(page);
    await expect(textBlock(page)).toHaveText("Another email");
    await redo(page);
    await expect(textBlock(page)).toHaveText("Another email");
    // Loading isn't a change, so a host's auto-save has nothing to overwrite.
    await expect(page.getByTestId("change-count")).toHaveText("2");
  });

  test("a document the host changed after it was sent out loads", async ({
    page,
  }) => {
    await canvas(page).evaluate((element) => {
      const mailQuilt = element as MailQuilt;
      mailQuilt.addEventListener("mq-change", ({ detail: { document } }) => {
        const block = document.rows[0]?.columns[0]?.blocks[0];
        if (block) {
          block.props.content = {
            content: [
              {
                content: [{ text: "Host's own text", type: "text" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          };
        }
        mailQuilt.value = document;
      });
    });
    await focusStartOfTextBlock(page);

    await page.keyboard.type("a");

    await expect(textBlock(page)).toHaveText("Host's own text");
  });

  test("clearing value empties the canvas, and a document loads again after", async ({
    page,
  }) => {
    const saved = await currentValue(page);

    await canvas(page).evaluate((element) => {
      (element as MailQuilt).value = undefined;
    });
    await expect(textBlock(page)).toHaveCount(0);

    await setValue(page, saved);
    await expect(textBlock(page)).toHaveText("Hello");
  });
});

test.describe("refusing a document", () => {
  // oxlint-disable-next-line typescript/no-explicit-any -- These damage documents on purpose, which the real type forbids.
  const refused: [string, (email: any) => unknown, RegExp][] = [
    ["a malformed document", ({ rows: _rows, ...email }) => email, /rows/u],
    ["a value that isn't a document", () => null, /object/iu],
    [
      "an unknown Block type",
      (email) => {
        email.rows[0].columns[0].blocks[0].type = "hologram";
        return email;
      },
      /unknown type "hologram"/u,
    ],
    [
      "a newer version",
      (email) => ({ ...email, version: 2 }),
      /version 2 is newer/iu,
    ],
  ];

  for (const [name, damage, reason] of refused) {
    test(`${name} fires mq-error and leaves the email as it was`, async ({
      page,
    }) => {
      await focusStartOfTextBlock(page);
      await page.keyboard.type("ab");
      await expect(page.getByTestId("change-count")).toHaveText("2");
      const before = await canvas(page).evaluate(
        (element) => (element as MailQuilt).value
      );

      const reasons = await setValueAndCollectErrors(
        page,
        damage(structuredClone(before))
      );

      expect(reasons).toStrictEqual([expect.stringMatching(reason)]);
      await expect(textBlock(page)).toHaveText("abHello");
      expect(
        await canvas(page).evaluate((element) => (element as MailQuilt).value)
      ).toStrictEqual(before);
      expect(await exportHtml(page)).toContain("abHello");
      await expect(page.getByTestId("change-count")).toHaveText("2");

      // The email is still the same one, with its cursor and undo history.
      await expect(textBlock(page)).toBeFocused();
      await page.keyboard.type("c");
      await expect(textBlock(page)).toHaveText("abcHello");
      await undo(page);
      await expect(textBlock(page)).toHaveText("Hello");
    });
  }

  test("doesn't change the refused document", async ({ page }) => {
    const unchanged = await canvas(page).evaluate(async (element) => {
      const mailQuilt = element as MailQuilt;
      const damaged = { ...mailQuilt.value, extra: "keep me", version: 2 };
      const before = JSON.stringify(damaged);
      mailQuilt.value = damaged as unknown as MailQuilt["value"];
      await mailQuilt.updateComplete;
      return JSON.stringify(damaged) === before;
    });

    expect(unchanged).toBeTruthy();
  });

  test("mq-error reaches a listener added just after setting value", async ({
    page,
  }) => {
    const reason = await page.evaluate(
      () =>
        // oxlint-disable-next-line promise/avoid-new -- Events have no promise form.
        new Promise((resolve) => {
          const element = document.createElement("mail-quilt");
          element.value = { version: 2 } as unknown as MailQuilt["value"];
          // Outside the element, as a host's page-level handler would be.
          document.addEventListener("mq-error", (event) => {
            resolve((event as HTMLElementEventMap["mq-error"]).detail.reason);
          });
          document.body.append(element);
        })
    );

    expect(reason).toMatch(/version 2 is newer/iu);
  });

  test("a refused first document leaves nothing to edit or export", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const element = document.createElement("mail-quilt");
      element.value = { version: 2 } as unknown as MailQuilt["value"];
      document.body.append(element);
      await element.updateComplete;
      return {
        editors:
          element.shadowRoot?.querySelectorAll("[contenteditable]").length,
        value: element.value ?? null,
      };
    });

    expect(result).toStrictEqual({ editors: 0, value: null });
  });
});
