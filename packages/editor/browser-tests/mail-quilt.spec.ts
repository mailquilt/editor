import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  addSecondTextBlock,
  boxOf,
  canvas,
  changeCount,
  chooseLayout,
  copySelection,
  currentValue,
  emailWith,
  emailWithLink,
  exportHtml,
  focusStartOfTextBlock,
  latestDocument,
  linkUrlField,
  pasteHtml,
  redo,
  redoByKey,
  settle,
  setValue,
  stopClock,
  textBlock,
  undo,
  undoByKey,
} from "./helpers.js";

/** The text of the first Block, as the host last received it. */
const latestDocumentText = async (page: Page) => {
  const { rows } = await latestDocument(page);
  const props = rows[0]?.columns[0]?.blocks[0]?.props as
    | { content: { content: { content: { text: string }[] }[] } }
    | undefined;
  return props?.content.content[0]?.content[0]?.text;
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");
});

test("typing fires mq-change with the new document", async ({ page }) => {
  await focusStartOfTextBlock(page);

  await page.keyboard.type("Oh ");

  await expect(textBlock(page)).toHaveText("Oh Hello");
  await expect(changeCount(page)).toHaveText("3");
  await expect.poll(() => latestDocumentText(page)).toBe("Oh Hello");
});

test("a value set before the element is defined still opens", async ({
  page,
}) => {
  const html = await page.evaluate(
    async (email) => {
      const late = document.createElement("mail-quilt-late") as MailQuilt;
      late.value = email;
      document.body.append(late);
      const defined = customElements.get("mail-quilt") as typeof MailQuilt;
      customElements.define("mail-quilt-late", class extends defined {});
      return await late.exportHtml();
    },
    emailWith([[["Early"]]])
  );

  expect(html).toContain("Early");
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
  await expect(page.getByRole("main")).toHaveCSS("display", "flex");
  await expect(page.getByRole("button", { name: "Host button" })).toHaveCSS(
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

test("on a right-to-left host page, the editor and the email stay left to right, as the export is", async ({
  page,
}) => {
  await page.evaluate(() =>
    document.documentElement.setAttribute("dir", "rtl")
  );
  await chooseLayout(page, 1, "50/50");

  const columns = canvas(page).getByTestId("column");
  const first = await boxOf(columns.nth(0));
  const second = await boxOf(columns.nth(1));
  expect(first.x).toBeLessThan(second.x);
  const workspace = await boxOf(canvas(page).getByTestId("workspace"));
  const panel = await boxOf(canvas(page).getByTestId("side-panel"));
  expect(workspace.x).toBeLessThan(panel.x);
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

  expect(await exportHtml(page)).toContain("a &nbsp;&nbsp;b Hello");
});

test.describe("undo and redo while typing", () => {
  test("Control+Y also redoes", async ({ page }) => {
    test.skip(process.platform === "darwin", "On a Mac, Ctrl+Y edits the text");
    await focusStartOfTextBlock(page);
    await stopClock(page);
    await page.keyboard.type("abc");
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");

    await page.keyboard.press("Control+y");

    await expect(textBlock(page)).toHaveText("abcHello");
  });

  test("keys the editor acts on don't reach the host page as well", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await stopClock(page);
    await page.keyboard.type("abc");
    await page.evaluate(() => {
      const heard: string[] = [];
      Object.assign(window, { heard });
      document.addEventListener("keydown", ({ key }) => {
        if (key.length === 1) {
          heard.push(key);
        }
      });
    });

    await page.keyboard.press("ControlOrMeta+z");
    await expect(textBlock(page)).toHaveText("Hello");
    await page.keyboard.press("ControlOrMeta+k");
    await expect(linkUrlField(page)).toBeVisible();

    await expect(
      page.evaluate(() => Reflect.get(window, "heard"))
    ).resolves.toEqual([]);
  });

  test.describe("on a Mac", () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, "platform", {
          get: () => "MacIntel",
        });
      });
      await page.goto("/");
      await expect(textBlock(page)).toHaveText("Hello");
    });

    // Ctrl+K and Ctrl+Y delete to the end of the line and put it back.
    test("⌘ makes the shortcuts, and Ctrl+K is left to the text", async ({
      page,
    }) => {
      await focusStartOfTextBlock(page);
      await stopClock(page);
      await page.keyboard.type("abc");
      await page.keyboard.press("Meta+z");
      await expect(textBlock(page)).toHaveText("Hello");
      await page.keyboard.press("Meta+Shift+z");
      await expect(textBlock(page)).toHaveText("abcHello");

      const linkField = linkUrlField(page);
      await page.keyboard.press("Control+k");
      await expect(linkField).toBeHidden();
      await page.keyboard.press("Meta+k");
      await expect(linkField).toBeVisible();
    });

    test("Ctrl+Y doesn't redo", async ({ page }) => {
      test.skip(
        process.platform === "darwin",
        "A real Mac puts back what Ctrl+K deleted"
      );
      await focusStartOfTextBlock(page);
      await stopClock(page);
      await page.keyboard.type("abc");
      await page.keyboard.press("Meta+z");
      await expect(textBlock(page)).toHaveText("Hello");

      await page.keyboard.press("Control+y");
      // After the key, so a redo would show as abcxHello.
      await page.keyboard.type("x");

      await expect(textBlock(page)).toHaveText("xHello");
    });
  });

  test("the Undo and Redo buttons step back and forward", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await stopClock(page);
    await page.keyboard.type("abc");

    await undo(page);
    await expect(textBlock(page)).toHaveText("Hello");
    await redo(page);
    await expect(textBlock(page)).toHaveText("abcHello");
  });

  test("undo and redo fire mq-change with the new document", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await stopClock(page);
    await page.keyboard.type("abc");
    await expect(changeCount(page)).toHaveText("3");

    await undoByKey(page);
    await expect(changeCount(page)).toHaveText("4");
    await expect.poll(() => latestDocumentText(page)).toBe("Hello");

    await redoByKey(page);
    await expect(changeCount(page)).toHaveText("5");
    await expect.poll(() => latestDocumentText(page)).toBe("abcHello");
  });

  test("undo with nothing to undo changes nothing", async ({ page }) => {
    await focusStartOfTextBlock(page);

    await undoByKey(page);
    await redoByKey(page);

    await expect(textBlock(page)).toHaveText("Hello");
    await expect(changeCount(page)).toHaveText("0");
  });

  test("a pause in typing starts a new undo step", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await stopClock(page);
    await page.keyboard.type("ab");
    await expect(textBlock(page)).toHaveText("abHello");

    await page.clock.fastForward(1500);
    await page.keyboard.type("cd");
    await expect(textBlock(page)).toHaveText("abcdHello");

    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("abHello");
    await undoByKey(page);
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

    await undoByKey(page);
    await expect(first).toHaveText("Helloa");
    await undoByKey(page);
    await expect(second).toHaveText("Hello");
    await expect(first).toHaveText("Helloa");
    await undoByKey(page);
    await expect(first).toHaveText("Hello");
  });

  test("leaving a Block and coming back starts a new undo step", async ({
    page,
  }) => {
    await addSecondTextBlock(page);
    await stopClock(page);
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

    await undoByKey(page);
    await expect(first).toHaveText("Helloa");
  });

  test("typing after undo goes where the undone text was, as a new step", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await stopClock(page);
    await page.keyboard.type("abc");
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");

    await page.keyboard.type("x");
    await expect(textBlock(page)).toHaveText("xHello");

    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");
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

    await undoByKey(page);
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
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");

    await redoByKey(page);
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
    await undoByKey(page);
    await expect(textBlock(page).locator("p")).toHaveCount(1);

    await redoByKey(page);
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
    await stopClock(page);
    await page.keyboard.type("abc");
    await expect(textBlock(page)).toHaveText("abcHello");

    await sendHistoryCommand("historyUndo");
    await expect(textBlock(page)).toHaveText("Hello");
    await expect(changeCount(page)).toHaveText("4");

    await sendHistoryCommand("historyRedo");
    await expect(textBlock(page)).toHaveText("abcHello");
    await expect(changeCount(page)).toHaveText("5");
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
              ...init,
            })
          );
        },
        // As Playwright's ControlOrMeta picks it, so as the editor expects.
        process.platform === "darwin"
          ? { code, key, metaKey: true, shiftKey }
          : { code, ctrlKey: true, key, shiftKey }
      );
    await focusStartOfTextBlock(page);
    await stopClock(page);
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
    await settle(page);
    await page.keyboard.type("b");
    await expect(textBlock(page)).toHaveText("aHbello");

    await undoByKey(page);

    await expect(textBlock(page)).toHaveText("aHello");
  });

  test("a paste is its own undo step", async ({ page }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.press("ControlOrMeta+a");
    const { html } = await copySelection(textBlock(page));
    await page.keyboard.press("ArrowRight");
    await settle(page);
    await page.keyboard.type("x");
    await pasteHtml(textBlock(page), html);
    await expect(textBlock(page)).toHaveText("HelloxHello");
    await page.keyboard.type("y");
    await expect(textBlock(page)).toHaveText("HelloxHelloy");

    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("HelloxHello");
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hellox");
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });
});

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
  test("a clone of the document just loaded, or of the last one sent out, keeps undo and the cursor", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await setValue(page, await currentValue(page));
    await expect(textBlock(page)).toBeFocused();
    await stopClock(page);
    await page.keyboard.type("ab");
    await expect(textBlock(page)).toHaveText("abHello");
    await expect(changeCount(page)).toHaveText("2");

    await setValue(page, await latestDocument(page));

    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("c");
    await expect(textBlock(page)).toHaveText("abcHello");
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("a different document loads and clears undo history", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await page.keyboard.type("ab");
    await expect(changeCount(page)).toHaveText("2");

    await setValue(page, withText(await currentValue(page), "Another email"));
    await expect(textBlock(page)).toHaveText("Another email");

    await focusStartOfTextBlock(page);
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Another email");
    await redoByKey(page);
    await expect(textBlock(page)).toHaveText("Another email");
    // Loading isn't a change, so a host's auto-save has nothing to overwrite.
    await expect(changeCount(page)).toHaveText("2");
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

  // Null, as JSON.parse gives for nothing saved.
  test("clearing value empties the canvas with no error, and a document loads again after", async ({
    page,
  }) => {
    const saved = await currentValue(page);

    const reasons = await setValueAndCollectErrors(page, null);
    expect(reasons).toStrictEqual([]);
    await expect(textBlock(page)).toHaveCount(0);
    await expect(exportHtml(page)).rejects.toThrow("has no document to export");

    await setValue(page, saved);
    await expect(textBlock(page)).toHaveText("Hello");
  });
});

test.describe("refusing a document", () => {
  test("a newer version fires mq-error and leaves the email as it was", async ({
    page,
  }) => {
    await focusStartOfTextBlock(page);
    await stopClock(page);
    await page.keyboard.type("ab");
    await expect(changeCount(page)).toHaveText("2");
    const before = await currentValue(page);

    const reasons = await setValueAndCollectErrors(page, {
      ...before,
      version: 999,
    });

    expect(reasons).toStrictEqual([
      expect.stringMatching(/version 999 is newer/iu),
    ]);
    await expect(textBlock(page)).toHaveText("abHello");
    expect(await currentValue(page)).toStrictEqual(before);
    expect(await exportHtml(page)).toContain("abHello");
    await expect(changeCount(page)).toHaveText("2");

    // The email is still the same one, with its cursor and undo history.
    await expect(textBlock(page)).toBeFocused();
    await page.keyboard.type("c");
    await expect(textBlock(page)).toHaveText("abcHello");
    await undoByKey(page);
    await expect(textBlock(page)).toHaveText("Hello");
  });

  test("a link that isn't allowed fires mq-error and leaves the email as it was", async ({
    page,
  }) => {
    const before = await currentValue(page);

    const reasons = await setValueAndCollectErrors(
      page,
      // oxlint-disable-next-line eslint/no-script-url -- This is what's refused.
      emailWithLink("Click", "javascript:alert(1)")
    );

    expect(reasons).toStrictEqual([
      expect.stringMatching(/A link must start with http:/u),
    ]);
    await expect(textBlock(page)).toHaveText("Hello");
    expect(await currentValue(page)).toStrictEqual(before);
  });

  test("mq-error reaches a listener added just after setting value", async ({
    page,
  }) => {
    const reason = await page.evaluate(
      () =>
        // oxlint-disable-next-line promise/avoid-new -- Events have no promise form.
        new Promise((resolve) => {
          const element = document.createElement("mail-quilt");
          element.value = { version: 999 } as unknown as MailQuilt["value"];
          // Outside the element, as a host's page-level handler would be.
          document.addEventListener("mq-error", (event) => {
            resolve((event as HTMLElementEventMap["mq-error"]).detail.reason);
          });
          document.body.append(element);
        })
    );

    expect(reason).toMatch(/version 999 is newer/iu);
  });

  test("a refused first document leaves nothing to edit or export", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const element = document.createElement("mail-quilt");
      element.value = { version: 999 } as unknown as MailQuilt["value"];
      document.body.append(element);
      await element.updateComplete;
      return {
        editors:
          element.shadowRoot?.querySelectorAll("[contenteditable]").length,
        exported: await element.exportHtml().catch(String),
        value: element.value ?? null,
      };
    });

    expect(result).toStrictEqual({
      editors: 0,
      exported: "Error: <mail-quilt> has no document to export",
      value: null,
    });
  });
});

test("a host's fixed height never cuts the email short", async ({ page }) => {
  await setValue(
    page,
    emailWith(Array.from({ length: 20 }, (_, index) => [[`Row ${index}`]]))
  );
  await expect(textBlock(page)).toHaveCount(20);

  await canvas(page).evaluate((element) => {
    (element as HTMLElement).style.setProperty("height", "800px");
  });

  // The whole email shows, overflowing the host as it always has.
  const editor = await boxOf(canvas(page).locator('[part="frame"]'));
  const lastRow = await boxOf(canvas(page).getByTestId("row-frame").last());
  expect(lastRow.y + lastRow.height).toBeLessThanOrEqual(
    editor.y + editor.height
  );
});
